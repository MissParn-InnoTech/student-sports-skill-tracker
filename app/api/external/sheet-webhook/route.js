import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKeyFromEnv } from '@/lib/apiAuth';
import { upsertStudentFromSheet, upsertSkillLogFromSheet, upsertOverallSkillLogFromGradeSheet } from '@/lib/dataAccess';
import { upsertCourseLog } from '@/lib/courseLogs';
import { receiveCentralScoresBatch } from '@/lib/centralScores';
import { receiveMasterTabBatch, MASTER_TABS } from '@/lib/masterTabs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/external/sheet-webhook
 * เรียกโดย Google Apps Script (onEdit trigger) ที่ติดตั้งบน Google Sheet "Master Sport Report"
 * เท่านั้น — ป้องกันด้วย shared secret env var SHEET_SYNC_SECRET (header x-api-key)
 *
 * body: { tab: "Student_DB" | "Skill_Logs", row: { ...key ตามหัวคอลัมน์จริงบนชีต } }
 * Apps Script จะส่ง row เป็น object ที่ key = ข้อความ header แถวที่ 1 ของชีตเป๊ะๆ (ไม่แปลงเป็น camelCase)
 * ชีต "Master Sport Report" ของจริงใช้หัวคอลัมน์แบบนี้ (ต่างจากชื่อฟิลด์ภายในระบบ) จึงต้องแปลงก่อน:
 *   Student_DB: ID | Name | Class | Current_Academic_Year | Status | Assigned_Sport(คอลัมน์ใหม่)
 *   Skill_Logs: Timestamp | Academic_Year | Student_ID | Student_Name | Selected_Sport | Skill_Name
 *               | Final_Level | Coach_Notes | ID(คอลัมน์ใหม่ ต่อท้าย)
 * ดูโค้ด Apps Script ทั้งหมดที่ต้องติดตั้งบน Sheet ได้จากข้อความที่ส่งให้ผู้ใช้ตอนตั้งค่าฟีเจอร์นี้
 */

/** map หัวคอลัมน์จริงของแท็บ Student_DB -> ฟิลด์ภายในระบบ */
function normalizeStudentRow(row) {
  return {
    id: row.ID ?? row.id,
    name: row.Name ?? row.name,
    className: row.Class ?? row.className,
    currentAcademicYear: row.Current_Academic_Year ?? row.currentAcademicYear,
    status: row.Status ?? row.status,
    assignedSport: row.Assigned_Sport ?? row.assignedSport,
  };
}

/** map หัวคอลัมน์จริงของแท็บ Skill_Logs -> ฟิลด์ภายในระบบ */
function normalizeSkillLogRow(row) {
  return {
    id: row.ID ?? row.id,
    academicYear: row.Academic_Year ?? row.academicYear,
    studentId: row.Student_ID ?? row.studentId,
    studentName: row.Student_Name ?? row.studentName,
    selectedSport: row.Selected_Sport ?? row.selectedSport,
    skillName: row.Skill_Name ?? row.skillName,
    finalLevel: row.Final_Level ?? row.finalLevel,
    coachNotes: row.Coach_Notes ?? row.coachNotes,
  };
}

/**
 * map หัวคอลัมน์จริงของแท็บ "Data_Entry" ในชีต Grade_<กีฬา> (เช่น Grade_Futsal) -> ฟิลด์ภายในระบบ
 * GradeSheetSync.gs (ติดตั้งบนชีตนี้โดยตรง) จะแปลงให้แล้วก่อนส่ง: ส่ง finalLevel เป็นตัวเลข 1-6
 * หรือค่าว่าง (ถ้า LV.ใหม่/LV.เดิม ยังเป็น "PL" = ยังไม่ได้ประเมิน) และแนบ selectedSport/academicYear
 * มาด้วยเสมอ (hardcode ไว้ในสคริปต์ของแต่ละไฟล์ เพราะชีตเองไม่มีคอลัมน์บอกชื่อกีฬา)
 */
function normalizeGradeEntryRow(row) {
  return {
    academicYear: row.academicYear,
    studentId: row.studentId,
    studentName: row.studentName,
    className: row.className,
    selectedSport: row.selectedSport,
    finalLevel: row.finalLevel,
  };
}

export const POST = withApiKeyFromEnv('SHEET_SYNC_SECRET', withErrorHandling(async (request) => {
  const body = await request.json();
  const { tab, row } = body;

  if (tab === 'Student_DB') {
    const student = await upsertStudentFromSheet(normalizeStudentRow(row || {}));
    return NextResponse.json({ ok: true, student });
  }
  if (tab === 'Skill_Logs') {
    const log = await upsertSkillLogFromSheet(normalizeSkillLogRow(row || {}));
    return NextResponse.json({ ok: true, log });
  }
  if (tab === 'Data_Entry') {
    const log = await upsertOverallSkillLogFromGradeSheet(normalizeGradeEntryRow(row || {}));
    return NextResponse.json({ ok: true, log });
  }
  if (tab === 'Course_Entry') {
    // คอร์สพิเศษ (นอกเวลา / Summer Course / October Course) จาก Master_Sports_System
    // รับได้ทั้ง row เดียว หรือ rows หลายแถว เก็บแยกตาราง course_skill_logs ไม่แตะคะแนนภาคปกติ
    const list = Array.isArray(body.rows) ? body.rows : [row || {}];
    let saved = 0;
    const errors = [];
    const stored = []; // ค่าที่เก็บอยู่จริงหลังรวมกับคะแนนที่กรอกผ่านหน้าเว็บ (ชีตใช้เติมช่องว่างใน Course_Scores)
    for (const r of list) {
      try {
        stored.push(await upsertCourseLog(r || {}));
        saved++;
      } catch (err) {
        errors.push({ studentId: r?.studentId ?? null, error: err.message });
      }
    }
    return NextResponse.json({ ok: errors.length === 0, saved, errors, rows: stored });
  }
  if (tab === 'Central_Scores') {
    // สำเนาแท็บ Central_Scores ทั้งแท็บ (ส่งเป็นชุด ๆ) ใช้เป็นแหล่งข้อมูลของหน้า "ภาพรวมระบบ"
    const result = await receiveCentralScoresBatch({ syncId: body.syncId, rows: body.rows, final: body.final === true });
    return NextResponse.json(result);
  }
  if (MASTER_TABS.includes(tab)) {
    // สำเนาแท็บ Student_Register / Course_Register ทั้งแท็บ (ส่งเป็นชุด ๆ) ใช้กับหน้า "รายงานผู้บริหาร"
    const result = await receiveMasterTabBatch({ tab, syncId: body.syncId, rows: body.rows, final: body.final === true });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: `ไม่รู้จักแท็บ "${tab}" (ต้องเป็น Student_DB, Skill_Logs, Data_Entry, Course_Entry, Central_Scores, Student_Register หรือ Course_Register)` }, { status: 400 });
}));
