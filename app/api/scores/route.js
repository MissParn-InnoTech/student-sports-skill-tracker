import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { saveBulkScores } from '@/lib/dataAccess';

/**
 * POST /api/scores
 * body: { scores: [...], actor?: string }
 * หมายเหตุ: เวอร์ชันนี้ยังไม่มีระบบ Login จริง "actor" จึงเป็นชื่อ/อีเมลที่โค้ชพิมพ์เอง
 * (เก็บไว้ใน Audit Log เพื่อติดตามเท่านั้น) — ถ้าต้องการยืนยันตัวตนจริง แนะนำเพิ่ม NextAuth
 * พร้อม Google Provider แล้วดึง session.user.email มาแทนใน route นี้
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  const result = await saveBulkScores(body.scores, body.actor);
  return NextResponse.json(result);
});
