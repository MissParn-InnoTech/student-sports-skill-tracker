import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKey } from '@/lib/apiAuth';
import { getStudentsByClassAndSport } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/roster?year=2569&class=ม.1/1&sport=ฟุตซอล (Futsal)
 * สำหรับระบบภายนอก (เช่น ACT Sport Center) เรียกดูรายชื่อนักเรียนในห้อง+กีฬาที่เลือก พร้อม Level เริ่มต้น
 * ต้องแนบ header "x-api-key" ที่ถูกต้อง — แนะนำเปิดให้ผู้ใช้ Role L1-L4 ดูได้ฝั่งผู้เรียก
 */
export const GET = withApiKey(
  withErrorHandling(async (request) => {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const className = searchParams.get('class');
    const sport = searchParams.get('sport');
    const data = await getStudentsByClassAndSport(year, className, sport);
    return NextResponse.json(data);
  })
);
