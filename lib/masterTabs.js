/**
 * masterTabs.js
 * -----------------------------------------------------------------------
 * สำเนา (snapshot) ของแท็บ "Student_Register" และ "Course_Register" จาก Google Sheet
 * (Master_Sports_System) ใช้คู่กับ central_scores เป็นแหล่งข้อมูลของหน้า "รายงานผู้บริหาร" (/admin)
 *
 * ทิศทางข้อมูล: ชีต -> เว็บ ทางเดียว (เว็บไม่เขียนกลับ)
 * Apps Script (google-apps-script/CentralScoresSync.gs) ส่งทั้งแท็บมาเป็นชุด ๆ ผ่าน
 * POST /api/external/sheet-webhook { tab, syncId, rows, final }
 * เมื่อชุดสุดท้าย (final) มาถึงจึงสลับเป็นข้อมูลปัจจุบันและลบรอบเก่า หน้าเว็บจึงเห็นข้อมูลครบทั้งรอบเสมอ
 *
 * เก็บเฉพาะฟิลด์ที่ใช้ทำสถิติ (ไม่เก็บชื่อ-นามสกุล)
 * ตารางสร้างเองด้วย CREATE TABLE IF NOT EXISTS และต้องประกาศ model ไว้ใน prisma/schema.prisma ให้ตรงกัน
 */
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

export const MASTER_TABS = ['Student_Register', 'Course_Register'];

let tablesReady = false;

export async function ensureMasterTabTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS master_tab_rows (' +
      'id SERIAL PRIMARY KEY, ' +
      'tab TEXT NOT NULL, ' +
      'sync_id TEXT NOT NULL, ' +
      'row_no INTEGER, ' +
      'student_id TEXT, ' +
      'prefix TEXT, ' +
      'class_name TEXT, ' +
      'sport_code TEXT, ' +
      'level_old TEXT, ' +
      'course_type TEXT, ' +
      'academic_year TEXT, ' +
      'status TEXT)'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS master_tab_sync (' +
      'tab TEXT PRIMARY KEY, ' +
      'sync_id TEXT NOT NULL, ' +
      'row_count INTEGER NOT NULL, ' +
      'completed_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  tablesReady = true;
}

function textOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** รับข้อมูล 1 ชุดของแท็บ Student_Register / Course_Register จาก Apps Script */
export async function receiveMasterTabBatch({ tab, syncId, rows, final }) {
  if (!MASTER_TABS.includes(tab)) throw new Error('ไม่รู้จักแท็บ "' + tab + '"');
  const id = textOrNull(syncId);
  if (!id) throw new Error('ต้องระบุ syncId ของรอบการซิงก์ ' + tab);
  const list = Array.isArray(rows) ? rows : [];
  await ensureMasterTabTables();

  if (list.length > 0) {
    const values = list.map((r) => {
      const rowNo = Number.isInteger(Number(r?.rowNo)) ? Number(r.rowNo) : null;
      return Prisma.sql`(${tab}, ${id}, ${rowNo}, ${textOrNull(r?.studentId)}, ${textOrNull(r?.prefix)}, ${textOrNull(r?.className)}, ${textOrNull(r?.sportCode)}, ${textOrNull(r?.levelOld)}, ${textOrNull(r?.courseType)}, ${textOrNull(r?.academicYear)}, ${textOrNull(r?.status)})`;
    });
    await prisma.$executeRaw`
      INSERT INTO master_tab_rows
        (tab, sync_id, row_no, student_id, prefix, class_name, sport_code, level_old, course_type, academic_year, status)
      VALUES ${Prisma.join(values)}
    `;
  }

  if (!final) return { ok: true, tab, syncId: id, received: list.length, completed: false };

  const counted = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM master_tab_rows WHERE tab = ${tab} AND sync_id = ${id}`;
  const rowCount = Number(counted[0]?.n || 0);
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM master_tab_rows WHERE tab = ${tab} AND sync_id <> ${id}`,
    prisma.$executeRaw`
      INSERT INTO master_tab_sync (tab, sync_id, row_count, completed_at) VALUES (${tab}, ${id}, ${rowCount}, now())
      ON CONFLICT (tab) DO UPDATE SET sync_id = EXCLUDED.sync_id, row_count = EXCLUDED.row_count, completed_at = now()
    `,
  ]);
  return { ok: true, tab, syncId: id, received: list.length, completed: true, totalRows: rowCount };
}

/** อ่านรอบซิงก์ล่าสุดที่เสร็จสมบูรณ์ของแท็บ คืน { synced, lastSyncedTs, rows } */
export async function getMasterTab(tab) {
  await ensureMasterTabTables();
  const sync = await prisma.$queryRaw`SELECT sync_id, completed_at FROM master_tab_sync WHERE tab = ${tab} LIMIT 1`;
  if (sync.length === 0) return { synced: false, lastSyncedTs: null, rows: [] };
  const rows = await prisma.$queryRaw`
    SELECT row_no, student_id, prefix, class_name, sport_code, level_old, course_type, academic_year, status
    FROM master_tab_rows WHERE tab = ${tab} AND sync_id = ${sync[0].sync_id} ORDER BY row_no NULLS LAST, id
  `;
  return {
    synced: true,
    lastSyncedTs: new Date(sync[0].completed_at).getTime(),
    rows: rows.map((r) => ({
      rowNo: r.row_no,
      studentId: r.student_id,
      prefix: r.prefix,
      className: r.class_name,
      sportCode: r.sport_code,
      levelOld: r.level_old,
      courseType: r.course_type,
      academicYear: r.academic_year,
      status: r.status,
    })),
  };
}
