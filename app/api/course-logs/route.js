import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { listCourseLogs, saveCourseScores } from '@/lib/courseLogs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/course-logs?year=2569&sport=FS&type=Summer%20Course
 * รายชื่อนักเรียนคอร์สพิเศษ (นอกเวลา / Summer Course / October Course) ที่ส่งมาจากต้นขั้วใน Google Sheet
 */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const data = await listCourseLogs({
    academicYear: searchParams.get('year') || '',
    sportCode: searchParams.get('sport') || '',
    courseType: searchParams.get('type') || '',
  });
  return NextResponse.json(data);
});

/**
 * POST /api/course-logs
 * body: { entries: [{ id, levelNew, totalScore }] } — ครูกรอก LV.ใหม่ / คะแนนรวม ผ่านหน้าเว็บ
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  const result = await saveCourseScores(body.entries);
  return NextResponse.json(result);
});
