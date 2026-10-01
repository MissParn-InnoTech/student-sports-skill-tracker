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
import { computeSportAnalytics, computeYearlyPopularity, computeSportSwitchingRates } from './analyticsLogic.js';
import { syncStudentUpsert, syncStudentDelete, syncSkillLogsAppend } from './sheetsSync.js';

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

  const { createdLogs, count } = await prisma.$transaction(async (tx) => {
    const created = await tx.skillLog.createManyAndReturn({
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

    return { createdLogs: created, count: created.length };
  });

  // sync ไป Google Sheet (best-effort, ทำหลัง commit transaction เสร็จแล้ว)
  await syncSkillLogsAppend(createdLogs);

  return { rowsSaved: count };
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

/**
 * ===========================================================================
 * Admin: จัดการข้อมูลนักเรียน + ตั้งค่ารายปีการศึกษา (หน้า /admin/students)
 * ===========================================================================
 */

/** listAllStudentsAdmin: รายชื่อนักเรียนทั้งหมด (รวม Inactive) สำหรับหน้าจัดการ */
export async function listAllStudentsAdmin() {
  const students = await prisma.student.findMany({
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
  });
  return students.map((s) => ({
    id: s.id,
    name: s.name,
    className: s.className,
    currentAcademicYear: s.currentAcademicYear,
    assignedSport: s.assignedSport,
    status: s.status,
  }));
}

/** createStudentAdmin: เพิ่มนักเรียนใหม่ทีละคน */
export async function createStudentAdmin({ id, name, className, currentAcademicYear, assignedSport }, actorEmail) {
  if (!id || !name || !className || !currentAcademicYear) {
    throw new Error('กรุณากรอกเลขประจำตัว ชื่อ-นามสกุล ชั้นเรียน และปีการศึกษาให้ครบ');
  }
  const existing = await prisma.student.findUnique({ where: { id: String(id).trim() } });
  if (existing) throw new Error(`มีนักเรียนเลขประจำตัว "${id}" อยู่แล้วในระบบ (${existing.name})`);

  const student = await prisma.student.create({
    data: {
      id: String(id).trim(),
      name: String(name).trim(),
      className: String(className).trim(),
      currentAcademicYear: Number(currentAcademicYear),
      assignedSport: assignedSport ? String(assignedSport).trim() : null,
      status: 'Active',
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_ADD_STUDENT',
      actor: actorEmail || '(ไม่ทราบผู้ใช้)',
      academicYear: student.currentAcademicYear,
      studentCount: 1,
      details: `เพิ่มนักเรียนใหม่: ${student.id} ${student.name} (${student.className})`,
    },
  });

  await syncStudentUpsert(student);
  return student;
}

/** updateStudentAdmin: แก้ไขชื่อ/ชั้นเรียน/ปีการศึกษา/กีฬาที่กำหนด/สถานะของนักเรียน 1 คน */
export async function updateStudentAdmin(id, { name, className, currentAcademicYear, assignedSport, status }, actorEmail) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw new Error(`ไม่พบนักเรียนเลขประจำตัว "${id}"`);

  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (className !== undefined) data.className = String(className).trim();
  if (currentAcademicYear !== undefined) data.currentAcademicYear = Number(currentAcademicYear);
  if (assignedSport !== undefined) data.assignedSport = assignedSport ? String(assignedSport).trim() : null;
  if (status !== undefined) {
    if (!['Active', 'Inactive', 'Graduated'].includes(status)) {
      throw new Error('สถานะต้องเป็น Active, Inactive หรือ Graduated เท่านั้น');
    }
    data.status = status;
  }

  const student = await prisma.student.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_EDIT_STUDENT',
      actor: actorEmail || '(ไม่ทราบผู้ใช้)',
      studentCount: 1,
      details: `แก้ไขนักเรียน ${id}: ${JSON.stringify(data)}`,
    },
  });

  await syncStudentUpsert(student);
  return student;
}

