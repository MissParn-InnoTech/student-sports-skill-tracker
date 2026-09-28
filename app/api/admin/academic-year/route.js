import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { advanceAcademicYear } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/academic-year
 * body: { year: 2570, className?: 'ม.4/4', actor? }
 * ตั้งค่าปีการศึกษาปัจจุบันของนักเรียนที่ Active ทั้งหมด (หรือเฉพาะห้องที่ระบุ) เป็นปีใหม่
 * ไม่เปลี่ยนชั้นเรียน (className) ให้อัตโนมัติ
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  const result = await advanceAcademicYear(body.year, body.actor, body.className);
  return NextResponse.json(result);
});
