/**
 * sheetsSync.js
 * -----------------------------------------------------------------------
 * Sync ทางเดียว "Postgres -> Google Sheet" (Sheet -> Postgres อยู่ที่
 * app/api/external/sheet-webhook/route.js ซึ่งรับ request จาก Apps Script
 * ที่ติดตั้งไว้บน Sheet เอง)
 *
 * Postgres ยังเป็น source of truth เสมอ — ฟังก์ชันในไฟล์นี้เป็น best-effort:
 * ถ้า Google Sheets API ล่ม/ยังไม่ได้ตั้งค่า จะ log error แล้วปล่อยผ่าน ไม่ทำให้
 * การบันทึกข้อมูลหลักในเว็บแอปล้มเหลวตาม
 *
 * โครงสร้างชีตนี้ยึดตามชีต "Master Sport Report" ของจริงที่มีอยู่แล้ว (คอลัมน์เดิม
 * คงตำแหน่งไว้ทั้งหมด เพิ่มแค่คอลัมน์ใหม่ต่อท้ายสำหรับใช้ sync เท่านั้น):
 *   Student_DB: A:ID | B:Name | C:Class | D:Current_Academic_Year | E:Status | F:Assigned_Sport (ใหม่)
 *               คีย์ค้นหา/จับคู่แถว = คอลัมน์ A (ID)
 *   Skill_Logs: A:Timestamp | B:Academic_Year | C:Student_ID | D:Student_Name | E:Selected_Sport
 *               | F:Skill_Name | G:Final_Level | H:Coach_Notes | I:ID (ใหม่ ต่อท้าย)
 *               คีย์ค้นหา/จับคู่แถว = คอลัมน์ I (ID) เพราะคอลัมน์ A เดิมเป็น Timestamp ไม่ใช่คีย์ที่ unique
 */
import { getValues, updateRow, appendRow, clearRow, isSheetsSyncEnabled } from './googleSheetsClient.js';

const STUDENT_TAB = 'Student_DB';
const STUDENT_RANGE_ALL = `${STUDENT_TAB}!A:F`;
const STUDENT_KEY_COL = 'A';
const LOG_TAB = 'Skill_Logs';
const LOG_RANGE_ALL = `${LOG_TAB}!A:I`;
const LOG_KEY_COL = 'I';

function colLetterForIndex1Based(n) {
  // 1 -> A, 26 -> Z, 27 -> AA ...
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** หาเลขแถว (1-based, รวม header) ของค่าคีย์ในคอลัมน์ที่ระบุ (keyCol) ของแท็บที่ระบุ; null ถ้าไม่เจอ */
async function findRowByKey(tab, keyValue, keyCol = 'A') {
  const rows = await getValues(`${tab}!${keyCol}:${keyCol}`);
  if (!rows) return null;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(keyValue)) return i + 1; // 1-based
  }
  return null;
}

function safeLog(label, err) {
  console.error(`[sheetsSync] ${label} ล้มเหลว (ไม่กระทบข้อมูลหลักใน Postgres):`, err?.message || err);
}

/** syncStudentUpsert: เขียน/อัปเดตแถวนักเรียน 1 คนใน Student_DB (คีย์ = คอลัมน์ A / ID) */
export async function syncStudentUpsert(student) {
  if (!isSheetsSyncEnabled()) return;
  try {
    const row = [student.id, student.name, student.className, student.currentAcademicYear, student.status, student.assignedSport || ''];
    const rowIndex = await findRowByKey(STUDENT_TAB, student.id, STUDENT_KEY_COL);
    if (rowIndex) {
      const lastCol = colLetterForIndex1Based(row.length);
      await updateRow(`${STUDENT_TAB}!A${rowIndex}:${lastCol}${rowIndex}`, row);
    } else {
      await appendRow(STUDENT_RANGE_ALL, row);
    }
  } catch (err) {
    safeLog(`syncStudentUpsert(${student?.id})`, err);
  }
}

/** syncStudentDelete: ล้างแถวนักเรียนใน Student_DB (ไม่ลบแถวจริง แค่เคลียร์ค่า) */
export async function syncStudentDelete(studentId) {
  if (!isSheetsSyncEnabled()) return;
  try {
    const rowIndex = await findRowByKey(STUDENT_TAB, studentId, STUDENT_KEY_COL);
    if (rowIndex) await clearRow(`${STUDENT_TAB}!A${rowIndex}:F${rowIndex}`);
  } catch (err) {
    safeLog(`syncStudentDelete(${studentId})`, err);
  }
}

/** syncSkillLogsAppend: เพิ่มแถวผลประเมินใหม่ (สร้างอย่างเดียว ไม่มีแก้ไขย้อนหลังจากฝั่งเว็บ) — ID อยู่คอลัมน์สุดท้าย (I) */
export async function syncSkillLogsAppend(logs) {
  if (!isSheetsSyncEnabled() || !logs || logs.length === 0) return;
  try {
    for (const log of logs) {
      const row = [
        log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
        log.academicYear,
        log.studentId,
        log.studentName,
        log.selectedSport,
        log.skillName,
        log.finalLevel,
        log.coachNotes || '',
        log.id,
      ];
      await appendRow(LOG_RANGE_ALL, row);
    }
  } catch (err) {
    safeLog('syncSkillLogsAppend', err);
  }
}

/** syncSkillLogUpdate: แก้ไขแถวผลประเมินที่มีอยู่แล้ว (จับคู่ด้วย SkillLog.id คอลัมน์ I) */
export async function syncSkillLogUpdate(log) {
  if (!isSheetsSyncEnabled()) return;
  try {
    const rowIndex = await findRowByKey(LOG_TAB, log.id, LOG_KEY_COL);
    if (!rowIndex) return syncSkillLogsAppend([log]);
    const row = [
      log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
      log.academicYear,
      log.studentId,
      log.studentName,
      log.selectedSport,
      log.skillName,
      log.finalLevel,
      log.coachNotes || '',
      log.id,
    ];
    await updateRow(`${LOG_TAB}!A${rowIndex}:I${rowIndex}`, row);
  } catch (err) {
    safeLog(`syncSkillLogUpdate(${log?.id})`, err);
  }
}
