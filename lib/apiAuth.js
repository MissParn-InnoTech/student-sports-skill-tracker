/**
 * apiAuth.js
 * -----------------------------------------------------------------------
 * ตรวจสอบ Shared Secret Key สำหรับ API ที่เปิดให้ระบบภายนอก (เช่น ACT Sport Center)
 * เรียกใช้แบบ Server-to-Server เท่านั้น — Skill Tracker "เชื่อใจ" ระบบผู้เรียกทั้งหมด
 * (ไม่ตรวจสอบ Role L0-L4 เอง เพราะฝั่งผู้เรียกต้องเช็ค Role ของผู้ใช้ก่อนตัดสินใจเรียก API นี้)
 *
 * วิธีเรียก: ใส่ header  x-api-key: <SPORTS_CENTER_API_KEY>
 */
import { NextResponse } from 'next/server';

/** isValidApiKeyFromEnv: เทียบ header x-api-key กับค่าใน env var ชื่อที่ระบุ (ทั่วไป ใช้ได้กับทุก shared-secret ของระบบ) */
export function isValidApiKeyFromEnv(request, envVarName) {
  const expected = process.env[envVarName];
  if (!expected) return false; // ยังไม่ได้ตั้งค่า env var บนเซิร์ฟเวอร์ = ปิดการใช้งานไว้ก่อนเพื่อความปลอดภัย
  const provided = request.headers.get('x-api-key');
  return provided === expected;
}

export function isValidApiKey(request) {
  return isValidApiKeyFromEnv(request, 'SPORTS_CENTER_API_KEY');
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'ไม่ได้รับอนุญาต: ต้องแนบ header "x-api-key" ที่ถูกต้องมาด้วย' },
    { status: 401 }
  );
}

/** ห่อ route handler ให้ต้องผ่านการตรวจ API key ก่อนเสมอ ใช้ร่วมกับ withErrorHandling ได้ */
export function withApiKey(handler) {
  return async (request, ...rest) => {
    if (!isValidApiKey(request)) return unauthorizedResponse();
    return handler(request, ...rest);
  };
}

/** withApiKeyFromEnv: เหมือน withApiKey แต่เลือก env var ที่ใช้เทียบ key ได้ (เช่น SHEET_SYNC_SECRET) */
export function withApiKeyFromEnv(envVarName, handler) {
  return async (request, ...rest) => {
    if (!isValidApiKeyFromEnv(request, envVarName)) return unauthorizedResponse();
    return handler(request, ...rest);
  };
}
