import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getStudentDashboard } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/** GET /api/students/STU001/dashboard */
export const GET = withErrorHandling(async (request, { params }) => {
  const { id } = await params;
  const data = await getStudentDashboard(id);
  return NextResponse.json(data);
});
