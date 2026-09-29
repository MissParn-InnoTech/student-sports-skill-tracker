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
 * โครงสร้างชีตที่ต้องมี (ตั้งชื่อแท็บให้ตรงเป๊ะ แถวที่ 1 เป็น header คอลัมน์ A
 * ของทุกแท็บ = คีย์ที่ใช้ค้นหา/จับคู่แถว):
 *   Student_DB: id | name | className | currentAcademicYear | assignedSport | status
 *   Skill_Logs: id | timestamp | academicYear | studentId | studentName | selectedSport | skillName | finalLevel | coachNotes
 */
import { getValues, updateRow, appendRow, clearRow, isSheetsSyncEnabled } from './googleSheetsClient.js';

const STUDENT_TAB = 'Student_DB';
const STUDENT_RANGE_ALL = `${STUDENT_TAB}!A:F`;
const LOG_TAB = 'Skill_Logs';
const LOG_RANGE_ALL = `${LOG_TAB}!A:I`;

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

/** หาเลขแถว (1-based, รวม header) ของค่าคีย์ในคอลัมน์ A ของแท็บที่ระบุ; null ถ้าไม่เจอ */
async function findRowByKey(tab, keyValue) {
  const rows = await getValues(`${tab}!A:A`);
  if (!rows) return null;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(keyValue)) return i + 1; // 1-based
  }
  return null;
}

function safeLog(label, err) {
  console.error(`[sheetsSync] ${label} ล้มเหลว (ไม่กระทบข้อมูลหลักใน Postgres):`, err?.message || err);
}

/** syncStudentUpsert: เขียน/อัปเดตแถวนักเรียน 1 คนใน Student_DB */
export async function syncStudentUpsert(student) {
  if (!isSheetsSyncEnabled()) return;
  try {
    const row = [student.id, student.name, student.className, student.currentAcademicYear, student.assignedSport || '', student.status];
    const rowIndex = await findRowByKey(STUDENT_TAB, student.id);
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
    const rowIndex = await findRowByKey(STUDENT_TAB, studentId);
    if (rowIndex) await clearRow(`${STUDENT_TAB}!A${rowIndex}:F${rowIndex}`);
  } catch (err) {
    safeLog(`syncStudentDelete(${studentId})`, err);
  }
}

/** syncSkillLogsAppend: เพิ่มแถวผลประเมินใหม่ (สร้างอย่างเดียว ไม่มีแก้ไขย้อนหลังจากฝั่งเว็บ) */
export async function syncSkillLogsAppend(logs) {
  if (!isSheetsSyncEnabled() || !logs || logs.length === 0) return;
  try {
    for (const log of logs) {
      const row = [
        log.id,
        log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
        log.academicYear,
        log.studentId,
        log.studentName,
        log.selectedSport,
        log.skillName,
        log.finalLevel,
        log.coachNotes || '',
      ];
      await appendRow(LOG_RANGE_ALL, row);
    }
  } catch (err) {
    safeLog('syncSkillLogsAppend', err);
  }
}

/** syncSkillLogUpdate: แก้ไขแถวผลประเมินที่มีอยู่แล้ว (จับคู่ด้วย SkillLog.id คอลัมน์ A) */
export async function syncSkillLogUpdate(log) {
  if (!isSheetsSyncEnabled()) return;
  try {
    const rowIndex = await findRowByKey(LOG_TAB, log.id);
    if (!rowIndex) return syncSkillLogsAppend([log]);
    const row = [
      log.id,
      log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
      log.academicYear,
      log.studentId,
      log.studentName,
      log.selectedSport,
      log.skillName,
      log.finalLevel,
      log.coachNotes || '',
    ];
    await updateRow(`${LOG_TAB}!A${rowIndex}:I${rowIndex}`, row);
  } catch (err) {
    safeLog(`syncSkillLogUpdate(${log?.id})`, err);
  }
}
