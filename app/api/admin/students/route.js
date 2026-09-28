import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { listAllStudentsAdmin, createStudentAdmin } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/** GET /api/admin/students - รายชื่อนักเรียนทั้งหมด (รวม Inactive) สำหรับหน้าจัดการ */
export const GET = withErrorHandling(async () => {
  const data = await listAllStudentsAdmin();
  return NextResponse.json(data);
});

/** POST /api/admin/students - เพิ่มนักเรียนใหม่ { id, name, className, currentAcademicYear, actor? } */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  const student = await createStudentAdmin(body, body.actor);
  return NextResponse.json(student);
});
