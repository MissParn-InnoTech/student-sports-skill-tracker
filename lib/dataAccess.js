/**
 * dataAccess.js
 * -----------------------------------------------------------------------
 * ชั้นเชื่อม lib/skillLogic.js (pure logic) เข้ากับฐานข้อมูลจริงผ่าน Prisma
 * เทียบเท่ากับ Code.gs + Api.gs เดิมใน Google Apps Script รวมกัน
 */
import { prisma } from './db.js';
import { getAllSportsWithDefs, getSkillsForSport } from './sportsConfig.js';
import { computeStartingLevels, groupLogsIntoRounds, latestRound, validateScoreEntry, avgOf } from './skillLogic.js';
import { buildGradeTimeline } from './gradeUtils.js';
import { computeSportAnalytics } from './analyticsLogic.js';

/** ปีการศึกษาเริ่มต้นสำหรับ dropdown: ใช้ปีสูงสุดของนักเรียนถ้ามี ไม่งั้นคำนวณจากวันนี้ (ปี พ.ศ.) */
function computeDefaultAcademicYear(students) {
  let max = 0;
  students.forEach((s) => {
    if (s.currentAcademicYear && s.currentAcademicYear > max) max = s.currentAcademicYear;
  });
  if (max > 0) return max;
  const now = new Date();
  let y = now.getFullYear() + 543;
  if (now.getMonth() < 4) y -= 1; // ก่อนพ.ค. ยังนับเป็นปีการศึกษาก่อนหน้า
  return y;
}

/** getInitialData: ข้อมูลตั้งต้นของหน้าแรก (กีฬา/ทักษะ/นักเรียน/ชั้นเรียน/ปี) */
export async function getInitialData() {
  const students = await prisma.student.findMany({ orderBy: { name: 'asc' } });
  const classesSet = new Set(students.map((s) => s.className).filter(Boolean));
  const yearsSet = new Set(students.map((s) => s.currentAcademicYear).filter(Boolean));

  // เติมปีการศึกษาจาก log ด้วย เผื่อมีปีเก่าที่ไม่มีใน currentAcademicYear ของใครแล้ว
  const distinctYears = await prisma.skillLog.findMany({
    select: { academicYear: true },
    distinct: ['academicYear'],
  });
  distinctYears.forEach((r) => yearsSet.add(r.academicYear));

  const years = [...yearsSet].sort((a, b) => b - a);
  const classes = [...classesSet].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));

  return {
    sports: getAllSportsWithDefs(),
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      className: s.className,
      year: s.currentAcademicYear,
      status: s.status,
    })),
    classes,
    years,
    defaultYear: computeDefaultAcademicYear(students),
  };
}

/**
 * getStudentsByClassAndSport: รายชื่อนักเรียนในห้อง+กีฬาที่เลือก พร้อม Year-to-Year Logic
 * (เทียบเท่า getStudentsByClassAndSport เดิมใน Code.gs)
 */
export async function getStudentsByClassAndSport(academicYear, className, selectedSport) {
  if (!academicYear || !className || !selectedSport) {
    throw new Error('กรุณาระบุปีการศึกษา ชั้นเรียน และชนิดกีฬาให้ครบถ้วน');
  }
  getSkillsForSport(selectedSport); // throw ถ้าไม่รู้จักกีฬานี้

  const students = await prisma.student.findMany({
    where: { className, status: 'Active' },
    orderBy: { name: 'asc' },
  });

  const studentIds = students.map((s) => s.id);
  const allLogs = studentIds.length
    ? await prisma.skillLog.findMany({ where: { studentId: { in: studentIds } } })
    : [];

  const logsByStudent = {};
  allLogs.forEach((log) => {
    if (!logsByStudent[log.studentId]) logsByStudent[log.studentId] = [];
    logsByStudent[log.studentId].push(log);
  });

  return students.map((student) => {
    const result = computeStartingLevels(Number(academicYear), selectedSport, logsByStudent[student.id] || []);
    return {
      studentId: student.id,
      studentName: student.name,
      isCarryOver: result.isCarryOver,
      previousSport: result.previousSport,
      skills: result.skills,
    };
  });
}

