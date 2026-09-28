/**
 * prisma/import-m4-rosters.mjs
 * -----------------------------------------------------------------------
 * นำเข้ารายชื่อนักเรียนจริง ม.4/4, ม.4/9, ม.4/6 และ ม.4/7 (กลุ่มวิชา Digital Arts)
 * จากไฟล์ data/m4_rosters.csv (ถอดจากแบบบันทึกผลการประเมินฯ ของโรงเรียน)
 *
 * สร้าง/อัปเดตเฉพาะ Student record (id = เลขประจำตัวนักเรียนจริง, name, className,
 * currentAcademicYear) เท่านั้น — ไม่สร้างคะแนนทักษะกีฬา (SkillLog) ให้ เพราะเป็นข้อมูล
 * นักเรียนจริงที่ระบุตัวตนได้ การใส่คะแนนสมมติ/จำลองผูกกับชื่อ-เลขประจำตัวจริงจะกลายเป็น
 * ประวัติการประเมินปลอมของนักเรียนจริงในระบบจริง จึงข้ามส่วนนี้ไว้ก่อน
 * (ดูสคริปต์ prisma/seed.mjs สำหรับตัวอย่างข้อมูลจำลอง/มอคอัพที่ใช้ TEST/STU เท่านั้น)
 *
 * แถวที่ไม่มีเลขประจำตัว (เช่น "เดเด้" ในไฟล์ ม.4/7) จะถูกข้าม และพิมพ์แจ้งเตือนไว้
 *
 * วิธีรัน (ต้องรันจากเครื่องที่มี POSTGRES_URL ของ production จริงใน .env เท่านั้น
 * เพราะ sandbox นี้เข้าถึง production DB ไม่ได้):
 *   npx prisma generate
 *   node prisma/import-m4-rosters.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ปีการศึกษาปัจจุบัน (พ.ศ.) — ม.4 ปีการศึกษา 2569
const ACADEMIC_YEAR = 2569;

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h.trim()] = (cols[i] || '').trim()));
    return row;
  });
}

function normalizeClassName(raw) {
  // "ม.4/7 (รายชื่อกลุ่มวิชา Digital Arts - ไม่ใช่รายชื่อห้องเต็ม)" / "ม.4/7 (Digital Arts)" -> "ม.4/7"
  const m = raw.match(/^(ม\.\d+\/\d+)/);
  return m ? m[1] : raw;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'data', 'm4_rosters.csv');
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));

  let created = 0;
  let skipped = 0;
  const skippedList = [];

  for (const row of rows) {
    const studentId = row['เลขประจำตัว'];
    const rawName = row['ชื่อ-นามสกุล'];
    const className = normalizeClassName(row['ห้อง']);

    if (!studentId || !/^\d+$/.test(studentId)) {
      skipped++;
      skippedList.push(`${className} เลขที่ ${row['เลขที่']}: ${rawName} (ไม่มีเลขประจำตัวที่ใช้ได้)`);
      continue;
    }

    await prisma.student.upsert({
      where: { id: studentId },
      update: { name: rawName, className, currentAcademicYear: ACADEMIC_YEAR, status: 'Active' },
      create: { id: studentId, name: rawName, className, currentAcademicYear: ACADEMIC_YEAR, status: 'Active' },
    });
    created++;
  }

  await prisma.auditLog.create({
    data: {
      action: 'IMPORT_M4_ROSTERS',
      actor: 'import-script',
      academicYear: ACADEMIC_YEAR,
      studentCount: created,
      details: `นำเข้ารายชื่อนักเรียนจริง ม.4/4, ม.4/9, ม.4/6, ม.4/7(Digital Arts) จาก data/m4_rosters.csv — สำเร็จ ${created} คน, ข้าม ${skipped} แถว (ไม่มีเลขประจำตัว)`,
    },
  });

  console.log(`== นำเข้าสำเร็จ ${created} คน ==`);
  if (skipped > 0) {
    console.log(`== ข้าม ${skipped} แถว (ไม่มีเลขประจำตัวที่ใช้ได้) ==`);
    skippedList.forEach((s) => console.log('  - ' + s));
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
