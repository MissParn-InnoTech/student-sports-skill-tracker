/**
 * centralScores.js
 * -----------------------------------------------------------------------
 * สำเนา (snapshot) ของแท็บ "Central_Scores" จาก Google Sheet (Master_Sports_System)
 * ใช้เป็นแหล่งข้อมูลเดียวของหน้า "ภาพรวมระบบ" (/admin)
 *
 * ทิศทางข้อมูล: ชีต -> เว็บ ทางเดียว (เว็บไม่เขียนกลับไปที่ Central_Scores)
 * Apps Script (google-apps-script/CentralScoresSync.gs) ส่งทั้งแท็บมาเป็นชุด ๆ ผ่าน
 * POST /api/external/sheet-webhook { tab: "Central_Scores", syncId, rows, final }
 * แต่ละรอบมี syncId ของตัวเอง เมื่อชุดสุดท้าย (final) มาถึงจึงลบข้อมูลรอบเก่าทิ้ง
 * หน้าเว็บจึงเห็นข้อมูล "ครบทั้งรอบ" เสมอ ไม่เห็นข้อมูลครึ่ง ๆ กลาง ๆ ระหว่างซิงก์
 *
 * ตารางไม่ได้อยู่ใน schema.prisma — สร้างเองด้วย CREATE TABLE IF NOT EXISTS ตอนใช้งานครั้งแรก
 * (แบบเดียวกับ course_skill_logs) จึงไม่ต้องรัน prisma db push เพิ่ม
 */
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { computeCentralOverview } from './centralAnalytics.js';

let tablesReady = false;

export async function ensureCentralTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS central_scores (' +
      'id SERIAL PRIMARY KEY, ' +
      'sync_id TEXT NOT NULL, ' +
      'row_no INTEGER, ' +
      'student_id TEXT, ' +
      'prefix TEXT, ' +
      'first_name TEXT, ' +
      'last_name TEXT, ' +
      'class_name TEXT, ' +
      'sport_code TEXT, ' +
      'level_old TEXT, ' +
      'level_new TEXT, ' +
      'total_score TEXT)'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS central_scores_sync (' +
      'sync_id TEXT PRIMARY KEY, ' +
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

/**
 * receiveCentralScoresBatch: รับข้อมูล 1 ชุดจาก Apps Script
 * rows: [{ rowNo, studentId, prefix, firstName, lastName, className, sportCode, levelOld, levelNew, totalScore }]
 * final = true คือชุดสุดท้ายของรอบ -> สลับให้รอบนี้เป็นข้อมูลปัจจุบัน และลบรอบเก่า
 */
export async function receiveCentralScoresBatch({ syncId, rows, final }) {
  const id = textOrNull(syncId);
  if (!id) throw new Error('ต้องระบุ syncId ของรอบการซิงก์ Central_Scores');
  const list = Array.isArray(rows) ? rows : [];
  await ensureCentralTables();

  if (list.length > 0) {
    const values = list.map((r) => {
      const rowNo = Number.isInteger(Number(r?.rowNo)) ? Number(r.rowNo) : null;
      return Prisma.sql`(${id}, ${rowNo}, ${textOrNull(r?.studentId)}, ${textOrNull(r?.prefix)}, ${textOrNull(r?.firstName)}, ${textOrNull(r?.lastName)}, ${textOrNull(r?.className)}, ${textOrNull(r?.sportCode)}, ${textOrNull(r?.levelOld)}, ${textOrNull(r?.levelNew)}, ${textOrNull(r?.totalScore)})`;
    });
    await prisma.$executeRaw`
      INSERT INTO central_scores
        (sync_id, row_no, student_id, prefix, first_name, last_name, class_name, sport_code, level_old, level_new, total_score)
      VALUES ${Prisma.join(values)}
    `;
  }

  if (!final) return { ok: true, syncId: id, received: list.length, completed: false };

  const counted = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM central_scores WHERE sync_id = ${id}`;
  const rowCount = Number(counted[0]?.n || 0);
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM central_scores WHERE sync_id <> ${id}`,
    prisma.$executeRaw`DELETE FROM central_scores_sync WHERE sync_id <> ${id}`,
    prisma.$executeRaw`
      INSERT INTO central_scores_sync (sync_id, row_count, completed_at) VALUES (${id}, ${rowCount}, now())
      ON CONFLICT (sync_id) DO UPDATE SET row_count = EXCLUDED.row_count, completed_at = now()
    `,
  ]);
  return { ok: true, syncId: id, received: list.length, completed: true, totalRows: rowCount };
}

/** getCentralOverview: ข้อมูลหน้า "ภาพรวมระบบ" คำนวณจากรอบซิงก์ล่าสุดที่เสร็จสมบูรณ์เท่านั้น */
export async function getCentralOverview() {
  await ensureCentralTables();
  const sync = await prisma.$queryRaw`
    SELECT sync_id, row_count, completed_at FROM central_scores_sync ORDER BY completed_at DESC LIMIT 1
  `;
  if (sync.length === 0) {
    return { source: 'Central_Scores', synced: false, lastSyncedTs: null, ...computeCentralOverview([]) };
  }
  const rows = await prisma.$queryRaw`
    SELECT row_no, student_id, prefix, first_name, last_name, class_name, sport_code, level_old, level_new, total_score
    FROM central_scores WHERE sync_id = ${sync[0].sync_id} ORDER BY row_no NULLS LAST, id
  `;
  const overview = computeCentralOverview(
    rows.map((r) => ({
      rowNo: r.row_no,
      studentId: r.student_id,
      prefix: r.prefix,
      firstName: r.first_name,
      lastName: r.last_name,
      className: r.class_name,
      sportCode: r.sport_code,
      levelOld: r.level_old,
      levelNew: r.level_new,
      totalScore: r.total_score,
    }))
  );
  return {
    source: 'Central_Scores',
    synced: true,
    lastSyncedTs: new Date(sync[0].completed_at).getTime(),
    ...overview,
  };
}
