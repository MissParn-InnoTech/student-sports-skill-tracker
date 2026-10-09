/**
 * centralAnalytics.js
 * -----------------------------------------------------------------------
 * คำนวณ "ภาพรวมระบบ" จากข้อมูลแท็บ Central_Scores ของ Google Sheet (Master_Sports_System)
 * เป็น pure function ล้วน (ไม่แตะ DB) ทดสอบได้ด้วย node lib/__tests__/centralAnalytics.test.mjs
 *
 * โครงแถวที่รับ (1 แถว = นักเรียน 1 คนใน 1 วิชากีฬา):
 *   { studentId, prefix, firstName, lastName, className, sportCode, levelOld, levelNew, totalScore }
 *
 * หลักการรายงาน: นับเฉพาะสิ่งที่มีอยู่จริงในชีต ไม่เดา ไม่เติมค่า
 *   - "ประเมินแล้ว" = แถวที่กรอก LV.ใหม่ เป็นระดับที่ถูกต้อง (PL, L1-L6)
 *   - การเลื่อนระดับ คิดเฉพาะแถวที่มีทั้ง LV.เดิม และ LV.ใหม่ ที่ถูกต้อง
 *   - แถวที่มีปัญหา (ไม่มีรหัส, รหัสวิชาไม่รู้จัก, ระดับพิมพ์ผิด, ซ้ำ) ถูกรายงานแยกในส่วนคุณภาพข้อมูล
 */

