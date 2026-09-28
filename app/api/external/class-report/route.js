import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKey } from '@/lib/apiAuth';
import { getClassReport } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/class-report?year=2569&class=ม.1/1&sport= (ว่าง = ทุกกีฬา)
 * สำหรับระบบภายนอก (เช่น ACT Sport Center) เรียกดูสรุปผลล่าสุดของทั้งห้อง
 * ต้องแนบ header "x-api-key" ที่ถูกต้อง — แนะนำเปิดให้ผู้ใช้ Role L1-L4 ดูได้ฝั่งผู้เรียก
 */
export const GET = withApiKey(
  withErrorHandling(async (request) => {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const className = searchParams.get('class');
    const sport = searchParams.get('sport') || '';
    const data = await getClassReport(year, className, sport);
    return NextResponse.json(data);
  })
);