/**
 * deleteStudentAdmin: ลบนักเรียนออกจากระบบถาวร (รวมประวัติผลประเมินทั้งหมด เพราะ onDelete: Cascade)
 * แนะนำให้ใช้ updateStudentAdmin(id, { status: 'Inactive' }) แทนในกรณีทั่วไป
 * ฟังก์ชันนี้ไว้สำหรับแก้ไขข้อมูลที่กรอกผิด/ซ้ำจริงๆ เท่านั้น
 */
export async function deleteStudentAdmin(id, actorEmail) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw new Error(`ไม่พบนักเรียนเลขประจำตัว "${id}"`);

  await prisma.student.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_DELETE_STUDENT',
      actor: actorEmail || '(ไม่ทราบผู้ใช้)',
      studentCount: 1,
      details: `ลบนักเรียน ${id} (${existing.name}, ${existing.className}) ออกจากระบบถาวร พร้อมประวัติผลประเมินทั้งหมด`,
    },
  });

  await syncStudentDelete(id);
  return { deleted: true };
}

/**
 * advanceAcademicYear: "เริ่มปีการศึกษาใหม่" — อัปเดต currentAcademicYear ของนักเรียนที่ Active
 * ทั้งหมด (หรือเฉพาะห้องที่เลือก) ให้เป็นปีใหม่ตามที่ระบุ โดย "ไม่" เปลี่ยน className ให้อัตโนมัติ
 * (เจ้าหน้าที่ต้องไปแก้ไข className ของแต่ละคน/ห้องเองผ่าน updateStudentAdmin เมื่อมีการเลื่อนชั้นจริง)
 */
export async function advanceAcademicYear(newYear, actorEmail, classNameFilter) {
  const year = Number(newYear);
  if (!year || year < 2500) throw new Error('กรุณาระบุปีการศึกษา (พ.ศ.) ที่ถูกต้อง');

  const where = { status: 'Active' };
  if (classNameFilter) where.className = classNameFilter;

  const result = await prisma.student.updateMany({ where, data: { currentAcademicYear: year } });

  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_ADVANCE_ACADEMIC_YEAR',
      actor: actorEmail || '(ไม่ทราบผู้ใช้)',
      academicYear: year,
      studentCount: result.count,
      details: classNameFilter
        ? `ตั้งค่าปีการศึกษาปัจจุบันเป็น ${year} เฉพาะห้อง ${classNameFilter} (${result.count} คน) — ไม่เลื่อนชั้นอัตโนมัติ`
        : `ตั้งค่าปีการศึกษาปัจจุบันเป็น ${year} ให้นักเรียน Active ทั้งหมด (${result.count} คน) — ไม่เลื่อนชั้นอัตโนมัติ`,
    },
  });

  if (result.count > 0) {
    const updated = await prisma.student.findMany({ where });
    for (const s of updated) await syncStudentUpsert(s);
  }

  return { updatedCount: result.count, year };
}

/**
 * bulkAssignClassAndSport: ส่วนหนึ่งของ workflow "ตั้งค่าปีการศึกษาใหม่" —
 * จัดห้องเรียนใหม่ + ระบุชนิดกีฬาที่จะเล่นในปีการศึกษานั้น ให้นักเรียนหลายคนพร้อมกัน
 * (className และ/หรือ assignedSport อย่างใดอย่างหนึ่งก็ได้ ไม่บังคับทั้งคู่)
 * assignedSport เป็นแค่ค่า default สำหรับหน้ากรอกคะแนน ไม่ใช่ข้อมูลผลประเมินจริง
 */
export async function bulkAssignClassAndSport(studentIds, { className, assignedSport }, actorEmail) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new Error('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');
  }
  if (className === undefined && assignedSport === undefined) {
    throw new Error('กรุณาระบุห้องเรียนใหม่ และ/หรือ ชนิดกีฬาที่ต้องการตั้งค่า');
  }

  const data = {};
  if (className !== undefined) data.className = String(className).trim();
  if (assignedSport !== undefined) data.assignedSport = assignedSport ? String(assignedSport).trim() : null;

  const result = await prisma.student.updateMany({ where: { id: { in: studentIds } }, data });

  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_BULK_ASSIGN_CLASS_SPORT',
      actor: actorEmail || '(ไม่ทราบผู้ใช้)',
      studentCount: result.count,
      details: `จัดห้อง/กำหนดกีฬาให้นักเรียน ${result.count} คน: ${JSON.stringify(data)} (studentIds: ${studentIds.join(', ')})`,
    },
  });

  if (result.count > 0) {
    const updated = await prisma.student.findMany({ where: { id: { in: studentIds } } });
    for (const s of updated) await syncStudentUpsert(s);
  }

  return { updatedCount: result.count };
}