/**
 * saveBulkScores: บันทึกคะแนนหลายทักษะ/หลายนักเรียนพร้อมกัน + เขียน Audit Log
 * Postgres จัดการ concurrency ของแต่ละ request ให้เองอยู่แล้ว (ต่างจาก Sheets ที่ต้องใช้ LockService)
 * เพราะ INSERT หลายแถวไม่ได้แย่งกันเขียน "ตำแหน่งแถวเดียวกัน" แบบ spreadsheet
 */
export async function saveBulkScores(scoresData, actorEmail) {
  if (!scoresData || !Array.isArray(scoresData) || scoresData.length === 0) {
    throw new Error('ไม่มีข้อมูลคะแนนที่จะบันทึก (scoresData ว่างเปล่า)');
  }
  scoresData.forEach(validateScoreEntry);

  const timestamp = new Date();
  const uniqueStudents = new Set(scoresData.map((e) => e.studentId));
  const sportsSeen = new Set(scoresData.map((e) => e.selectedSport));

  const result = await prisma.$transaction(async (tx) => {
    await tx.skillLog.createMany({
      data: scoresData.map((entry) => ({
        timestamp,
        academicYear: Number(entry.academicYear),
        studentId: entry.studentId,
        studentName: entry.studentName,
        selectedSport: entry.selectedSport,
        skillName: entry.skillName,
        finalLevel: Number(entry.finalLevel),
        coachNotes: entry.coachNotes || null,
      })),
    });

    await tx.auditLog.create({
      data: {
        timestamp,
        action: 'SAVE_SCORES',
        actor: actorEmail || '(ไม่ทราบผู้ใช้)',
        academicYear: Number(scoresData[0].academicYear),
        sport: [...sportsSeen].join(', '),
        studentCount: uniqueStudents.size,
        details: scoresData.length + ' แถว / ' + uniqueStudents.size + ' คน',
      },
    });

    return scoresData.length;
  });

  return { rowsSaved: result };
}

/** getStudentDashboard: ประวัติการประเมินทั้งหมดของนักเรียน 1 คน แบ่งเป็น "รอบ" */
export async function getStudentDashboard(studentId) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error('ไม่พบนักเรียนรหัส "' + studentId + '"');

  const logs = await prisma.skillLog.findMany({ where: { studentId }, orderBy: { timestamp: 'asc' } });
  const rounds = groupLogsIntoRounds(logs).sort((a, b) => a.year - b.year || a.ts - b.ts);

  // เส้นเวลาผลการประเมินตั้งแต่ ป.1 จนถึงชั้นปัจจุบัน (ป.1-ป.6 / ม.1-ม.3) - ช่องไหนไม่มีข้อมูลจะเว้นว่างไว้
  const gradeTimeline = buildGradeTimeline(student.className, student.currentAcademicYear, rounds);

  return {
    student: { id: student.id, name: student.name, className: student.className, status: student.status },
    rounds,
    gradeTimeline,
  };
}

