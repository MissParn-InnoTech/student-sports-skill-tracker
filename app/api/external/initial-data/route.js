import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKey } from '@/lib/apiAuth';
import { getInitialData } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/initial-data
 * สำหรับระบบภายนอก (เช่น ACT Sport Center) เรียกดูรายชื่อกีฬา/ทักษะ/นักเรียน/ชั้นเรียน/ปีการศึกษาทั้งหมด
 * ต้องแนบ header "x-api-key" ที่ถูกต้อง — ฝั่งผู้เรียกต้องเช็คสิทธิ์ Role ของผู้ใช้เอง (แนะนำ L2/L3 เท่านั้นสำหรับการจัดการ)
 */
export const GET = withApiKey(
  withErrorHandling(async () => {
    const data = await getInitialData();
    return NextResponse.json(data);
  })
);
