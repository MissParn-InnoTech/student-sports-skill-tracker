import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKeyFromEnv } from '@/lib/apiAuth';
import { findDuplicateSkillLogGroups } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/debug-duplicate-skill-logs
 * -----------------------------------------------------------------------
 * route ชั่วคราว (ลบทิ้งได้หลังเคลียร์ปัญหา) — ใช้ตรวจสอบว่ามีแถว SkillLog ซ้ำกันตามคีย์
 * (studentId, academicYear, selectedSport, skillName) อยู่แล้วในฐานข้อมูลจริงหรือไม่ ก่อนจะ
 * เพิ่ม @@unique constraint นี้กลับเข้า prisma/schema.prisma อีกครั้ง (ดูหมายเหตุในไฟล์นั้น)
 * ป้องกันด้วย shared secret เดียวกับ webhook (header x-api-key: SHEET_SYNC_SECRET)
 */
export const GET = withApiKeyFromEnv('SHEET_SYNC_SECRET', withErrorHandling(async () => {
  const groups = await findDuplicateSkillLogGroups();
  // BigInt จาก COUNT(*) ต้องแปลงเป็น Number ก่อน JSON.stringify
  const safeGroups = groups.map((g) => ({
    studentId: g.student_id,
    academicYear: g.academic_year,
    selectedSport: g.selected_sport,
    skillName: g.skill_name,
    count: Number(g.count),
    ids: g.ids,
  }));
  return NextResponse.json({ ok: true, duplicateGroupCount: safeGroups.length, groups: safeGroups });
}));
