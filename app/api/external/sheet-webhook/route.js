import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { withApiKeyFromEnv } from '@/lib/apiAuth';
import { upsertStudentFromSheet, upsertSkillLogFromSheet } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

/**
 * POST /api/external/sheet-webhook
 * เรียกโดย Google Apps Script (onEdit trigger) ที่ติดตั้งบน Google Sheet "Master Sport Report"
 * เท่านั้น — ป้องกันด้วย shared secret env var SHEET_SYNC_SECRET (header x-api-key)
 *
 * body: { tab: "Student_DB" | "Skill_Logs", row: { ...ตามหัวคอลัมน์ของแท็บนั้น } }
 * ดูโค้ด Apps Script ทั้งหมดที่ต้องติดตั้งบน Sheet ได้จากข้อความที่ส่งให้ผู้ใช้ตอนตั้งค่าฟีเจอร์นี้
 */
export const POST = withApiKeyFromEnv('SHEET_SYNC_SECRET', withErrorHandling(async (request) => {
  const body = await request.json();
  const { tab, row } = body;

  if (tab === 'Student_DB') {
    const student = await upsertStudentFromSheet(row);
    return NextResponse.json({ ok: true, student });
  }
  if (tab === 'Skill_Logs') {
    const log = await upsertSkillLogFromSheet(row);
    return NextResponse.json({ ok: true, log });
  }
  return NextResponse.json({ error: `ไม่รู้จักแท็บ "${tab}" (ต้องเป็น Student_DB หรือ Skill_Logs)` }, { status: 400 });
}));
