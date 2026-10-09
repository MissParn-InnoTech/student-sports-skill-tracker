/**
 * CentralScoresSync.gs
 * -----------------------------------------------------------------------
 * ติดตั้งบน Google Sheet "Master_Sports_System" (ไฟล์เดียวกับที่มีแท็บ Central_Scores)
 *   เปิด Sheet > ส่วนขยาย > Apps Script > กด + > สคริปต์ > ตั้งชื่อ CentralScoresSync
 *   > วางโค้ดนี้ทั้งหมด > บันทึก > กลับไปรีเฟรชหน้า Sheet 1 ครั้ง
 *
 * ทำหน้าที่: ส่งข้อมูล "ทั้งแท็บ Central_Scores" ไปให้หน้า "ภาพรวมระบบ" ของเว็บ
 *   https://student-sports-skill-tracker.vercel.app/admin
 * อ่านอย่างเดียว ไม่แก้ไขข้อมูลใด ๆ ในชีต
 *
 * ใช้ค่าตั้งเดิมของไฟล์นี้ (Script Properties):
 *   WEBHOOK_URL       = https://student-sports-skill-tracker.vercel.app/api/external/sheet-webhook
 *   SHEET_SYNC_SECRET = ค่าเดียวกับ env var SHEET_SYNC_SECRET บน Vercel
 * ถ้ายังไม่เคยตั้ง: Apps Script > การตั้งค่าโครงการ (รูปเฟือง) > คุณสมบัติของสคริปต์ > เพิ่ม 2 ค่านี้
 *
 * หมายเหตุ: ไฟล์นี้ไม่มีฟังก์ชัน onOpen เพื่อไม่ชนกับ onOpen ของสคริปต์เดิมในไฟล์
 *   - ครั้งแรก: เลือกฟังก์ชัน installCentralOverviewMenu แล้วกด "เรียกใช้" 1 ครั้ง
 *     (จะเพิ่มเมนู "📊 ภาพรวมเว็บ" ให้ทุกครั้งที่เปิดไฟล์ โดยไม่แตะ onOpen เดิม)
 *   - หรือจะกด "เรียกใช้" ฟังก์ชัน pushCentralScoresToWeb จากหน้า Apps Script โดยตรงก็ได้
 */

var CENTRAL_TAB = 'Central_Scores';
var CENTRAL_BATCH_SIZE = 500;

/** หัวคอลัมน์ในชีต -> ชื่อฟิลด์ที่เว็บรับ (หาคอลัมน์จากข้อความหัวตาราง ไม่ผูกกับลำดับคอลัมน์) */
var CENTRAL_HEADER_MAP = {
  'รหัสประจำตัว': 'studentId',
  'คำนำหน้า': 'prefix',
  'ชื่อ': 'firstName',
  'นามสกุล': 'lastName',
  'ชั้น/ห้อง': 'className',
  'วิชา': 'sportCode',
  'รหัสวิชา': 'sportCode',
  'LV.เดิม': 'levelOld',
  'LV.ใหม่': 'levelNew',
  'คะแนนรวม': 'totalScore',
};

/** รันครั้งเดียว: ติดตั้ง trigger ให้เมนู "📊 ภาพรวมเว็บ" โผล่ทุกครั้งที่เปิดไฟล์ */
function installCentralOverviewMenu() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'addCentralOverviewMenu_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('addCentralOverviewMenu_').forSpreadsheet(ss).onOpen().create();
  addCentralOverviewMenu_();
}

function addCentralOverviewMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('📊 ภาพรวมเว็บ')
    .addItem('ส่ง Central_Scores ไปหน้าภาพรวม', 'pushCentralScoresToWeb')
    .addItem('ตั้งให้ส่งอัตโนมัติทุกชั่วโมง', 'installCentralHourlySync')
    .addItem('ยกเลิกการส่งอัตโนมัติ', 'removeCentralHourlySync')
    .addToUi();
}

function installCentralHourlySync() {
  removeCentralHourlySync_();
  ScriptApp.newTrigger('pushCentralScoresToWebSilent_').timeBased().everyHours(1).create();
  notify_('ตั้งค่าแล้ว: จะส่ง Central_Scores ไปหน้าภาพรวมของเว็บทุก 1 ชั่วโมง');
}

