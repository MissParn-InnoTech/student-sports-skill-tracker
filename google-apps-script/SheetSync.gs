/**
 * SheetSync.gs
 * -----------------------------------------------------------------------
 * ติดตั้งสคริปต์นี้บน Google Sheet "Master Sport Report" เอง
 * (เปิด Sheet > Extensions/ส่วนขยาย > Apps Script > วางโค้ดนี้ทับไฟล์ Code.gs เดิม
 *  หรือสร้างไฟล์ใหม่ก็ได้ > บันทึก)
 *
 * ทำหน้าที่: เมื่อเจ้าหน้าที่แก้ไขข้อมูลในแท็บ Student_DB หรือ Skill_Logs ด้วยมือ
 * (พิมพ์ในช่องจริงๆ ผ่านหน้าจอ Sheet) จะส่งแถวนั้นไปอัปเดตที่เว็บแอป (Postgres) ให้อัตโนมัติ
 *
 * หมายเหตุสำคัญ: onEdit แบบ simple trigger นี้ทำงานเฉพาะตอนคนแก้ผ่านหน้าจอ Sheet เท่านั้น
 * การเขียนที่เว็บแอปทำผ่าน Sheets API โดยตรง (ไม่ผ่านหน้าจอ) จึงไม่ทำให้เกิด loop ย้อนกลับ
 *
 * ก่อนใช้งาน ต้องตั้งค่า 2 ค่านี้ก่อน (เมนู "🔗 Sync เว็บแอป" > "ตั้งค่า Webhook" ที่จะโผล่มา
 * เมื่อเปิดไฟล์ใหม่ หรือรันฟังก์ชัน setupConfig() เองจาก Apps Script Editor ครั้งเดียว):
 *   WEBHOOK_URL      = https://student-sports-skill-tracker.vercel.app/api/external/sheet-webhook
 *   SHEET_SYNC_SECRET = (ค่าเดียวกับที่ตั้งเป็น env var SHEET_SYNC_SECRET บน Vercel)
 *
 * ก่อนใช้งาน ต้องเพิ่มคอลัมน์ใหม่ต่อท้าย 2 แท็บนี้ก่อน (ไม่ต้องเปลี่ยนคอลัมน์เดิม):
 *   Student_DB: เพิ่มคอลัมน์ F หัวว่า "Assigned_Sport"
 *   Skill_Logs: เพิ่มคอลัมน์ I หัวว่า "ID" (ใช้เป็นคีย์จับคู่แถวตอนแก้ไขย้อนหลัง)
 *
 * คำเตือน: แถวทดสอบเดิมที่มีอยู่แล้ว (เช่น TEST001, STU001 ฯลฯ) ไม่ได้ผูกกับข้อมูลจริงใน
 * ระบบเว็บแอป ถ้าไปแก้ไขแถวเหล่านี้จะถูกสร้างเป็นนักเรียน/ผลประเมินใหม่ในฐานข้อมูลจริงทันที
 * แนะนำให้ลบหรือย้ายแถวทดสอบเหล่านี้ออกก่อนเริ่มใช้งานจริง
 */

const SYNCED_TABS = ['Student_DB', 'Skill_Logs'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔗 Sync เว็บแอป')
    .addItem('ตั้งค่า Webhook (ทำครั้งแรกครั้งเดียว)', 'setupConfig')
    .addItem('ซิงก์แถวที่เลือกอยู่ตอนนี้ไปเว็บแอป', 'manualSyncActiveRow')
    .addToUi();
}

function setupConfig() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const urlResp = ui.prompt('ตั้งค่า Webhook URL', 'เช่น https://student-sports-skill-tracker.vercel.app/api/external/sheet-webhook', ui.ButtonSet.OK_CANCEL);
  if (urlResp.getSelectedButton() !== ui.Button.OK) return;
  const secretResp = ui.prompt('ตั้งค่า Secret Key', 'ค่าเดียวกับ env var SHEET_SYNC_SECRET บน Vercel', ui.ButtonSet.OK_CANCEL);
  if (secretResp.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('WEBHOOK_URL', urlResp.getResponseText().trim());
  props.setProperty('SHEET_SYNC_SECRET', secretResp.getResponseText().trim());
  ui.alert('ตั้งค่าเรียบร้อย พร้อมใช้งาน Sync แล้ว');
}

/** onEdit: simple trigger ที่ Google รันให้อัตโนมัติเมื่อมีคนแก้ไขค่าในชีตนี้ผ่านหน้าจอ */
function onEdit(e) {
  try {
    const sheet = e.range.getSheet();
    const tabName = sheet.getName();
    if (SYNCED_TABS.indexOf(tabName) === -1) return;
    if (e.range.getRow() === 1) return; // แก้ header ไม่ต้อง sync

    syncRow_(sheet, tabName, e.range.getRow());
  } catch (err) {
    // ไม่ throw ต่อ เพราะ onEdit trigger ถ้า error จะรบกวนผู้ใช้ตอนพิมพ์งานปกติ
    console.error('onEdit sync error: ' + err);
  }
}

function manualSyncActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const tabName = sheet.getName();
  const row = SpreadsheetApp.getActiveRange().getRow();
  if (SYNCED_TABS.indexOf(tabName) === -1) {
    SpreadsheetApp.getUi().alert('แท็บนี้ไม่ได้อยู่ในรายการที่ Sync (ต้องเป็น Student_DB หรือ Skill_Logs)');
    return;
  }
  if (row === 1) {
    SpreadsheetApp.getUi().alert('แถวนี้เป็น header ไม่ต้อง sync');
    return;
  }
  syncRow_(sheet, tabName, row);
  SpreadsheetApp.getUi().alert('ส่งแถวที่ ' + row + ' ไปเว็บแอปแล้ว');
}

/** syncRow_: อ่านค่าทั้งแถว จับคู่กับ header แถวที่ 1 แล้ว POST ไปที่ webhook */
function syncRow_(sheet, tabName, rowNumber) {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('SHEET_SYNC_SECRET');
  if (!webhookUrl || !secret) {
    console.error('ยังไม่ได้ตั้งค่า Webhook - รันเมนู "🔗 Sync เว็บแอป > ตั้งค่า Webhook" ก่อน');
    return;
  }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];

  const row = {};
  headers.forEach((h, i) => {
    if (!h) return;
    row[h] = values[i] instanceof Date ? values[i].toISOString() : values[i];
  });

  // แถวว่างทั้งแถว (เช่นแถวที่ถูกลบ/เคลียร์จากฝั่งเว็บ) ไม่ต้อง sync กลับ
  if (Object.values(row).every((v) => v === '' || v === null || v === undefined)) return;

  const res = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': secret },
    payload: JSON.stringify({ tab: tabName, row: row }),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() >= 300) {
    console.error('sync ไปเว็บแอปไม่สำเร็จ (' + res.getResponseCode() + '): ' + res.getContentText());
  }
}
