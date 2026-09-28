import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { updateStudentAdmin, deleteStudentAdmin } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/students/STU001 - body: { name?, className?, currentAcademicYear?, status?, actor? } */
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const student = await updateStudentAdmin(id, body, body.actor);
  return NextResponse.json(student);
});

/** DELETE /api/admin/students/STU001?actor=... - ลบถาวร (รวมประวัติผลประเมิน) ใช้เฉพาะกรณีกรอกผิด/ซ้ำ */
export const DELETE = withErrorHandling(async (request, { params }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const result = await deleteStudentAdmin(id, searchParams.get('actor'));
  return NextResponse.json(result);
});
