/**
 * gradeUtils.js
 * -----------------------------------------------------------------------
 * ช่วยแปลง "ชั้นเรียน" (เช่น "ป.4/2") ให้เป็น "ระดับชั้น" (เช่น "ป.4") และคำนวณ
 * เส้นเวลาผลการประเมินของนักเรียน 1 คน ตั้งแต่ ป.1 จนถึงชั้นปัจจุบัน (ป.1-ป.6 / ม.1-ม.3)
 *
 * หมายเหตุ: ระบบยังไม่ได้เก็บ "ชั้นเรียนของแต่ละปี" แยกไว้ใน SkillLog โดยตรง (เก็บแค่ปีการศึกษา)
 * จึงคำนวณย้อนกลับจากชั้นเรียนปัจจุบันของนักเรียน + ปีการศึกษาปัจจุบัน โดยสมมติว่านักเรียน
 * เลื่อนชั้นขึ้นปีละ 1 ระดับตามปกติ (ไม่มีการซ้ำชั้น) ซึ่งตรงกับกรณีใช้งานทั่วไป
 */

export const GRADE_LADDER = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];

/** แปลง "ป.4/2" หรือ "ม.2/1" -> "ป.4" / "ม.2" ; คืนค่า null ถ้ารูปแบบไม่ตรง */
export function parseGradeLabel(className) {
  if (!className) return null;
  const match = String(className).trim().match(/^([ปม]\.\d)/);
  return match ? match[1] : null;
}

export function gradeIndexOf(gradeLabel) {
  if (!gradeLabel) return -1;
  return GRADE_LADDER.indexOf(gradeLabel);
}

/**
 * สร้างเส้นเวลาผลการประเมินตั้งแต่ ป.1 จนถึงชั้นปัจจุบันของนักเรียน
 * @param {string} currentClassName ชั้นเรียนปัจจุบัน เช่น "ป.6/1"
 * @param {number} currentYear ปีการศึกษาปัจจุบันของนักเรียน (currentAcademicYear)
 * @param {Array<{year:number, sport:string, ts:number, levels:Record<string,number>, note:string}>} rounds รอบการประเมินทั้งหมด (จาก groupLogsIntoRounds)
 * @returns {Array<{gradeLabel:string, year:number, round:object|null}>|null} null ถ้าแปลงชั้นเรียนปัจจุบันไม่ได้
 */
export function buildGradeTimeline(currentClassName, currentYear, rounds) {
  const currentGrade = parseGradeLabel(currentClassName);
  const currentIdx = gradeIndexOf(currentGrade);
  if (currentIdx === -1 || !currentYear) return null;

  // จัดกลุ่มรอบตามปีการศึกษา แล้วเลือกรอบล่าสุด (ts มากสุด) ของแต่ละปี เผื่อมีหลายกีฬา/หลายรอบในปีเดียว
  const byYear = {};
  rounds.forEach((r) => {
    if (!byYear[r.year] || r.ts > byYear[r.year].ts) byYear[r.year] = r;
  });

  const timeline = [];
  for (let idx = 0; idx <= currentIdx; idx++) {
    const year = currentYear - (currentIdx - idx);
    timeline.push({
      gradeLabel: GRADE_LADDER[idx],
      year,
      round: byYear[year] || null,
    });
  }
  return timeline;
}
