/**
 * prisma/dedupe-skill-logs.mjs
 * -----------------------------------------------------------------------
 * ใช้ครั้งเดียว (ลบสคริปต์นี้ทิ้งได้หลังใช้งานเสร็จ): การ import master-roster
 * (prisma/import-master-roster.mjs) ใช้ createMany แบบไม่เช็คซ้ำ ถ้า CSV มีหลายแถว
 * ของนักเรียนคนเดียวกัน+กีฬาเดียวกัน (เช่น มีมากกว่า 1 คาบ/เทอมในวิชาเดียวกัน) จะสร้าง
 * SkillLog ซ้ำกันตามคีย์ (studentId, academicYear, selectedSport, skillName) ซึ่งขัดกับ
 * @@unique ที่เราต้องการเพิ่มกลับเข้า schema.prisma (ทำให้ deploy ล่าสุดพัง potential_dataloss
 * อีกรอบ) สคริปต์นี้จะหา group ที่ซ้ำกัน แล้วเก็บไว้แถวเดียว (id น้อยสุด = แถวแรกที่ถูกสร้าง)
 * ลบแถวซ้ำที่เหลือทิ้ง ไม่กระทบ Student หรือผลประเมินกีฬาอื่น
 *
 * วิธีรัน (ต้องมี .env ที่มี POSTGRES_URL จริงของ production อยู่แล้ว เหมือนตอนรัน
 * import-master-roster.mjs):
 *   node prisma/dedupe-skill-logs.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.$queryRaw`
    SELECT student_id, academic_year, selected_sport, skill_name, COUNT(*)::int AS count,
           array_agg(id ORDER BY id) AS ids
    FROM skill_logs
    GROUP BY student_id, academic_year, selected_sport, skill_name
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  if (groups.length === 0) {
    console.log('== ไม่พบแถวซ้ำเลย ปลอดภัยที่จะเพิ่ม @@unique constraint กลับได้ ==');
    return;
  }

  console.log(`== พบ ${groups.length} กลุ่มที่มีแถวซ้ำ (รวม ${groups.reduce((a, g) => a + (g.count - 1), 0)} แถวที่จะลบ) ==`);

  let totalDeleted = 0;
  for (const g of groups) {
    const ids = g.ids.map(Number);
    const keepId = ids[0]; // เก็บแถวแรกสุด (id น้อยสุด)
    const deleteIds = ids.slice(1);
    const result = await prisma.skillLog.deleteMany({ where: { id: { in: deleteIds } } });
    totalDeleted += result.count;
    console.log(
      `  - นักเรียน ${g.student_id} / ${g.selected_sport} / ปี ${g.academic_year}: เก็บ id=${keepId}, ลบ ${result.count} แถว (id: ${deleteIds.join(', ')})`
    );
  }

  await prisma.auditLog.create({
    data: {
      action: 'DEDUPE_SKILL_LOGS',
      actor: 'dedupe-skill-logs-script',
      details: `ลบ SkillLog ซ้ำ ${totalDeleted} แถว จาก ${groups.length} กลุ่ม (คีย์: studentId, academicYear, selectedSport, skillName) ก่อนเพิ่ม @@unique constraint กลับเข้า schema`,
    },
  });

  console.log(`== เสร็จสิ้น: ลบแถวซ้ำไปทั้งหมด ${totalDeleted} แถว ==`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
