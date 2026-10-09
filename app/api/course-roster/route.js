import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getCourseRoster, saveCourseSkillScores } from '@/lib/courseLogs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/course-roster?year=2569&course=SUMMER&sport=ฟุตซอล (Futsal)
 * รายชื่อนักเรียนที่ลงคอร์สพิเศษ (AFTER SCHOOL / OCTOBER / SUMMER) ของกีฬา+ปีที่เลือก พร้อมระดับตั้งต้นรายทักษะ
 */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const data = await getCourseRoster(searchParams.get('year'), searchParams.get('course'), searchParams.get('sport'));
  return NextResponse.json(data);
});

/**
 * POST /api/course-roster
 * body: { academicYear, courseType, sportName, scores: [{ studentId, skillName, finalLevel, coachNotes }], actor }
 */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  const result = await saveCourseSkillScores(body);
  return NextResponse.json(result);
});
