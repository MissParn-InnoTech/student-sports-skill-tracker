import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKey } from '@/lib/apiAuth';
import { getStudentDashboard } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/students/STU001/dashboard
 * สำหรับระบบภายนอก (เช่น ACT Sport Center) เรียกดูประวัติผลประเมิน + เส้นเวลา ป.1-ม.3 ของนักเรียน 1 คน
 * ต้องแนบ header "x-api-key" ที่ถูกต้อง — แนะนำเปิดให้ผู้ใช้ Role L1-L4 ดูได้ฝั่งผู้เรียก
 */
export const GET = withApiKey(
  withErrorHandling(async (request, { params }) => {
    const { id } = await params;
    const data = await getStudentDashboard(id);
    return NextResponse.json(data);
  })
);
