/**
 * CentralScoresSync.gs  (รุ่นรายงานผู้บริหาร)
 * -----------------------------------------------------------------------
 * ติดตั้งบน Google Sheet "Master_Sports_System"
 *   เปิด Sheet > ส่วนขยาย > Apps Script > เปิดไฟล์ CentralScoresSync เดิม
 *   > ลบโค้ดเดิมทั้งหมด > วางโค้ดนี้แทน > บันทึก > กลับไปรีเฟรชหน้า Sheet 1 ครั้ง
 *
 * ทำหน้าที่: ส่งข้อมูล 3 แท็บ (Student_Register, Central_Scores, Course_Register) ไปให้หน้า
 *   "รายงานผู้บริหาร" ของเว็บ  https://student-sports-skill-tracker.vercel.app/admin
 * อ่านอย่างเดียว ไม่แก้ไขข้อมูลใด ๆ ในชีต · Student_Register / Course_Register ส่งเฉพาะคอลัมน์ที่ใช้
 * ทำสถิติ (ไม่ส่งชื่อ-นามสกุล)
 *
 * ใช้ค่าตั้งเดิมของไฟล์นี้ (Script Properties):
 *   WEBHOOK_URL       = https://student-sports-skill-tracker.vercel.app/api/external/sheet-webhook
 *   SHEET_SYNC_SECRET = ค่าเดียวกับ env var SHEET_SYNC_SECRET บน Vercel
 *
 * ชื่อฟังก์ชันและ trigger เดิมยังใช้ได้ทั้งหมด (เมนู "📊 ภาพรวมเว็บ" และการส่งอัตโนมัติทุกชั่วโมง
 * จะส่งครบทั้ง 3 แท็บโดยไม่ต้องตั้งค่าใหม่)
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

/** แท็บทะเบียน: ส่งเฉพาะฟิลด์ที่ใช้ทำสถิติ */
var REGISTER_HEADER_MAP = {
  'รหัสประจำตัว': 'studentId',
  'คำนำหน้า': 'prefix',
  'ชั้น/ห้อง': 'className',
  'วิชา': 'sportCode',
  'รหัสวิชา': 'sportCode',
  'LV.เดิม': 'levelOld',
  'ประเภทคอร์ส': 'courseType',
  'ปีการศึกษา': 'academicYear',
  'สถานะส่ง': 'status',
};

var OVERVIEW_TABS = [
  { tab: 'Student_Register', map: REGISTER_HEADER_MAP, required: ['studentId', 'className', 'sportCode', 'levelOld'] },
  { tab: 'Central_Scores', map: CENTRAL_HEADER_MAP, required: ['studentId', 'className', 'sportCode', 'levelOld', 'levelNew', 'totalScore'] },
  { tab: 'Course_Register', map: REGISTER_HEADER_MAP, required: ['studentId', 'className', 'courseType'] },
];

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
    .addItem('ส่งข้อมูลทั้งหมดไปรายงานผู้บริหาร', 'pushCentralScoresToWeb')
    .addItem('ตั้งให้ส่งอัตโนมัติทุกชั่วโมง', 'installCentralHourlySync')
    .addItem('ยกเลิกการส่งอัตโนมัติ', 'removeCentralHourlySync')
    .addToUi();
}

function installCentralHourlySync() {
  removeCentralHourlySync_();
  ScriptApp.newTrigger('pushCentralScoresToWebSilent_').timeBased().everyHours(1).create();
  notify_('ตั้งค่าแล้ว: จะส่งข้อมูลไปหน้ารายงานผู้บริหารของเว็บทุก 1 ชั่วโมง');
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

/** ส่งทั้ง 3 แท็บไปเว็บ แล้วแจ้งผล */
function pushCentralScoresToWeb() {
  var result = pushCentralScores_();
  notify_(result.message);
}

/** ส่งทุกแท็บใน OVERVIEW_TABS ทีละแท็บ แท็บใดส่งไม่สำเร็จ เว็บจะยังแสดงข้อมูลรอบก่อนหน้าของแท็บนั้น */
function pushCentralScores_() {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('SHEET_SYNC_SECRET');
  if (!webhookUrl || !secret) {
    return { ok: false, message: 'ยังไม่ได้ตั้งค่า WEBHOOK_URL / SHEET_SYNC_SECRET ใน Script Properties' };
  }
  var ok = true;
  var lines = [];
  OVERVIEW_TABS.forEach(function (cfg) {
    var r = pushOneTab_(cfg, webhookUrl, secret);
    if (!r.ok) ok = false;
    lines.push((r.ok ? '✅ ' : '⚠️ ') + r.message);
  });
  return { ok: ok, message: lines.join('\n') };
}

function pushOneTab_(cfg, webhookUrl, secret) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(cfg.tab);
  if (!sheet) return { ok: false, message: 'ไม่พบแท็บ "' + cfg.tab + '"' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { ok: false, message: 'แท็บ "' + cfg.tab + '" ว่าง' };

  // getDisplayValues: ได้ค่าตามที่เห็นบนหน้าจอ (รหัสประจำตัวไม่กลายเป็น 36355.0)
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headers = values[0];
  var fieldByCol = [];
  var found = {};
  headers.forEach(function (h, i) {
    var field = cfg.map[String(h).trim()];
    if (field && !found[field]) {
      fieldByCol[i] = field;
      found[field] = true;
    }
  });
  var missing = cfg.required.filter(function (f) { return !found[f]; });
  if (missing.length) {
    return { ok: false, message: cfg.tab + ': หัวคอลัมน์ไม่ครบ ขาด ' + missing.join(', ') + ' — ยังไม่ได้ส่ง' };
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

  var syncId = 'ms-' + new Date().getTime();
  var batches = Math.max(1, Math.ceil(rows.length / CENTRAL_BATCH_SIZE));
  var total = null;
  for (var b = 0; b < batches; b++) {
    var chunk = rows.slice(b * CENTRAL_BATCH_SIZE, (b + 1) * CENTRAL_BATCH_SIZE);
    var res = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': secret },
      payload: JSON.stringify({ tab: cfg.tab, syncId: syncId, rows: chunk, final: b === batches - 1 }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      // ชุดสุดท้ายยังไม่ถูกส่ง = เว็บยังแสดงข้อมูลรอบก่อนหน้าครบถ้วนตามเดิม
      return {
        ok: false,
        message: cfg.tab + ': ส่งไม่สำเร็จที่ชุด ' + (b + 1) + '/' + batches + ' (HTTP ' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200),
      };
    }
    if (b === batches - 1) {
      try { total = JSON.parse(res.getContentText()).totalRows; } catch (e) { total = null; }
    }
  }

  if (total !== null && total !== rows.length) {
    return { ok: false, message: cfg.tab + ': จำนวนไม่ตรง ชีตมี ' + rows.length + ' แถว เว็บรับได้ ' + total + ' แถว กรุณาส่งใหม่' };
  }
  return { ok: true, message: cfg.tab + ': ส่งแล้ว ' + rows.length + ' แถว' };
}

function notify_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    console.log(message);
  }
}
