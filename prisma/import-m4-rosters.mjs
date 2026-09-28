/**
 * prisma/import-m4-rosters.mjs
 * -----------------------------------------------------------------------
 * นำเข้ารายชื่อนักเรียนจริง ม.4/4, ม.4/9, ม.4/6 และ ม.4/7 (กลุ่มวิชา Digital Arts)
 * จากไฟล์ data/m4_rosters.csv (ถอดจากแบบบันทึกผลการประเมินฯ ของโรงเรียน)
 *
 * ทำ 2 อย่าง:
 *   1. สร้าง/อัปเดต Student record จริง (id = เลขประจำตัวนักเรียนจริง, name, className,
 *      currentAcademicYear)
 *   2. สร้างคะแนนทักษะกีฬาแบบ "มอคอัพ" (SkillLog) ให้ทุกคน 1 รอบ เพื่อทดสอบระบบ —
 *      สุ่มกีฬา + Level ตาม seed ที่คงที่ (ผูกกับเลขประจำตัว ไม่ใช่ Math.random() ตรงๆ
 *      เพื่อให้รันซ้ำได้ผลเดิม) และ**ระบุไว้ชัดเจนใน coachNotes ว่าเป็นข้อมูลมอคอัพ/ทดสอบระบบ
 *      ไม่ใช่ผลประเมินจริง** ตามที่ผู้ใช้ยืนยันแล้วว่าต้องการ — โปรดลบ/แทนที่ SkillLog ชุดนี้
 *      ด้วยผลประเมินจริงเมื่อครูเริ่มกรอกคะแนนจริง (filter ด้วย coachNotes = MOCK_NOTE ได้)
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

const MOCK_NOTE = '[ข้อมูลมอคอัพ] สุ่มสร้างเพื่อทดสอบระบบ ยังไม่ใช่ผลประเมินจริง';

// เหมือน lib/sportsConfig.js (คัดลอกมาตรงนี้เพื่อเลี่ยงปัญหา ESM/CJS ตอนรันด้วย node ตรงๆ)
const SPORTS_MASTER = {
  'ฟุตซอล (Futsal)': ['Ball Control', 'Passing', 'Shooting', 'Defending', 'Agility'],
  'บาสเกตบอล (Basketball)': ['Dribbling', 'Passing', 'Shooting', 'Rebounding', 'Footwork'],
  'เทนนิส (Tennis)': ['Serve', 'Forehand', 'Backhand', 'Volley', 'Footwork'],
  'ปิงปอง (Table Tennis)': ['Grip & Stance', 'Serve', 'Drive', 'Push/Chop', 'Footwork'],
  'แบดมินตัน (Badminton)': ['Serve', 'Clear', 'Smash', 'Drop', 'Net Play'],
  'เทควันโด (Taekwondo)': ['Stance', 'Basic Kicks', 'Advanced Kicks', 'Blocks', 'Poomsae'],
  'มวย (Boxing/Muay Thai)': ['Punches', 'Kicks/Knees', 'Defense', 'Footwork', 'Stamina'],
  'กอล์ฟ (Golf)': ['Setup', 'Full Swing', 'Short Game', 'Putting', 'Course Management'],
  'ฟิตเนส (Fitness)': ['Cardio Endurance', 'Strength Training', 'Flexibility', 'Core Stability', 'Exercise Technique'],
  'โยคะ (Yoga)': ['Breathing (Pranayama)', 'Balance Poses', 'Flexibility', 'Strength Poses', 'Mindfulness & Meditation'],
  'ว่ายน้ำ (Swimming)': ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Starts & Turns'],
  'ปีนหน้าผา (Rock Climbing)': ['Grip Strength', 'Footwork', 'Route Reading', 'Balance & Body Positioning', 'Belaying & Safety'],
};
const SPORT_NAMES = Object.keys(SPORTS_MASTER);

// PRNG ง่ายๆ ที่ seed ได้ (mulberry32) เพื่อให้ผลรันซ้ำเหมือนเดิมทุกครั้งต่อ studentId เดียวกัน
function mulberry32(seed) {
  let t = seed;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

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

    // --- มอคอัพคะแนนทักษะกีฬา 1 รอบต่อคน (ดูหมายเหตุด้านบนไฟล์) ---
    const rng = mulberry32(seedFromId(studentId));
    const sport = SPORT_NAMES[Math.floor(rng() * SPORT_NAMES.length)];
    const skills = SPORTS_MASTER[sport];
    // สุ่มระดับพื้นฐาน 1-4 ต่อคน แล้วสุ่มเบี่ยงราย skill ±1 (แต่ยังอยู่ในช่วง 1-6)
    const baseLevel = 1 + Math.floor(rng() * 4);
    const timestamp = new Date(Date.now() - Math.floor(rng() * 60) * 86400000);
    await prisma.skillLog.createMany({
      data: skills.map((skillName) => {
        const jitter = Math.floor(rng() * 3) - 1; // -1, 0, +1
        const finalLevel = Math.min(6, Math.max(1, baseLevel + jitter));
        return {
          timestamp,
          academicYear: ACADEMIC_YEAR,
          studentId,
          studentName: rawName,
          selectedSport: sport,
          skillName,
          finalLevel,
          coachNotes: MOCK_NOTE,
        };
      }),
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'IMPORT_M4_ROSTERS',
      actor: 'import-script',
      academicYear: ACADEMIC_YEAR,
      studentCount: created,
      details: `นำเข้ารายชื่อนักเรียนจริง ม.4/4, ม.4/9, ม.4/6, ม.4/7(Digital Arts) จาก data/m4_rosters.csv — สำเร็จ ${created} คน (พร้อมคะแนนมอคอัพ 1 รอบ/คน, coachNotes="${MOCK_NOTE}"), ข้าม ${skipped} แถว (ไม่มีเลขประจำตัว)`,
    },
  });

  console.log(`== นำเข้าสำเร็จ ${created} คน (พร้อมคะแนนมอคอัพ 1 รอบ/คน) ==`);
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