/**
 * ===========================================================================
 * รับข้อมูลย้อนกลับจาก Google Sheet (Apps Script onEdit -> webhook)
 * ดู app/api/external/sheet-webhook/route.js
 * ไม่ sync กลับไปที่ Sheet อีกรอบ (แถวนั้นถูกแก้ที่ Sheet อยู่แล้ว)
 * ===========================================================================
 */

/** upsertStudentFromSheet: สร้าง/อัปเดตนักเรียนจากแถวที่ถูกแก้ในแท็บ Student_DB */
export async function upsertStudentFromSheet(row) {
  const id = String(row.id || '').trim();
  if (!id) throw new Error('แถวใน Student_DB ไม่มีเลขประจำตัว (คอลัมน์ A)');

  const data = {
    name: row.name ? String(row.name).trim() : undefined,
    className: row.className ? String(row.className).trim() : undefined,
    currentAcademicYear: row.currentAcademicYear ? Number(row.currentAcademicYear) : undefined,
    assignedSport: row.assignedSport !== undefined ? (row.assignedSport ? String(row.assignedSport).trim() : null) : undefined,
    status: row.status || undefined,
  };

  const existing = await prisma.student.findUnique({ where: { id } });
  let student;
  if (existing) {
    const patch = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) patch[k] = v;
    });
    student = await prisma.student.update({ where: { id }, data: patch });
  } else {
    if (!data.name || !data.className || !data.currentAcademicYear) {
      throw new Error(`แถวใหม่ในชีต Student_DB (id=${id}) ต้องมีชื่อ ชั้นเรียน และปีการศึกษาครบก่อนถึงจะสร้างนักเรียนใหม่ได้`);
    }
    student = await prisma.student.create({
      data: { id, name: data.name, className: data.className, currentAcademicYear: data.currentAcademicYear, assignedSport: data.assignedSport || null, status: 'Active' },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: existing ? 'SHEET_EDIT_STUDENT' : 'SHEET_ADD_STUDENT',
      actor: 'Google Sheet (Master Sport Report)',
      studentCount: 1,
      details: `${existing ? 'แก้ไข' : 'เพิ่ม'}นักเรียนจาก Google Sheet: ${id} ${student.name}`,
    },
  });

  return student;
}

/** upsertSkillLogFromSheet: สร้างผลประเมินใหม่ หรือแก้ไขผลประเมินเดิม (จับคู่ด้วย SkillLog.id คอลัมน์ A) จากแท็บ Skill_Logs */
export async function upsertSkillLogFromSheet(row) {
  const rawId = row.id !== undefined && row.id !== '' ? Number(row.id) : null;

  if (rawId) {
    const existing = await prisma.skillLog.findUnique({ where: { id: rawId } });
    if (!existing) throw new Error(`ไม่พบผลประเมิน id=${rawId} ในระบบ (แก้ id ในชีตไม่ได้ ต้องตรงกับของเดิม)`);
    const updated = await prisma.skillLog.update({
      where: { id: rawId },
      data: {
        finalLevel: row.finalLevel !== undefined ? Number(row.finalLevel) : undefined,
        coachNotes: row.coachNotes !== undefined ? String(row.coachNotes || '') : undefined,
        selectedSport: row.selectedSport || undefined,
        skillName: row.skillName || undefined,
      },
    });
    await prisma.auditLog.create({
      data: { action: 'SHEET_EDIT_SKILL_LOG', actor: 'Google Sheet (Master Sport Report)', details: `แก้ไขผลประเมิน id=${rawId} จาก Google Sheet` },
    });
    return updated;
  }

  const required = ['academicYear', 'studentId', 'studentName', 'selectedSport', 'skillName', 'finalLevel'];
  const missing = required.filter((k) => row[k] === undefined || row[k] === '');
  if (missing.length) throw new Error(`แถวใหม่ในชีต Skill_Logs ขาดข้อมูล: ${missing.join(', ')}`);

  const created = await prisma.skillLog.create({
    data: {
      academicYear: Number(row.academicYear),
      studentId: String(row.studentId),
      studentName: String(row.studentName),
      selectedSport: String(row.selectedSport),
      skillName: String(row.skillName),
      finalLevel: Number(row.finalLevel),
      coachNotes: row.coachNotes || null,
    },
  });
  await prisma.auditLog.create({
    data: { action: 'SHEET_ADD_SKILL_LOG', actor: 'Google Sheet (Master Sport Report)', details: `เพิ่มผลประเมินใหม่ id=${created.id} จาก Google Sheet` },
  });
  return created;
}

