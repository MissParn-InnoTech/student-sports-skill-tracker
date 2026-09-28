import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getClassReport } from '@/lib/dataAccess';

/** GET /api/class-report?year=2569&class=ม.1/1&sport= (ว่าง = ทุกกีฬา) */
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const className = searchParams.get('class');
  const sport = searchParams.get('sport') || '';
  const data = await getClassReport(year, className, sport);
  return NextResponse.json(data);
});