export const CENTRAL_LEVELS = ['PL', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

/** รหัสวิชา -> ชื่อกีฬา ตามแท็บ "รหัส" / System_Config ของ Master_Sports_System */
export const SPORT_NAME_BY_CODE = {
  FS: 'ฟุตซอล (Futsal)',
  BB: 'บาสเกตบอล (Basketball)',
  SW: 'ว่ายน้ำ (Swimming)',
  BX: 'มวย (Boxing/Muay Thai)',
  BAD: 'แบดมินตัน (Badminton)',
  TT: 'ปิงปอง (Table Tennis)',
  CB: 'ปีนหน้าผา (Rock Climbing)',
  G: 'กอล์ฟ (Golf)',
  TK: 'เทควันโด (Taekwondo)',
  TN: 'เทนนิส (Tennis)',
  D: 'เต้น (Dance)',
};

const GRADE_ORDER = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

function text(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** ตัดช่องว่างทั้งหมดในชื่อห้อง เพื่อไม่ให้ "ป.2/ B" กับ "ป.2/B" ถูกนับเป็นคนละห้อง */
export function normalizeClassName(v) {
  return text(v).replace(/\s+/g, '');
}

export function normalizeSportCode(v) {
  return text(v).toUpperCase();
}

/** คืน index ของระดับ (PL=0, L1=1 ... L6=6) หรือ null ถ้าว่าง/ไม่ใช่ระดับที่รู้จัก */
export function levelIndex(v) {
  const s = text(v).toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  const i = CENTRAL_LEVELS.indexOf(s);
  return i === -1 ? null : i;
}

function parseScore(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function gradeOf(className) {
  const i = className.indexOf('/');
  return i === -1 ? className : className.slice(0, i);
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10; // ทศนิยม 1 ตำแหน่ง
}

function sortClass(a, b) {
  return a.localeCompare(b, 'th', { numeric: true });
}

function sortGrade(a, b) {
  const ia = GRADE_ORDER.indexOf(a);
  const ib = GRADE_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return sortClass(a, b);
}

function newBucket() {
  return { records: 0, assessed: 0, withScore: 0, scoreSum: 0, comparable: 0, levelUp: 0, levelSame: 0, levelDown: 0 };
}

function addToBucket(b, r) {
  b.records++;
  if (r.newIdx !== null) b.assessed++;
  if (r.score !== null) {
    b.withScore++;
    b.scoreSum += r.score;
  }
  if (r.newIdx !== null && r.oldIdx !== null) {
    b.comparable++;
    if (r.newIdx > r.oldIdx) b.levelUp++;
    else if (r.newIdx < r.oldIdx) b.levelDown++;
    else b.levelSame++;
  }
}

function finishBucket(b) {
  return {
    records: b.records,
    assessed: b.assessed,
    pending: b.records - b.assessed,
    assessedPct: pct(b.assessed, b.records),
    withScore: b.withScore,
    avgScore: b.withScore ? Math.round((b.scoreSum / b.withScore) * 100) / 100 : null,
    comparable: b.comparable,
    levelUp: b.levelUp,
    levelSame: b.levelSame,
    levelDown: b.levelDown,
    levelUpPct: b.comparable ? pct(b.levelUp, b.comparable) : null,
  };
}

/**
 * computeCentralOverview: สรุปภาพรวมจากแถว Central_Scores ทั้งหมด
 * แถวที่ว่างทั้งแถวจะถูกข้าม (ไม่นับเป็นรายการ)
 */
export function computeCentralOverview(rawRows) {
  const rows = [];
  let blankRows = 0;
  (rawRows || []).forEach((raw, i) => {
    const studentId = text(raw.studentId);
    const className = normalizeClassName(raw.className);
    const sportCode = normalizeSportCode(raw.sportCode);
    const name = [text(raw.prefix), [text(raw.firstName), text(raw.lastName)].filter(Boolean).join(' ')].filter(Boolean).join('');
    const levelOldText = text(raw.levelOld);
    const levelNewText = text(raw.levelNew);
    const scoreText = text(raw.totalScore);
    if (!studentId && !className && !sportCode && !name && !levelOldText && !levelNewText && !scoreText) {
      blankRows++;
      return;
    }
    rows.push({
      rowNo: raw.rowNo ?? i + 2,
      studentId,
      name,
      className,
      classNameRaw: text(raw.className),
      sportCode,
      levelOldText,
      levelNewText,
      oldIdx: levelIndex(raw.levelOld),
      newIdx: levelIndex(raw.levelNew),
      score: parseScore(raw.totalScore),
      scoreText,
    });
  });

  const total = newBucket();
  const sportBuckets = {};
  const gradeBuckets = {};
  const classBuckets = {};
  const oldDist = CENTRAL_LEVELS.map(() => 0);
  const newDist = CENTRAL_LEVELS.map(() => 0);
  const studentIds = new Set();
  const keyCount = {};

  const issues = {
    missingStudentId: [],
    missingSportCode: [],
    missingClass: [],
    unknownSportCode: [],
    invalidLevel: [],
    invalidScore: [],
    scoreWithoutLevel: [],
    duplicates: [],
    classNameCleaned: [],
  };
  const sample = (list, r, note) => {
    list.push({ rowNo: r.rowNo, studentId: r.studentId, name: r.name, className: r.className, sportCode: r.sportCode, note });
  };

  rows.forEach((r) => {
    addToBucket(total, r);
    if (r.studentId) studentIds.add(r.studentId);
    else sample(issues.missingStudentId, r, 'ไม่มีรหัสประจำตัว');

    if (!r.sportCode) sample(issues.missingSportCode, r, 'ไม่มีรหัสวิชา');
    else if (!SPORT_NAME_BY_CODE[r.sportCode]) sample(issues.unknownSportCode, r, 'รหัสวิชา "' + r.sportCode + '" ไม่อยู่ในตารางรหัส');

    if (!r.className) sample(issues.missingClass, r, 'ไม่มีชั้น/ห้อง');
    else if (r.classNameRaw !== r.className) sample(issues.classNameCleaned, r, 'ชื่อห้องในชีตคือ "' + r.classNameRaw + '"');

    if (r.levelOldText && r.oldIdx === null) sample(issues.invalidLevel, r, 'LV.เดิม = "' + r.levelOldText + '"');
    if (r.levelNewText && r.newIdx === null) sample(issues.invalidLevel, r, 'LV.ใหม่ = "' + r.levelNewText + '"');
    if (r.scoreText && r.score === null) sample(issues.invalidScore, r, 'คะแนนรวม = "' + r.scoreText + '"');
    if (r.score !== null && r.newIdx === null) sample(issues.scoreWithoutLevel, r, 'มีคะแนนรวม ' + r.score + ' แต่ยังไม่มี LV.ใหม่');

    if (r.studentId && r.sportCode) {
      const k = r.studentId + '|' + r.sportCode;
      keyCount[k] = (keyCount[k] || 0) + 1;
    }

    const sportKey = r.sportCode || '(ไม่ระบุ)';
    if (!sportBuckets[sportKey]) sportBuckets[sportKey] = newBucket();
    addToBucket(sportBuckets[sportKey], r);

    const classKey = r.className || '(ไม่ระบุ)';
    if (!classBuckets[classKey]) classBuckets[classKey] = newBucket();
    addToBucket(classBuckets[classKey], r);

    const gradeKey = r.className ? gradeOf(r.className) : '(ไม่ระบุ)';
    if (!gradeBuckets[gradeKey]) gradeBuckets[gradeKey] = newBucket();
    addToBucket(gradeBuckets[gradeKey], r);

    if (r.oldIdx !== null) oldDist[r.oldIdx]++;
    if (r.newIdx !== null) newDist[r.newIdx]++;
  });

  rows.forEach((r) => {
    if (r.studentId && r.sportCode && keyCount[r.studentId + '|' + r.sportCode] > 1) {
      sample(issues.duplicates, r, 'รหัส ' + r.studentId + ' ซ้ำในวิชา ' + r.sportCode + ' ' + keyCount[r.studentId + '|' + r.sportCode] + ' แถว');
    }
  });

  const bySport = Object.keys(sportBuckets)
    .map((code) => ({
      code,
      name: SPORT_NAME_BY_CODE[code] || (code === '(ไม่ระบุ)' ? 'ไม่ระบุรหัสวิชา' : 'รหัส ' + code + ' (ไม่อยู่ในตารางรหัส)'),
      sharePct: pct(sportBuckets[code].records, total.records),
      ...finishBucket(sportBuckets[code]),
    }))
    .sort((a, b) => b.records - a.records || a.code.localeCompare(b.code));

  const byGrade = Object.keys(gradeBuckets)
    .sort(sortGrade)
    .map((grade) => ({
      grade,
      ...finishBucket(gradeBuckets[grade]),
      classes: Object.keys(classBuckets)
        .filter((c) => (c === '(ไม่ระบุ)' ? grade === '(ไม่ระบุ)' : gradeOf(c) === grade))
        .sort(sortClass)
        .map((className) => ({ className, ...finishBucket(classBuckets[className]) })),
    }));

  const ISSUE_LABELS = {
    missingStudentId: 'ไม่มีรหัสประจำตัว',
    missingSportCode: 'ไม่มีรหัสวิชา',
    missingClass: 'ไม่มีชั้น/ห้อง',
    unknownSportCode: 'รหัสวิชาไม่อยู่ในตารางรหัส',
    invalidLevel: 'ระดับ (LV) ไม่ใช่ PL หรือ L1-L6',
    invalidScore: 'คะแนนรวมไม่ใช่ตัวเลข',
    scoreWithoutLevel: 'มีคะแนนรวมแต่ยังไม่กรอก LV.ใหม่',
    duplicates: 'รายการซ้ำ (รหัสประจำตัว + วิชาเดียวกัน)',
    classNameCleaned: 'ชื่อห้องมีช่องว่างเกิน (ระบบรวมให้แล้ว)',
  };
  const dataQuality = Object.keys(issues)
    .map((key) => ({ key, label: ISSUE_LABELS[key], count: issues[key].length, examples: issues[key].slice(0, 20) }))
    .filter((q) => q.count > 0);

  return {
    totals: {
      ...finishBucket(total),
      uniqueStudents: studentIds.size,
      sportCount: Object.keys(sportBuckets).filter((c) => c !== '(ไม่ระบุ)').length,
      classCount: Object.keys(classBuckets).filter((c) => c !== '(ไม่ระบุ)').length,
      blankRowsSkipped: blankRows,
    },
    bySport,
    byGrade,
    levelDistribution: CENTRAL_LEVELS.map((level, i) => ({
      level,
      oldCount: oldDist[i],
      newCount: newDist[i],
    })),
    levelOldFilled: oldDist.reduce((a, b) => a + b, 0),
    levelNewFilled: newDist.reduce((a, b) => a + b, 0),
    dataQuality,
  };
}
