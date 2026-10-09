import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getRunningFixReport, applyRunningFix } from '@/lib/runningFix';

export const dynamic = 'force-dynamic';

/** GET: รายงานตรวจสอบ (อ่านอย่างเดียว ไม่แก้ข้อมูล) */
export const GET = withErrorHandling(async () => {
  return NextResponse.json(await getRunningFixReport());
});

/** POST: ลงมือแก้จริง — body: { confirm: "ย้าย", groups: ["confirmed", ...], actor? } */
export const POST = withErrorHandling(async (request) => {
  const body = await request.json();
  if (body.confirm !== 'ย้าย') throw new Error('ต้องพิมพ์คำว่า "ย้าย" เพื่อยืนยันก่อนแก้ข้อมูล');
  return NextResponse.json(await applyRunningFix({ groups: body.groups, actor: body.actor }));
});