/**
 * upsertOverallSkillLogFromGradeSheet: sync แถวจากแท็บ "Data_Entry" ของชีต Grade_<กีฬา>
 * (เช่น Grade_Futsal, Grade_Basketball ฯลฯ) — ชีตเหล่านี้มี Level รวมต่อกีฬา 1 ค่า
 * (คอลัมน์ LV.ใหม่ หรือ LV.เดิม ถ้า LV.ใหม่ยังว่าง) ไม่ได้แยกรายทักษะ เหมือนกับที่ระบบนำเข้า
 * Master Sport Report (prisma/import-master-roster.mjs) จึงใช้ skillName = "ภาพรวม (Overall)"
 * เดียวกัน และ upsert จริง (ไม่สร้างแถวซ้ำทุกครั้งที่ครูแก้ไขช่องเดิม) โดยจับคู่ด้วย
 * unique key (studentId, academicYear, selectedSport, skillName) — ต้อง `prisma db push`
 * หลังเพิ่ม @@unique นี้ใน schema.prisma ก่อนใช้งานฟังก์ชันนี้
 *
 * row ที่ Apps Script (GradeSheetSync.gs) ส่งมา: { academicYear, studentId, studentName,
 *   className, selectedSport (hardcode ต่อไฟล์), finalLevel (แปลงจาก "L1".."L6" เป็นเลขแล้ว) }
 * ถ้า finalLevel เป็น null (เช่นค่า "PL" = ยังไม่ได้ประเมิน) จะไม่ sync อะไร (return null)
 *
 * หมายเหตุ: ชั่วคราวใช้ findFirst + update/create แทน prisma.skillLog.upsert(ด้วย compound unique key)
 * เพราะ @@unique([studentId, academicYear, selectedSport, skillName]) ถูกถอดออกจาก schema ชั่วคราว
 * (ดูหมายเหตุใน schema.prisma) จนกว่าจะยืนยันว่าไม่มีแถวซ้ำอยู่แล้วในข้อมูลจริง แล้วค่อยเพิ่ม
 * constraint กลับมาพร้อมเปลี่ยนมาใช้ upsert จริงอีกครั้ง — ระหว่างนี้ยังกันแถวซ้ำได้เหมือนเดิม
 * เพียงแต่เป็น race-condition-safe น้อยกว่า upsert ระดับ DB (ยอมรับได้ เพราะมาจาก onEdit ทีละแถว)
 */
export const OVERALL_SKILL_NAME = 'ภาพรวม (Overall)';

