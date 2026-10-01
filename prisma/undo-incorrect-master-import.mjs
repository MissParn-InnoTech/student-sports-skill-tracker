/**
 * prisma/undo-incorrect-master-import.mjs
 * -----------------------------------------------------------------------
 * ใช้ครั้งเดียว (ลบทิ้งได้หลังใช้งานเสร็จ): การ import master-roster รอบแรก
 * (prisma/import-master-roster.mjs เวอร์ชันก่อนแก้) ใส่ LV.เดิม (ผลของปีการศึกษา
 * 2568) ปนเข้าไปเป็น SkillLog ของปี 2569 ทั้งหมด ทำให้ computeStartingLevels()
 * (lib/skillLogic.js) ที่ต้องหา log ปี 2568 เพื่อคำนวณ "ต่อยอด" ของปี 2569
 * หาไม่เจอเลย (ทุกคนโดนตีเป็นนักเรียนใหม่ Level 1 หมด)
 *
 * สคริปต์นี้ลบเฉพาะแถวที่ตัว import-master-roster.mjs รอบแรกสร้างไว้เท่านั้น
 * (จับคู่ด้วยข้อความ coachNotes เดิมเป๊ะๆ "...Level รวมของกีฬา ไม่ได้แยกรายทักษะ"
 * ซึ่งเป็นข้อความเฉพาะของรอบแรก ไม่ชนกับ note ของการซิงก์จาก Google Sheet หรือของ
 * สคริปต์เวอร์ชันแก้ไขแล้ว) ไม่กระทบ Student record หรือผลประเมินอื่นใดๆ เลย
 * รันแล้วค่อยรัน import-master-roster.mjs เวอร์ชันแก้ไขแล้วใหม่อีกรอบ
 *
 * วิธีรัน: node prisma/undo-incorrect-master-import.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_NOTE = '[ผลประเมินจริง] นำเข้าจาก Master Sport Report (ชีต "รวม") — Level รวมของกีฬา ไม่ได้แยกรายทักษะ';

async function main() {
  const existing = await prisma.skillLog.count({ where: { coachNotes: OLD_NOTE } });
  console.log(`พบแถวที่ import รอบแรก (academicYear ผิด) สร้างไว้: ${existing} แถว`);

  if (existing === 0) {
    console.log('== ไม่มีอะไรต้องลบ (อาจเคยรันสคริปต์นี้ไปแล้ว หรือยังไม่เคย import รอบแรก) ==');
    return;
  }

  const result = await prisma.skillLog.deleteMany({ where: { coachNotes: OLD_NOTE } });

  await prisma.auditLog.create({
    data: {
      action: 'UNDO_INCORRECT_MASTER_IMPORT',
      actor: 'undo-incorrect-master-import-script',
      details: `ลบ SkillLog ที่ import-master-roster.mjs รอบแรก (academicYear ผิด ปน LV.เดิมของปี 2568 เข้าไปในปี 2569) สร้างไว้ทั้งหมด ${result.count} แถว เตรียมรัน import ใหม่ที่แก้ไขแล้ว`,
    },
  });

  console.log(`== ลบแล้ว ${result.count} แถว — ไปรัน node prisma/import-master-roster.mjs ใหม่ได้เลย ==`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
