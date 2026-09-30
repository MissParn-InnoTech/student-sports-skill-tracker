/**
 * prisma/import-master-roster.mjs
 * -----------------------------------------------------------------------
 * นำเข้ารายชื่อนักเรียนจริงทั้งโรงเรียน (ป.1-ม.3) จากชีต "รวม" ของ Master Sport
 * Report ปีการศึกษา 2569 (data/master_roster_2569_raw.csv — CSV ดิบ ตัดมาจากชีต
 * "รวม" เท่านั้น ไม่รวมชีตย่อยรายกีฬา/EP/ชีต8)
 *
 * ทำอย่างเดียว: สร้าง/อัปเดต Student record จริง (id = รหัสประจำตัว, name, className,
 * currentAcademicYear) — **ไม่สร้าง SkillLog** เพราะตรวจสอบข้อมูลทั้งไฟล์แล้วพบว่า
 * คอลัมน์ LV.เดิม/LV.ใหม่ ทุกแถวยังว่างหรือเป็น "PL" (ยังไม่ได้ประเมิน/รอประเมิน)
 * ไม่มีแถวไหนมีตัวเลข Level จริงเลย ดังนั้นยังไม่มีผลประเมินจริงให้นำเข้า
 * (สคริปต์นี้ยังเช็กคอลัมน์ LV. ไว้เผื่ออนาคต — ถ้าครูกรอก Level เป็นตัวเลขในไฟล์ชุดนี้
 * แล้วรันสคริปต์ซ้ำ จะสร้าง SkillLog ให้อัตโนมัติ แต่การแมป "วิชา" (รหัสกีฬา 2-3 ตัวอักษร
 * เช่น TN, G, FS) ไปเป็นชื่อกีฬาเต็มใน SPORTS_MASTER ยังไม่ครบทุกตัว/ยังไม่ยืนยัน 100%
 * โปรดตรวจสอบ sportCodeMap ด้านล่างก่อนใช้งานจริง)
 *
 * กติกาการเลือกห้องจริงเมื่อนักเรียน 1 คนมีหลายแถว (เรียนหลายวิชา/กลุ่ม PE ต่างกัน):
 * ตัดแถวที่ วิชา = "ออก" (ถอน/เปลี่ยนวิชา) ทิ้งก่อน แล้วใช้แถวที่เหลือแถวแรกที่เจอ
 * เป็นห้องจริง (ตามที่ผู้ใช้ยืนยัน) — ยังมี 1 เคสข้อมูลขัดแย้งที่ตรวจพบ (รหัส 37068:
 * ป.3/3 กับ ม.6/8 ในคนละแถว) จะถูกพิมพ์แจ้งเตือนแยกไว้ ไม่ import แถวขัดแย้งซ้ำ
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

// รหัสวิชา (2-3 ตัวอักษร) -> ชื่อกีฬาเต็มใน SPORTS_MASTER (lib/sportsConfig.js)
// ยังไม่ยืนยัน 100% ทุกตัว — เท่าที่ตรวจสอบได้จากชื่อชีตย่อยที่แนบมาด้วย
const sportCodeMap = {
  TN: 'เทนนิส (Tennis)',
  G: 'กอล์ฟ (Golf)',
  FS: 'ฟุตซอล (Futsal)',
  TK: 'เทควันโด (Taekwondo)',
  BT: 'แบดมินตัน (Badminton)',
  BX: 'มวย (Boxing/Muay Thai)',
  // ยังไม่มีชื่อเต็ม/ยังไม่อยู่ใน SPORTS_MASTER ปัจจุบัน — ตรวจสอบก่อนใช้งานจริง:
  // D = เต้น (Dance) — ไม่มีใน SPORTS_MASTER
  // FB = ฟุตบอล (Football/Soccer) — ไม่มีใน SPORTS_MASTER (มีแต่ฟุตซอล)
  // CB = ปีนหน้าผา (Climbing) ?
  // TB = ปิงปอง (Table Tennis) ?
  // SW = ว่ายน้ำ (Swimming) — ไม่มีชีตย่อยแนบมา
  // BK = บาสเกตบอล (Basketball) ?
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

async function main() {
  const csvPath = path.join(__dirname, '..', 'data', 'master_roster_2569_raw.csv');
  const lines = readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(1); // ตัดแถว header ทิ้ง

  const byId = new Map(); // studentId -> parsed row (ตัวแทนห้องจริง)
  const conflicts = [];
  let skippedNoId = 0;

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
      // เก็บแถวแรกที่เจอไว้ตามเดิม ไม่ overwrite ด้วยแถวขัดแย้ง
    }
    // ถ้าห้องตรงกัน ไม่ต้องทำอะไรเพิ่ม (แถวซ้ำจากการเรียนหลายวิชา)
  }

  let created = 0;
  for (const [studentId, row] of byId) {
    const name = `${row.firstName} ${row.lastName}`.trim();
    const className = `${row.grade}/${row.room}`;
    await prisma.student.upsert({
      where: { id: studentId },
      update: { name, className, currentAcademicYear: ACADEMIC_YEAR, status: 'Active' },
      create: { id: studentId, name, className, currentAcademicYear: ACADEMIC_YEAR, status: 'Active' },
    });
    created++;
  }

  await prisma.auditLog.create({
    data: {
      action: 'IMPORT_MASTER_ROSTER',
      actor: 'import-script',
      academicYear: ACADEMIC_YEAR,
      studentCount: created,
      details: `นำเข้ารายชื่อนักเรียนจริงทั้งโรงเรียนจาก data/master_roster_2569_raw.csv (ชีต "รวม") — สำเร็จ ${created} คน, ไม่มี SkillLog (ยังไม่มี Level ตัวเลขจริงในไฟล์นี้), ข้าม ${skippedNoId} แถว (ไม่มีเลขประจำตัว), พบข้อมูลห้องขัดแย้ง ${conflicts.length} รายการ`,
    },
  });

  console.log(`== นำเข้าสำเร็จ ${created} คน (รายชื่อ+ห้องเท่านั้น ไม่มี SkillLog) ==`);
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
