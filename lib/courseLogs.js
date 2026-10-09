/**
 * courseLogs.js
 * -----------------------------------------------------------------------
 * ผลประเมินของ "คอร์สพิเศษ" (AFTER SCHOOL / OCTOBER / SUMMER)
 * ซิงก์มาจากแท็บ Course_Entry / Course_Scores ของ Google Sheet (Master_Sports_System)
 *
 * เก็บแยกในตาราง course_skill_logs โดยเฉพาะ ไม่แตะตาราง skill_logs ของภาคปกติเลย
 * (คะแนนภาคปกติเดิมจึงคงอยู่ครบ และ unique key เดิมไม่ชนกัน) ตารางนี้ไม่ได้อยู่ใน
 * schema.prisma — สร้างเองอัตโนมัติด้วย CREATE TABLE IF NOT EXISTS ตอนใช้งานครั้งแรก
 * จึงไม่ต้องรัน `prisma db push` เพิ่ม
 */
import { prisma } from './db.js';
import { getSkillsForSport } from './sportsConfig.js';
import { computeStartingLevels } from './skillLogic.js';

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

/* ============================================================================
 * กรอกคะแนนรายทักษะของคอร์สพิเศษผ่านหน้าแรกของเว็บ (เลือก กีฬา + ปีการศึกษา + คอร์ส)
 * เก็บแยกในตาราง course_skill_details — ไม่เขียนลงตาราง skill_logs ของภาคปกติ
 * ========================================================================== */

export const COURSE_TYPES = ['AFTER SCHOOL', 'OCTOBER', 'SUMMER'];

/** ชื่อกีฬาบนเว็บ -> รหัสวิชาใน Google Sheet (Master_Sports_System / System_Config) */
export const SPORT_CODE_BY_NAME = {
  'ฟุตซอล (Futsal)': 'FS',
  'บาสเกตบอล (Basketball)': 'BB',
  'ว่ายน้ำ (Swimming)': 'SW',
  'มวย (Boxing/Muay Thai)': 'BX',
  'แบดมินตัน (Badminton)': 'BAD',
  'ปิงปอง (Table Tennis)': 'TT',
  'ปีนหน้าผา (Rock Climbing)': 'CB',
  'กอล์ฟ (Golf)': 'G',
  'เทควันโด (Taekwondo)': 'TK',
  'เทนนิส (Tennis)': 'TN',
};

let detailTableReady = false;

async function ensureCourseDetailTable() {
  if (detailTableReady) return;
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS course_skill_details (' +
      'id SERIAL PRIMARY KEY, ' +
      'student_id TEXT NOT NULL, ' +
      'academic_year INTEGER NOT NULL, ' +
      'sport_code TEXT NOT NULL, ' +
      'course_type TEXT NOT NULL, ' +
      'skill_name TEXT NOT NULL, ' +
      'final_level INTEGER NOT NULL, ' +
      'coach_notes TEXT, ' +
      'actor TEXT, ' +
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
      'UNIQUE (student_id, academic_year, sport_code, course_type, skill_name))'
  );
  detailTableReady = true;
}

function checkCourseParams(academicYear, courseType, sportName) {
  const year = Number(academicYear);
  if (!Number.isInteger(year) || !courseType || !sportName) {
    throw new Error('กรุณาเลือกชนิดกีฬา ปีการศึกษา และคอร์สให้ครบถ้วน');
  }
  if (!COURSE_TYPES.includes(courseType)) throw new Error('ไม่รู้จักคอร์ส "' + courseType + '"');
  const skills = getSkillsForSport(sportName); // throw ถ้าไม่รู้จักกีฬานี้
  const sportCode = SPORT_CODE_BY_NAME[sportName] || null;
  return { year, skills, sportCode };
}

/**
 * getCourseRoster: รายชื่อนักเรียนที่ลงคอร์สนี้ (จากต้นขั้ว Course_Register ที่ซิงก์ขึ้นมา) พร้อมระดับตั้งต้นรายทักษะ
 * - ถ้าเคยบันทึกคะแนนคอร์สนี้แล้ว ใช้ค่าที่บันทึกไว้ (saved = true)
 * - ถ้ายังไม่เคย ใช้ระดับต่อยอดจากประวัติภาคปกติ (logic เดียวกับหน้ากรอกคะแนนเดิม)
 */
