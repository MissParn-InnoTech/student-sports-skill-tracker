/**
 * prisma/seed.js
 * -----------------------------------------------------------------------
 * ข้อมูลตัวอย่างสำหรับตอนติดตั้งระบบครั้งแรก (เทียบเท่า Setup.gs + SeedMultiYear.gs เดิม)
 * รันด้วย: npx prisma db seed   (หรือ `node prisma/seed.js` ตรง ๆ)
 *
 * มี 2 ชุดข้อมูล:
 *  1. นักเรียนตัวอย่างพื้นฐาน 3 คน (TEST001-003) ปีปัจจุบัน สำหรับลองกรอกคะแนนทันที
 *  2. Demo เลื่อนชั้น/ย้ายห้อง/เปลี่ยนกีฬาข้ามปี 5 ปีการศึกษา (2565-2569) 3 คน
 *     (STU001 เล่นฟุตซอลต่อเนื่อง, STU002 ย้ายจากบาสไปเทนนิส, STU003 เข้าใหม่ปี 2567)
 *     เพื่อโชว์ว่า Starting Level / Carry-over ยังทำงานถูกต้องแม้เปลี่ยนห้องทุกปี
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_YEAR = new Date().getFullYear() + 543 - 1; // พ.ศ. ปีการศึกษาปัจจุบัน (โดยประมาณ)

function levelsFor(skills, level) {
  const out = {};
  skills.forEach((s) => (out[s] = level));
  return out;
}

async function upsertStudent(id, name, className, currentAcademicYear, status = 'Active') {
  await prisma.student.upsert({
    where: { id },
    update: { name, className, currentAcademicYear, status },
    create: { id, name, className, currentAcademicYear, status },
  });
}

async function addRound(studentId, studentName, academicYear, sport, levels, note, daysAgo = 0) {
  const timestamp = new Date(Date.now() - daysAgo * 86400000);
  const skillNames = Object.keys(levels);
  await prisma.skillLog.createMany({
    data: skillNames.map((skillName) => ({
      timestamp,
      academicYear,
      studentId,
      studentName,
      selectedSport: sport,
      skillName,
      finalLevel: levels[skillName],
      coachNotes: note || null,
    })),
  });
}

async function main() {
  console.log('== Seeding: 3 นักเรียนตัวอย่างพื้นฐาน (ปีปัจจุบัน) ==');
  const futsalSkills = ['Ball Control', 'Passing', 'Shooting', 'Defending', 'Agility'];

  await upsertStudent('TEST001', 'สมชาย ใจดี', 'ป.6/1', BASE_YEAR);
  await upsertStudent('TEST002', 'สมหญิง รักเรียน', 'ป.6/1', BASE_YEAR);
  await upsertStudent('TEST003', 'มานะ ตั้งใจ', 'ป.6/2', BASE_YEAR);

  await addRound('TEST001', 'สมชาย ใจดี', BASE_YEAR, 'ฟุตซอล (Futsal)', levelsFor(futsalSkills, 2), 'ข้อมูลตัวอย่าง', 20);
  await addRound(
    'TEST002',
    'สมหญิง รักเรียน',
    BASE_YEAR,
    'บาสเกตบอล (Basketball)',
    levelsFor(['Dribbling', 'Passing', 'Shooting', 'Rebounding', 'Footwork'], 3),
    'ข้อมูลตัวอย่าง',
    20
  );

  console.log('== Seeding: Demo เลื่อนชั้น/ย้ายห้อง/เปลี่ยนกีฬาข้ามปี 5 ปี (2565-2569) ==');
  const years = [2565, 2566, 2567, 2568, 2569];
  const basketballSkills = ['Dribbling', 'Passing', 'Shooting', 'Rebounding', 'Footwork'];
  const tennisSkills = ['Serve', 'Forehand', 'Backhand', 'Volley', 'Footwork'];

  // STU001: เล่นฟุตซอลต่อเนื่องทั้ง 5 ปี ระดับเพิ่มขึ้นเรื่อย ๆ, ย้ายห้องทุกปี
  const stu001Classes = ['ป.2/1', 'ป.3/2', 'ป.4/1', 'ป.5/3', 'ป.6/1'];
  for (let i = 0; i < years.length; i++) {
    await upsertStudent('STU001', 'ด.ช. เอกภพ ก้าวไกล', stu001Classes[i], years[i]);
    await addRound(
      'STU001',
      'ด.ช. เอกภพ ก้าวไกล',
      years[i],
      'ฟุตซอล (Futsal)',
      levelsFor(futsalSkills, Math.min(1 + i, 6)),
      `ประเมินปีการศึกษา ${years[i]}`,
      (years.length - i) * 30
    );
  }

  // STU002: เล่นบาสเกตบอล 3 ปีแรก (2565-2567) แล้วเปลี่ยนไปเทนนิส (2568-2569)
  // -> ปีที่เปลี่ยนกีฬา ต้องเริ่ม Level 1 ใหม่ทุกทักษะ (ไม่ carry-over ข้ามกีฬา)
  const stu002Classes = ['ป.2/2', 'ป.3/1', 'ป.4/3', 'ป.5/1', 'ป.6/2'];
  for (let i = 0; i < years.length; i++) {
    await upsertStudent('STU002', 'ด.ญ. พิมพ์ชนก แสนดี', stu002Classes[i], years[i]);
    if (i < 3) {
      await addRound(
        'STU002',
        'ด.ญ. พิมพ์ชนก แสนดี',
        years[i],
        'บาสเกตบอล (Basketball)',
        levelsFor(basketballSkills, Math.min(2 + i, 6)),
        `เล่นบาสเกตบอล ปีการศึกษา ${years[i]}`,
        (years.length - i) * 30
      );
    } else {
      await addRound(
        'STU002',
        'ด.ญ. พิมพ์ชนก แสนดี',
        years[i],
        'เทนนิส (Tennis)',
        levelsFor(tennisSkills, i === 3 ? 1 : 2),
        `เปลี่ยนมาเล่นเทนนิส ปีการศึกษา ${years[i]}`,
        (years.length - i) * 30
      );
    }
  }

  // STU003: เข้าใหม่ปี 2567 (ไม่มีประวัติก่อนหน้า -> ต้องเริ่ม Level 1 ทุกทักษะในปีแรก)
  const stu003Years = [2567, 2568, 2569];
  const stu003Classes = ['ป.4/2', 'ป.5/2', 'ป.6/3'];
  for (let i = 0; i < stu003Years.length; i++) {
    await upsertStudent('STU003', 'ด.ช. ธนกร มีสุข', stu003Classes[i], stu003Years[i]);
    await addRound(
      'STU003',
      'ด.ช. ธนกร มีสุข',
      stu003Years[i],
      'ฟุตซอล (Futsal)',
      levelsFor(futsalSkills, Math.min(1 + i, 6)),
      `ประเมินปีการศึกษา ${stu003Years[i]}`,
      (stu003Years.length - i) * 30
    );
  }

  await prisma.auditLog.create({
    data: {
      action: 'SEED_DEMO_DATA',
      actor: 'system-seed',
      details: 'สร้างข้อมูลตัวอย่าง: 3 นักเรียนพื้นฐาน + demo เลื่อนชั้น/ย้ายห้อง 5 ปี (STU001-003)',
    },
  });

  console.log('== เสร็จสิ้น ==');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
