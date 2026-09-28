import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getStudentsByClassAndSport } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/** GET /api/roster?year=2569&class=ม.1/1&sport=ฟุตซอล (Futsal) */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const className = searchParams.get('class');
  const sport = searchParams.get('sport');
  const data = await getStudentsByClassAndSport(year, className, sport);
  return NextResponse.json(data);
});
