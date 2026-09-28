import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { bulkAssignClassAndSport } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/students/bulk-assign
 * body: { studentIds: ['25464', ...], className?, assignedSport?, actor? }
 * ส่วนหนึ่งของ workflow "ตั้งค่าปีการศึกษาใหม่": จัดห้อง + ระบุกีฬาที่จะเล่นปีนี้ ให้หลายคนพร้อมกัน
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  const result = await bulkAssignClassAndSport(body.studentIds, { className: body.className, assignedSport: body.assignedSport }, body.actor);
  return NextResponse.json(result);
});