/** getClassReport: สรุปผลล่าสุดของทั้งห้องในปีที่เลือก (sport ว่าง = ทุกกีฬา) */
export async function getClassReport(academicYear, className, sport) {
  if (!academicYear || !className) throw new Error('กรุณาระบุปีการศึกษาและชั้นเรียนให้ครบถ้วน');
  const year = Number(academicYear);
  const sportFilter = sport ? String(sport).trim() : '';

  const students = await prisma.student.findMany({
    where: { className, status: 'Active' },
    orderBy: { name: 'asc' },
  });
  const studentIds = students.map((s) => s.id);

  const yearLogs = studentIds.length
    ? await prisma.skillLog.findMany({
        where: { studentId: { in: studentIds }, academicYear: year },
      })
    : [];

  const logsByStudent = {};
  yearLogs.forEach((log) => {
    if (!logsByStudent[log.studentId]) logsByStudent[log.studentId] = [];
    logsByStudent[log.studentId].push(log);
  });

  const rows = students.map((student) => {
    let studentLogs = logsByStudent[student.id] || [];
    if (sportFilter) studentLogs = studentLogs.filter((l) => l.selectedSport === sportFilter);
    if (studentLogs.length === 0) {
      return { studentId: student.id, studentName: student.name, sport: null, hasData: false, levels: {}, average: 0, ts: null };
    }
    const rounds = groupLogsIntoRounds(studentLogs);
    const latest = latestRound(rounds);
    const skillsForAvg = sportFilter ? getSkillsForSport(sportFilter) : Object.keys(latest.levels);
    return {
      studentId: student.id,
      studentName: student.name,
      sport: latest.sport,
      hasData: true,
      levels: latest.levels,
      average: avgOf(latest.levels, skillsForAvg),
      ts: latest.ts,
    };
  });

  rows.sort((a, b) => a.studentName.localeCompare(b.studentName, 'th'));
  const evaluated = rows.filter((r) => r.hasData);
  const classAverage = evaluated.length ? evaluated.reduce((sum, r) => sum + r.average, 0) / evaluated.length : 0;

  return {
    className,
    academicYear: year,
    sport: sportFilter || null,
    skills: sportFilter ? getSkillsForSport(sportFilter) : null,
    classAverage,
    evaluatedCount: evaluated.length,
    totalCount: rows.length,
    rows,
  };
}

/** getSystemOverview: แดชบอร์ดภาพรวมระบบ (Admin) */
export async function getSystemOverview() {
  const [activeStudents, totalStudents, allLogs, recentAuditRaw] = await Promise.all([
    prisma.student.findMany({ where: { status: 'Active' } }),
    prisma.student.count(),
    prisma.skillLog.findMany(),
    prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 15 }),
  ]);

  const classCounts = {};
  activeStudents.forEach((s) => {
    if (!s.className) return;
    classCounts[s.className] = (classCounts[s.className] || 0) + 1;
  });
  const byClass = Object.keys(classCounts)
    .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
    .map((className) => ({ className, count: classCounts[className] }));

  const logsByStudent = {};
  allLogs.forEach((log) => {
    if (!logsByStudent[log.studentId]) logsByStudent[log.studentId] = [];
    logsByStudent[log.studentId].push(log);
  });

  let totalRounds = 0;
  let lastActivityTs = 0;
  const sportCounts = {};
  Object.keys(logsByStudent).forEach((studentId) => {
    const rounds = groupLogsIntoRounds(logsByStudent[studentId]);
    totalRounds += rounds.length;
    const latest = latestRound(rounds);
    if (latest) {
      sportCounts[latest.sport] = (sportCounts[latest.sport] || 0) + 1;
      if (latest.ts > lastActivityTs) lastActivityTs = latest.ts;
    }
  });
  const bySportLatest = Object.keys(sportCounts)
    .map((sport) => ({ sport, count: sportCounts[sport] }))
    .sort((a, b) => b.count - a.count);

  // Executive Dashboard ขั้นสูง: Retention Rate by Sport + Average Time-to-Level-Up + Cumulative Achievement
  const sportAnalytics = computeSportAnalytics(logsByStudent);

  return {
    totalActiveStudents: activeStudents.length,
    totalAllStudents: totalStudents,
    totalLogRows: allLogs.length,
    totalEvaluationRounds: totalRounds,
    lastActivityTs: lastActivityTs || null,
    byClass,
    bySportLatest,
    sportAnalytics,
    recentActivity: recentAuditRaw.map((a) => ({
      ts: a.timestamp.getTime(),
      action: a.action,
      actor: a.actor,
      academicYear: a.academicYear,
      sport: a.sport,
      studentCount: a.studentCount,
      details: a.details,
    })),
  };
}
