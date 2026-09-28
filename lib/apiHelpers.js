import { NextResponse } from 'next/server';

/**
 * withErrorHandling: ห่อ route handler เพื่อจับ error แล้วคืน JSON { error: message } พร้อม status 400
 * เพื่อไม่ต้องเขียน try/catch ซ้ำทุก route
 */
export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ' }, { status: 400 });
    }
  };
}
