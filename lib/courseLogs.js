/**
 * courseLogs.js
 * -----------------------------------------------------------------------
 * ผลประเมินของ "คอร์สพิเศษ" (นอกเวลา / Summer Course / October Course)
 * ซิงก์มาจากแท็บ Course_Entry / Course_Scores ของ Google Sheet (Master_Sports_System)
 *
 * เก็บแยกในตาราง course_skill_logs โดยเฉพาะ ไม่แตะตาราง skill_logs ของภาคปกติเลย
 * (คะแนนภาคปกติเดิมจึงคงอยู่ครบ และ unique key เดิมไม่ชนกัน) ตารางนี้ไม่ได้อยู่ใน
 * schema.prisma — สร้างเองอัตโนมัติด้วย CREATE TABLE IF NOT EXISTS ตอนใช้งานครั้งแรก
 * จึงไม่ต้องรัน `prisma db push` เพิ่ม
 */
import { prisma } from './db.js';

let tableReady = false;

export async function ensureCourseTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS course_skill_logs (' +
      'id SERIAL PRIMARY KEY, ' +
      'student_id TEXT NOT NULL, ' +
      'student_name TEXT, ' +
      'class_name TEXT, ' +
      'academic_year INTEGER NOT NULL, ' +
      'sport_code TEXT NOT NULL, ' +
      'course_type TEXT NOT NULL, ' +
      'level_old TEXT, ' +
      'level_new TEXT, ' +
      'total_score DOUBLE PRECISION, ' +
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
      'UNIQUE (student_id, academic_year, sport_code, course_type))'
  );
  tableReady = true;
}

function textOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * upsertCourseLog: บันทึก/อัปเดตผลคอร์สพิเศษ 1 รายการ
 * คีย์ = (studentId, academicYear, sportCode, courseType)
 * levelNew / totalScore เว้นว่างได้ (ลงทะเบียนแล้วแต่ครูยังไม่ได้กรอกคะแนน)
 */
export async function upsertCourseLog(row) {
  const studentId = textOrNull(row.studentId);
  const sportCode = textOrNull(row.sportCode);
  const courseType = textOrNull(row.courseType);
  const academicYear = Number(row.academicYear);
  if (!studentId) throw new Error('แถวคอร์สพิเศษไม่มีรหัสประจำตัวนักเรียน');
  if (!sportCode) throw new Error('แถวคอร์สพิเศษไม่มีรหัสวิชา');
  if (!courseType) throw new Error('แถวคอร์สพิเศษไม่มีประเภทคอร์ส');
  if (!Number.isInteger(academicYear)) throw new Error('แถวคอร์สพิเศษไม่มีปีการศึกษา');

  const studentName = textOrNull(row.studentName);
  const className = textOrNull(row.className);
  const levelOld = textOrNull(row.levelOld);
  const levelNew = textOrNull(row.levelNew);
  const scoreNum = row.totalScore === '' || row.totalScore === null || row.totalScore === undefined ? NaN : Number(row.totalScore);
  const totalScore = Number.isFinite(scoreNum) ? scoreNum : null;

  await ensureCourseTable();
  await prisma.$executeRaw`
    INSERT INTO course_skill_logs
      (student_id, student_name, class_name, academic_year, sport_code, course_type, level_old, level_new, total_score, updated_at)
    VALUES
      (${studentId}, ${studentName}, ${className}, ${academicYear}, ${sportCode}, ${courseType}, ${levelOld}, ${levelNew}, ${totalScore}, now())
    ON CONFLICT (student_id, academic_year, sport_code, course_type) DO UPDATE SET
      student_name = COALESCE(EXCLUDED.student_name, course_skill_logs.student_name),
      class_name = COALESCE(EXCLUDED.class_name, course_skill_logs.class_name),
      level_old = COALESCE(EXCLUDED.level_old, course_skill_logs.level_old),
      level_new = EXCLUDED.level_new,
      total_score = EXCLUDED.total_score,
      updated_at = now()
  `;
  return { studentId, academicYear, sportCode, courseType, levelOld, levelNew, totalScore };
}

/** getCourseLogsForStudent: ผลคอร์สพิเศษทั้งหมดของนักเรียน 1 คน — ถ้าอ่านไม่ได้คืน [] (ไม่ทำให้หน้า Dashboard หลักล้ม) */
export async function getCourseLogsForStudent(studentId) {
  try {
    await ensureCourseTable();
    const rows = await prisma.$queryRaw`
      SELECT academic_year, sport_code, course_type, level_old, level_new, total_score
      FROM course_skill_logs
      WHERE student_id = ${String(studentId)}
      ORDER BY academic_year, course_type, sport_code
    `;
    return rows.map((r) => ({
      academicYear: Number(r.academic_year),
      sportCode: r.sport_code,
      courseType: r.course_type,
      levelOld: r.level_old,
      levelNew: r.level_new,
      totalScore: r.total_score === null ? null : Number(r.total_score),
    }));
  } catch (err) {
    console.error('[courseLogs] อ่านผลคอร์สพิเศษไม่สำเร็จ:', err?.message || err);
    return [];
  }
}
