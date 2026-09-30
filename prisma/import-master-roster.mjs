/**
 * prisma/import-master-roster.mjs
 * -----------------------------------------------------------------------
 * นำเข้ารายชื่อนักเรียนจริงทั้งโรงเรียน (ป.1-ม.3) + ผลประเมินทักษะจริง จากชีต "รวม"
 * ของ Master Sport Report ปีการศึกษา 2569 (data/master_roster_2569_raw.csv —
 * CSV ดิบ ตัดมาจากชีต "รวม" เท่านั้น ไม่รวมชีตย่อยรายกีฬา/EP/ชีต8)
 *
 * ทำ 2 อย่าง:
 *   1. สร้าง/อัปเดต Student record จริงทุกคน (id = รหัสประจำตัว, name, className,
 *      currentAcademicYear)
 *   2. สร้าง SkillLog จริง (ไม่ใช่มอคอัพ) เฉพาะแถวที่ LV.ใหม่ หรือ LV.เดิม เป็นรูปแบบ
 *      "L1".."L6" จริง (ไม่ใช่ค่าว่างหรือ "PL" = ยังไม่ได้ประเมิน/รอประเมิน) —
 *      ข้อมูลจริงมี Level รวมต่อกีฬา 1 ค่า ไม่ได้แยกเป็นรายทักษะ (Ball Control,
 *      Passing ฯลฯ) เหมือนที่ระบบรองรับ จึงสร้าง 1 แถว/คน/กีฬา โดยใช้
 *      skillName = "ภาพรวม (Overall)" ตามที่ผู้ใช้ยืนยัน
 *
 * การแมปรหัสวิชา (วิชา) -> ชื่อกีฬาเต็มใน SPORTS_MASTER: ตรวจสอบไขว้กับชีตย่อย
 * รายกีฬาที่แนบมาในไฟล์เดียวกันแล้ว (ดูตัวอย่างแถวจริงในแต่ละชีตย่อยที่มีรหัสตรงกัน)
 * ส่วน "เต้น (D)" ยังไม่มีในระบบ (SPORTS_MASTER) — ตามที่ผู้ใช้ยืนยันให้ข้ามไปก่อน
 * (นักเรียนกลุ่มนี้ยังได้ Student record ตามปกติ แค่ไม่มี SkillLog ของเต้น)
 *
 * กติกาการเลือกห้องจริงเมื่อนักเรียน 1 คนมีหลายแถว (เรียนหลายวิชา/กลุ่ม PE ต่างกัน):
 * ตัดแถวที่ วิชา = "ออก" (ถอน/เปลี่ยนวิชา) ทิ้งก่อน แล้วใช้ห้องจากแถวแรกที่เจอเป็นห้องจริง
 * (ตามที่ผู้ใช้ยืนยัน) — ยังมี 1 เคสข้อมูลขัดแย้งที่ตรวจพบ (รหัส 37068: ป.3/3 กับ ม.6/8
 * ในคนละแถว) จะถูกพิมพ์แจ้งเตือนแยกไว้ ไม่ import แถวขัดแย้งซ้ำ
 *
 * วิธีรัน (ต้องรันจากเครื่องที่มี POSTGRES_URL ของ production จริงใน .env เท่านั้น
 * เพราะ sandbox นี้เข้าถึง production DB ไม่ได้):
 *   npx prisma generate
 *   node prisma/import-master-roster.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const ACADEMIC_YEAR = 2569;

const REAL_NOTE = '[ผลประเมินจริง] นำเข้าจาก Master Sport Report (ชีต "รวม") — Level รวมของกีฬา ไม่ได้แยกรายทักษะ';

// รหัสวิชา -> ชื่อกีฬาเต็มใน SPORTS_MASTER (lib/sportsConfig.js)
// ยืนยันแล้วโดยเทียบกับตัวอย่างแถวจริงในชีตย่อยรายกีฬาที่แนบมาในไฟล์เดียวกัน
const sportCodeMap = {
  TN: 'เทนนิส (Tennis)',
  G: 'กอล์ฟ (Golf)',
  FS: 'ฟุตซอล (Futsal)',
  TK: 'เทควันโด (Taekwondo)',
  BX: 'มวย (Boxing/Muay Thai)',
  BK: 'บาสเกตบอล (Basketball)',
  TB: 'ปิงปอง (Table Tennis)',
  CB: 'ปีนหน้าผา (Rock Climbing)',
  // D = เต้น (Dance) — ยังไม่มีใน SPORTS_MASTER ตามที่ยืนยัน ข้ามไปก่อน (ดูคอมเมนต์ด้านบน)
};

function parseRow(line) {
  const c = line.split(',');
  return {
    studentId: (c[1] || '').trim(),
    prefix: (c[2] || '').trim(),
    firstName: (c[3] || '').trim(),
    lastName: (c[4] || '').trim(),
    grade: (c[5] || '').trim(),
    room: (c[6] || '').trim(),
    subjectCode: (c[9] || '').trim(),
    lvOld: (c[10] || '').trim(),
    lvNew: (c[11] || '').trim(),
  };
}

function parseLevel(value) {
  const m = /^L([1-6])$/.exec(value || '');
  return m ? Number(m[1]) : null;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'data', 'master_roster_2569_raw.csv');
  const lines = readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(1); // ตัดแถว header ทิ้ง

  const byId = new Map(); // studentId -> ข้อมูลห้องจริง (name/grade/room)
  const conflicts = [];
  const skillRows = []; // แถวที่จะสร้าง SkillLog จริง
  let skippedNoId = 0;
  let skippedUnmappedSport = 0;
  const unmappedSportCounts = {};

  for (const line of lines) {
    const row = parseRow(line);
    if (!row.studentId || !/^\d+$/.test(row.studentId)) {
      skippedNoId++;
      continue;
    }
    if (row.subjectCode === 'ออก') continue; // ตัดแถวถอน/เปลี่ยนวิชาทิ้ง ตามที่ยืนยัน

    const existing = byId.get(row.studentId);
    if (!existing) {
      byId.set(row.studentId, row);
    } else if (existing.grade !== row.grade || existing.room !== row.room) {
      conflicts.push({ studentId: row.studentId, a: `${existing.grade}/${existing.room}`, b: `${row.grade}/${row.room}` });
    }

    // --- ผลประเมินจริง (ถ้ามี) ---
    const level = parseLevel(row.lvNew) ?? parseLevel(row.lvOld);
    if (level !== null) {
      const sportName = sportCodeMap[row.subjectCode];
      if (!sportName) {
        skippedUnmappedSport++;
        unmappedSportCounts[row.subjectCode] = (unmappedSportCounts[row.subjectCode] || 0) + 1;
        continue;
      }
      skillRows.push({
        studentId: row.studentId,
        studentName: `${row.firstName} ${row.lastName}`.trim(),
        sportName,
        level,
      });
    }
  }

  let studentsCreated = 0;
  for (const [studentId, row] of byId) {
    const name = `${row.firstName} ${row.lastName}`.trim();
    const className = `${row.grade}/${row.room}`;
    await prisma.student.upsert({
      where: { id: studentId },
      update: { name, className, currentAcademicYear: ACADEMIC_YEAR, status: 'Active' },
      create: { id: studentId, name, className, currentAcademicYear: ACADEMIC_YEAR, status: 'Active' },
    });
    studentsCreated++;
  }

  let skillLogsCreated = 0;
  if (skillRows.length > 0) {
    const result = await prisma.skillLog.createMany({
      data: skillRows.map((r) => ({
        academicYear: ACADEMIC_YEAR,
        studentId: r.studentId,
        studentName: r.studentName,
        selectedSport: r.sportName,
        skillName: 'ภาพรวม (Overall)',
        finalLevel: r.level,
        coachNotes: REAL_NOTE,
      })),
    });
    skillLogsCreated = result.count;
  }

  await prisma.auditLog.create({
    data: {
      action: 'IMPORT_MASTER_ROSTER',
      actor: 'import-script',
      academicYear: ACADEMIC_YEAR,
      studentCount: studentsCreated,
      details: `นำเข้ารายชื่อนักเรียนจริงทั้งโรงเรียนจาก data/master_roster_2569_raw.csv (ชีต "รวม") — สำเร็จ ${studentsCreated} คน, สร้าง SkillLog จริง ${skillLogsCreated} รายการ (skillName="ภาพรวม (Overall)"), ข้ามผลประเมิน ${skippedUnmappedSport} รายการ (รหัสวิชายังไม่รองรับ: ${JSON.stringify(unmappedSportCounts)}), ข้าม ${skippedNoId} แถว (ไม่มีเลขประจำตัว), พบข้อมูลห้องขัดแย้ง ${conflicts.length} รายการ`,
    },
  });

  console.log(`== นำเข้าสำเร็จ ${studentsCreated} คน, สร้าง SkillLog จริง ${skillLogsCreated} รายการ ==`);
  if (skippedUnmappedSport > 0) {
    console.log(`== ข้ามผลประเมิน ${skippedUnmappedSport} รายการ (รหัสวิชายังไม่รองรับ) ==`);
    Object.entries(unmappedSportCounts).forEach(([code, n]) => console.log(`  - ${code}: ${n} รายการ`));
  }
  if (skippedNoId > 0) console.log(`== ข้าม ${skippedNoId} แถว (ไม่มีเลขประจำตัว) ==`);
  if (conflicts.length > 0) {
    console.log(`== พบข้อมูลห้องขัดแย้งกัน ${conflicts.length} รายการ (ใช้ห้องแรกที่เจอ) ==`);
    conflicts.forEach((c) => console.log(`  - รหัส ${c.studentId}: ${c.a}  vs  ${c.b}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