export async function upsertOverallSkillLogFromGradeSheet(row) {
  const studentId = String(row.studentId || '').trim();
  const selectedSport = String(row.selectedSport || '').trim();
  if (!studentId) throw new Error('แถวจาก Grade Sheet ไม่มีรหัสประจำตัวนักเรียน');
  if (!selectedSport) throw new Error('แถวจาก Grade Sheet ไม่ได้ระบุชื่อกีฬา (selectedSport)');

  if (row.finalLevel === null || row.finalLevel === undefined || row.finalLevel === '') {
    return null; // ยังไม่ได้ประเมิน (เช่น "PL") - ไม่มีอะไรให้ sync
  }
  const finalLevel = Number(row.finalLevel);
  if (!Number.isInteger(finalLevel) || finalLevel < 1 || finalLevel > 6) {
    throw new Error(`finalLevel ไม่ถูกต้อง: "${row.finalLevel}" (ต้องเป็นเลข 1-6)`);
  }

  // รับประกันว่ามี Student record ก่อน (เผื่อนักเรียนคนนี้ยังไม่เคยถูก import เข้าระบบ)
  if (row.studentName || row.className) {
    await prisma.student.upsert({
      where: { id: studentId },
      update: {
        ...(row.studentName ? { name: String(row.studentName) } : {}),
        ...(row.className ? { className: String(row.className) } : {}),
      },
      create: {
        id: studentId,
        name: row.studentName ? String(row.studentName) : studentId,
        className: row.className ? String(row.className) : 'ไม่ระบุ',
        currentAcademicYear: Number(row.academicYear) || undefined,
        status: 'Active',
      },
    });
  }

  const academicYear = Number(row.academicYear);
  const existing = await prisma.skillLog.findFirst({
    where: { studentId, academicYear, selectedSport, skillName: OVERALL_SKILL_NAME },
    orderBy: { id: 'asc' }, // ถ้าดันมีแถวซ้ำเก่าอยู่แล้ว ใช้แถวแรกสุดเป็นแถวหลักเสมอ กัน sync ไป-มา
  });

  let log;
  if (existing) {
    log = await prisma.skillLog.update({
      where: { id: existing.id },
      data: {
        finalLevel,
        studentName: row.studentName ? String(row.studentName) : undefined,
        coachNotes: row.coachNotes !== undefined ? String(row.coachNotes || '') : undefined,
      },
    });
  } else {
    log = await prisma.skillLog.create({
      data: {
        academicYear,
        studentId,
        studentName: row.studentName ? String(row.studentName) : studentId,
        selectedSport,
        skillName: OVERALL_SKILL_NAME,
        finalLevel,
        coachNotes: row.coachNotes || '[ผลประเมินจริง] ซิงก์อัตโนมัติจาก Google Sheet (Grade_' + selectedSport + ')',
      },
    });
  }

  return log;
}

/**
 * findDuplicateSkillLogGroups: หาแถว SkillLog ที่ซ้ำกันตามคีย์ (studentId, academicYear,
 * selectedSport, skillName) ที่ตั้งใจจะใช้เป็น @@unique — ใช้ตรวจสอบก่อนเพิ่ม constraint
 * กลับเข้า schema.prisma จริง (ดูหมายเหตุใน schema.prisma และฟังก์ชันด้านบน)
 * ใช้ชั่วคราวเท่านั้น ผ่าน /api/external/debug-duplicate-skill-logs แล้วลบทิ้งได้หลังเคลียร์ปัญหา
 */
export async function findDuplicateSkillLogGroups() {
  const groups = await prisma.$queryRaw`
    SELECT student_id, academic_year, selected_sport, skill_name, COUNT(*)::int AS count,
           array_agg(id ORDER BY id) AS ids
    FROM skill_logs
    GROUP BY student_id, academic_year, selected_sport, skill_name
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 200
  `;
  return groups;
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
  // Annual Sports Interest & Trend Analytics: ความนิยมกีฬารายปี + อัตราการย้ายสายกีฬา
  const yearlyPopularity = computeYearlyPopularity(logsByStudent);
  const sportSwitching = computeSportSwitchingRates(logsByStudent);

  return {
    totalActiveStudents: activeStudents.length,
    totalAllStudents: totalStudents,
    totalLogRows: allLogs.length,
    totalEvaluationRounds: totalRounds,
    lastActivityTs: lastActivityTs || null,
    byClass,
    bySportLatest,
    sportAnalytics,
    yearlyPopularity,
    sportSwitching,
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