export async function getCourseRoster(academicYear, courseType, sportName) {
  const { year, sportCode } = checkCourseParams(academicYear, courseType, sportName);
  if (!sportCode) return [];
  await ensureCourseTable();
  await ensureCourseDetailTable();

  const enrolled = await prisma.$queryRaw`
    SELECT student_id, student_name, class_name
    FROM course_skill_logs
    WHERE academic_year = ${year} AND sport_code = ${sportCode} AND course_type = ${courseType}
    ORDER BY class_name, student_id
  `;
  if (enrolled.length === 0) return [];

  const ids = enrolled.map((e) => e.student_id);
  const details = await prisma.$queryRaw`
    SELECT student_id, skill_name, final_level, coach_notes
    FROM course_skill_details
    WHERE academic_year = ${year} AND sport_code = ${sportCode} AND course_type = ${courseType}
  `;
  const savedByStudent = {};
  details.forEach((d) => {
    if (!savedByStudent[d.student_id]) savedByStudent[d.student_id] = { levels: {}, note: '' };
    savedByStudent[d.student_id].levels[d.skill_name] = Number(d.final_level);
    if (d.coach_notes) savedByStudent[d.student_id].note = d.coach_notes;
  });

  const allLogs = await prisma.skillLog.findMany({ where: { studentId: { in: ids } } });
  const logsByStudent = {};
  allLogs.forEach((log) => {
    if (!logsByStudent[log.studentId]) logsByStudent[log.studentId] = [];
    logsByStudent[log.studentId].push(log);
  });

  return enrolled.map((e) => {
    const base = computeStartingLevels(year, sportName, logsByStudent[e.student_id] || []);
    const saved = savedByStudent[e.student_id];
    return {
      studentId: e.student_id,
      studentName: e.student_name || e.student_id,
      className: e.class_name || '',
      isCarryOver: base.isCarryOver,
      previousSport: base.previousSport,
      saved: !!saved,
      note: saved ? saved.note : '',
      skills: base.skills.map((s) => ({
        skillName: s.skillName,
        startingLevel: saved && saved.levels[s.skillName] ? saved.levels[s.skillName] : s.startingLevel,
      })),
    };
  });
}

/**
 * saveCourseSkillScores: บันทึกระดับรายทักษะของคอร์ส (บันทึกซ้ำได้ = แก้ไขค่าเดิม)
 * และอัปเดต LV.ใหม่ ของคอร์สนั้นเป็นค่าเฉลี่ยปัดเศษของทุกทักษะ (เช่น เฉลี่ย 2.6 -> "L3")
 * scores: [{ studentId, skillName, finalLevel, coachNotes }]
 */
export async function saveCourseSkillScores({ academicYear, courseType, sportName, scores, actor }) {
  const { year, skills, sportCode } = checkCourseParams(academicYear, courseType, sportName);
  if (!sportCode) throw new Error('กีฬา "' + sportName + '" ยังไม่มีรหัสวิชาสำหรับคอร์สพิเศษ');
  if (!actor || !String(actor).trim()) throw new Error('กรุณาระบุรหัสประจำตัวครูผู้บันทึก (actor) ก่อนบันทึกคะแนน');
  if (!Array.isArray(scores) || scores.length === 0) throw new Error('ไม่มีข้อมูลคะแนนที่จะบันทึก');

  const cleaned = scores.map((e) => {
    const studentId = textOrNull(e.studentId);
    const level = Number(e.finalLevel);
    if (!studentId) throw new Error('รายการคะแนนไม่มีรหัสประจำตัวนักเรียน');
    if (!skills.includes(e.skillName)) throw new Error('ไม่รู้จักทักษะ "' + e.skillName + '" ของกีฬานี้');
    if (!Number.isInteger(level) || level < 1 || level > 6) throw new Error('ระดับไม่ถูกต้อง: "' + e.finalLevel + '" (ต้องเป็นเลข 1-6)');
    return { studentId, skillName: e.skillName, level, note: textOrNull(e.coachNotes) };
  });

  await ensureCourseTable();
  await ensureCourseDetailTable();
  const actorName = String(actor).trim();
  const byStudent = {};

  await prisma.$transaction(async (tx) => {
    for (const c of cleaned) {
      await tx.$executeRaw`
        INSERT INTO course_skill_details
          (student_id, academic_year, sport_code, course_type, skill_name, final_level, coach_notes, actor, updated_at)
        VALUES
          (${c.studentId}, ${year}, ${sportCode}, ${courseType}, ${c.skillName}, ${c.level}, ${c.note}, ${actorName}, now())
        ON CONFLICT (student_id, academic_year, sport_code, course_type, skill_name) DO UPDATE SET
          final_level = EXCLUDED.final_level,
          coach_notes = EXCLUDED.coach_notes,
          actor = EXCLUDED.actor,
          updated_at = now()
      `;
      if (!byStudent[c.studentId]) byStudent[c.studentId] = [];
      byStudent[c.studentId].push(c.level);
    }
    for (const studentId of Object.keys(byStudent)) {
      const levels = byStudent[studentId];
      const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
      const levelNew = 'L' + Math.min(6, Math.max(1, Math.round(avg)));
      await tx.$executeRaw`
        UPDATE course_skill_logs SET level_new = ${levelNew}, updated_at = now()
        WHERE student_id = ${studentId} AND academic_year = ${year} AND sport_code = ${sportCode} AND course_type = ${courseType}
      `;
    }
    await tx.auditLog.create({
      data: {
        action: 'SAVE_COURSE_SCORES',
        actor: actorName,
        academicYear: year,
        sport: sportName,
        studentCount: Object.keys(byStudent).length,
        details: courseType + ' / ' + cleaned.length + ' แถว / ' + Object.keys(byStudent).length + ' คน',
      },
    });
  }, { maxWait: 10000, timeout: 60000 });

  return { rowsSaved: cleaned.length };
}
