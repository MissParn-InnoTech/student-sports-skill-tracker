/**
 * currentUser.js - เวอร์ชันนี้ยังไม่มีระบบ Login จริง
 * ใช้ localStorage เก็บ "ชื่อ/อีเมลผู้ใช้งาน" ที่ผู้ใช้พิมพ์เองไว้เครื่องนั้นๆ
 * เพื่อให้ทุกหน้า (กรอกคะแนน, จัดการนักเรียน ฯลฯ) ส่งไปเป็น actor ตอนบันทึก/แก้ไขข้อมูล
 * โดยไม่ต้องพิมพ์ซ้ำทุกครั้ง — ใช้ key เดียวกันทุกหน้า
 */
const KEY = 'sst_actor_name';

export function getActorName() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setActorName(name) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, name || '');
  } catch {
    // ไม่ critical ถ้า localStorage ใช้ไม่ได้ (เช่น private mode) - แค่ต้องพิมพ์ใหม่ทุกครั้ง
  }
}
