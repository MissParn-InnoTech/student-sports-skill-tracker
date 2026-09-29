/**
 * googleSheetsClient.js
 * -----------------------------------------------------------------------
 * ตัวช่วยเรียก Google Sheets API v4 แบบ low-level ด้วย Service Account
 * (ไม่ใช้แพ็กเกจ googleapis ทั้งก้อนเพื่อลดขนาด bundle - ใช้ google-auth-library
 * แค่ขอ access token แล้วยิง REST เอง)
 *
 * ต้องตั้งค่า env vars (ดูวิธีตั้งค่าใน README/ข้อความที่ส่งให้ผู้ใช้):
 *   GOOGLE_SHEETS_CLIENT_EMAIL   - client_email จากไฟล์ JSON ของ Service Account
 *   GOOGLE_SHEETS_PRIVATE_KEY    - private_key จากไฟล์ JSON เดียวกัน (คง \n ไว้)
 *   GOOGLE_SHEETS_SPREADSHEET_ID - ID ของ Google Sheet "Master Sport Report"
 *                                  (ส่วนหลัง /d/ ใน URL ของ Sheet)
 *
 * ถ้าไม่ได้ตั้งค่า env เหล่านี้ ทุกฟังก์ชันจะ no-op เงียบๆ (sync ไป Sheet ไม่ทำงาน
 * แต่ระบบหลัก/Postgres ยังทำงานปกติ) เพื่อไม่ให้กระทบการใช้งานจริงถ้ายังไม่ได้ตั้งค่า
 */
import { JWT } from 'google-auth-library';

let cachedClient = null;

function sheetsConfigured() {
  return !!(process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY && process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
}

function getClient() {
  if (!sheetsConfigured()) return null;
  if (!cachedClient) {
    cachedClient = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      // ค่าที่ตั้งใน Vercel มักจะมี \n เป็น string ตัวอักษรจริง ต้องแปลงกลับเป็น newline จริง
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return cachedClient;
}

const SHEET_ID = () => process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsFetch(path, options = {}) {
  const client = getClient();
  if (!client) return null; // ยังไม่ได้ตั้งค่า - no-op
  const res = await client.request({
    url: `${BASE}/${SHEET_ID()}${path}`,
    method: options.method || 'GET',
    data: options.body,
  });
  return res.data;
}

/** getValues: อ่านค่าทั้งหมดในช่วงที่ระบุ เช่น "Student_DB!A:G" */
export async function getValues(range) {
  const data = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
  return data ? data.values || [] : null;
}

/** updateRow: เขียนทับแถวที่ range ระบุ (เช่น "Student_DB!A5:G5") ด้วยค่าใหม่ 1 แถว */
export async function updateRow(range, rowValues) {
  return sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: { range, majorDimension: 'ROWS', values: [rowValues] },
  });
}

/** appendRow: เพิ่มแถวใหม่ต่อท้ายตาราง (เช่น range="Student_DB!A:G") */
export async function appendRow(range, rowValues) {
  return sheetsFetch(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: { range, majorDimension: 'ROWS', values: [rowValues] },
  });
}

/** clearRow: ล้างค่าในแถว (ใช้แทนการลบแถวจริง เพื่อไม่ต้องยุ่งกับ sheetId ตัวเลข/เลื่อนแถว) */
export async function clearRow(range) {
  return sheetsFetch(`/values/${encodeURIComponent(range)}:clear`, { method: 'POST', body: {} });
}

export function isSheetsSyncEnabled() {
  return sheetsConfigured();
}