function removeCentralHourlySync() {
  removeCentralHourlySync_();
  notify_('ยกเลิกการส่งอัตโนมัติแล้ว');
}

function removeCentralHourlySync_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pushCentralScoresToWebSilent_') ScriptApp.deleteTrigger(t);
  });
}

/** ใช้กับ trigger ตามเวลา (ไม่มีหน้าจอให้แสดงข้อความ) */
function pushCentralScoresToWebSilent_() {
  var result = pushCentralScores_();
  console.log(result.message);
}

/** ส่งทั้งแท็บ Central_Scores ไปเว็บ แล้วแจ้งผล */
function pushCentralScoresToWeb() {
  var result = pushCentralScores_();
  notify_(result.message);
}

function pushCentralScores_() {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('SHEET_SYNC_SECRET');
  if (!webhookUrl || !secret) {
    return { ok: false, message: 'ยังไม่ได้ตั้งค่า WEBHOOK_URL / SHEET_SYNC_SECRET ใน Script Properties' };
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(CENTRAL_TAB);
  if (!sheet) return { ok: false, message: 'ไม่พบแท็บ "' + CENTRAL_TAB + '"' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { ok: false, message: 'แท็บ "' + CENTRAL_TAB + '" ว่าง' };

  // getDisplayValues: ได้ค่าตามที่เห็นบนหน้าจอ (รหัสประจำตัวไม่กลายเป็น 36355.0)
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headers = values[0];
  var fieldByCol = [];
  var found = {};
  headers.forEach(function (h, i) {
    var field = CENTRAL_HEADER_MAP[String(h).trim()];
    if (field && !found[field]) {
      fieldByCol[i] = field;
      found[field] = true;
    }
  });
  var required = ['studentId', 'className', 'sportCode', 'levelOld', 'levelNew', 'totalScore'];
  var missing = required.filter(function (f) { return !found[f]; });
  if (missing.length) {
    return { ok: false, message: 'หัวคอลัมน์ในแท็บ ' + CENTRAL_TAB + ' ไม่ครบ ขาด: ' + missing.join(', ') + ' — ยังไม่ได้ส่งข้อมูล' };
  }

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = { rowNo: r + 1 };
    var hasValue = false;
    for (var c = 0; c < lastCol; c++) {
      if (!fieldByCol[c]) continue;
      var v = String(values[r][c]).trim();
      row[fieldByCol[c]] = v;
      if (v !== '') hasValue = true;
    }
    if (hasValue) rows.push(row);
  }

  var syncId = 'cs-' + new Date().getTime();
  var batches = Math.max(1, Math.ceil(rows.length / CENTRAL_BATCH_SIZE));
  var total = null;
  for (var b = 0; b < batches; b++) {
    var chunk = rows.slice(b * CENTRAL_BATCH_SIZE, (b + 1) * CENTRAL_BATCH_SIZE);
    var res = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': secret },
      payload: JSON.stringify({ tab: CENTRAL_TAB, syncId: syncId, rows: chunk, final: b === batches - 1 }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      // ชุดสุดท้ายยังไม่ถูกส่ง = เว็บยังแสดงข้อมูลรอบก่อนหน้าครบถ้วนตามเดิม
      return {
        ok: false,
        message: 'ส่งไม่สำเร็จที่ชุด ' + (b + 1) + '/' + batches + ' (HTTP ' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300) + '\nหน้าภาพรวมยังแสดงข้อมูลรอบก่อนหน้า',
      };
    }
    if (b === batches - 1) {
      try { total = JSON.parse(res.getContentText()).totalRows; } catch (e) { total = null; }
    }
  }

  if (total !== null && total !== rows.length) {
    return { ok: false, message: 'ส่งแล้วแต่จำนวนไม่ตรง: ชีตมี ' + rows.length + ' แถว เว็บรับได้ ' + total + ' แถว กรุณาส่งใหม่อีกครั้ง' };
  }
  return { ok: true, message: 'ส่ง Central_Scores ไปหน้าภาพรวมแล้ว ' + rows.length + ' แถว' };
}

function notify_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    console.log(message);
  }
}
