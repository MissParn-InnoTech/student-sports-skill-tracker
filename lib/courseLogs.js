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
 * คืนค่าแถวที่เก็บอยู่จริงหลังบันทึก (ใช้รวมคะแนนจากเว็บกลับไปที่ชีต)
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
  // ค่าว่างจากชีตจะไม่ลบคะแนนที่มีอยู่แล้ว (เช่น คะแนนที่ครูกรอกผ่านหน้าเว็บ) — ใช้ COALESCE คงค่าเดิมไว้
  const stored = await prisma.$queryRaw`
    INSERT INTO course_skill_logs
      (student_id, student_name, class_name, academic_year, sport_code, course_type, level_old, level_new, total_score, updated_at)
    VALUES
      (${studentId}, ${studentName}, ${className}, ${academicYear}, ${sportCode}, ${courseType}, ${levelOld}, ${levelNew}, ${totalScore}, now())
    ON CONFLICT (student_id, academic_year, sport_code, course_type) DO UPDATE SET
      student_name = COALESCE(EXCLUDED.student_name, course_skill_logs.student_name),
      class_name = COALESCE(EXCLUDED.class_name, course_skill_logs.class_name),
      level_old = COALESCE(EXCLUDED.level_old, course_skill_logs.level_old),
      level_new = COALESCE(EXCLUDED.level_new, course_skill_logs.level_new),
      total_score = COALESCE(EXCLUDED.total_score, course_skill_logs.total_score),
      updated_at = now()
    RETURNING id, student_id, student_name, class_name, academic_year, sport_code, course_type, level_old, level_new, total_score
  `;
  return mapCourseRow(stored[0]);
}

function mapCourseRow(r) {
  return {
    id: Number(r.id),
    studentId: r.student_id,
    studentName: r.student_name,
    className: r.class_name,
    academicYear: Number(r.academic_year),
    sportCode: r.sport_code,
    courseType: r.course_type,
    levelOld: r.level_old,
    levelNew: r.level_new,
    totalScore: r.total_score === null || r.total_score === undefined ? null : Number(r.total_score),
  };
}

export const COURSE_LEVELS = ['PL', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

/** listCourseLogs: รายชื่อ+ผลคอร์สพิเศษตามตัวกรอง (ค่าว่าง = ไม่กรอง) พร้อมตัวเลือกสำหรับ dropdown */
export async function listCourseLogs({ academicYear, sportCode, courseType } = {}) {
  await ensureCourseTable();
  const all = await prisma.$queryRaw`
    SELECT id, student_id, student_name, class_name, academic_year, sport_code, course_type, level_old, level_new, total_score
    FROM course_skill_logs
    ORDER BY academic_year DESC, course_type, sport_code, class_name, student_id
  `;
  const mapped = all.map(mapCourseRow);
  const uniq = (arr) => [...new Set(arr)];
  const filters = {
    years: uniq(mapped.map((r) => r.academicYear)),
    sportCodes: uniq(mapped.map((r) => r.sportCode)).sort(),
    courseTypes: uniq(mapped.map((r) => r.courseType)).sort(),
  };
  const y = academicYear ? Number(academicYear) : null;
  const rows = mapped.filter(
    (r) => (!y || r.academicYear === y) && (!sportCode || r.sportCode === sportCode) && (!courseType || r.courseType === courseType)
  );
  return { filters, rows };
}

/**
 * saveCourseScores: บันทึก LV.ใหม่ / คะแนนรวม ที่ครูกรอกผ่านหน้าเว็บ (จับคู่ด้วย id ของแถว)
 * entries: [{ id, levelNew, totalScore }] — ค่าว่าง = ล้างค่าช่องนั้น
 */
export async function saveCourseScores(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('ไม่มีรายการให้บันทึก');
  await ensureCourseTable();
  const cleaned = entries.map((e) => {
    const id = Number(e.id);
    if (!Number.isInteger(id)) throw new Error('รายการไม่มีรหัสแถว (id)');
    const levelNew = textOrNull(e.levelNew);
    if (levelNew !== null && !COURSE_LEVELS.includes(levelNew)) {
      throw new Error('LV.ใหม่ ไม่ถูกต้อง: "' + levelNew + '" (ต้องเป็น PL หรือ L1-L6)');
    }
    let totalScore = null;
    if (!(e.totalScore === '' || e.totalScore === null || e.totalScore === undefined)) {
      totalScore = Number(e.totalScore);
      if (!Number.isFinite(totalScore) || totalScore < 0 || totalScore > 100) {
        throw new Error('คะแนนรวมไม่ถูกต้อง: "' + e.totalScore + '" (ต้องเป็นตัวเลข 0-100)');
      }
    }
    return { id, levelNew, totalScore };
  });
  let saved = 0;
  for (const c of cleaned) {
    saved += await prisma.$executeRaw`
      UPDATE course_skill_logs SET level_new = ${c.levelNew}, total_score = ${c.totalScore}, updated_at = now() WHERE id = ${c.id}
    `;
  }
  return { saved };
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
