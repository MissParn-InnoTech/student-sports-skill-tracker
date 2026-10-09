/**
 * executiveAnalytics.js
 * -----------------------------------------------------------------------
 * คำนวณ "รายงานผู้บริหาร" (หน้า /admin) จาก 3 แท็บของ Google Sheet Master_Sports_System
 *   - Student_Register : ทะเบียนนักเรียนทั้งหมด (1 แถว = นักเรียน 1 คน + วิชากีฬาที่เรียน + LV.เดิม)
 *   - Central_Scores   : ผลการประเมิน (สรุปมาแล้วจาก computeCentralOverview)
 *   - Course_Register  : การลงทะเบียนคอร์สพิเศษ (AFTER SCHOOL / OCTOBER / SUMMER)
 *
 * เป็น pure function ล้วน (ไม่แตะ DB) ทดสอบได้ด้วย node lib/__tests__/executiveAnalytics.test.mjs
 * หลักการ: นับเฉพาะสิ่งที่มีอยู่จริงในชีต ไม่เดา ไม่เติมค่า
 */
import { CENTRAL_LEVELS, SPORT_NAME_BY_CODE, normalizeClassName, normalizeSportCode, levelIndex } from './centralAnalytics.js';

/**
 * ชื่อกีฬาของรหัสที่ใช้จริงใน Student_Register แต่ยังไม่มีในแท็บ "รหัส"
 * เติมชื่อที่ถูกต้องได้ที่นี่ เช่น BK: 'บาสเกตบอล' — รหัสที่ไม่มีชื่อจะแสดงเป็นรหัสอย่างเดียว
 */
export const EXTRA_SPORT_NAMES = {
  FB: 'ฟุตบอล (Football)', // มีในแท็บ "รหัส"
};

const GRADE_ORDER = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
const UNSPECIFIED = '(ไม่ระบุ)';

function text(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function gradeOf(className) {
  const i = className.indexOf('/');
  return i === -1 ? className : className.slice(0, i);
}

function roomOf(className) {
  const i = className.indexOf('/');
  return i === -1 ? '' : className.slice(i + 1);
}

function sortGrade(a, b) {
  const ia = GRADE_ORDER.indexOf(a);
  const ib = GRADE_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, 'th', { numeric: true });
}

export function sportName(code) {
  return SPORT_NAME_BY_CODE[code] || EXTRA_SPORT_NAMES[code] || null;
}

function genderOf(prefix) {
  const p = text(prefix);
  if (p === 'เด็กชาย' || p === 'นาย' || p === 'ด.ช.') return 'male';
  if (p === 'เด็กหญิง' || p === 'นางสาว' || p === 'นาง' || p === 'ด.ญ.') return 'female';
  return 'unknown';
}

/**
 * computeExecutiveReport
 * registerRows: [{ rowNo, studentId, prefix, className, sportCode, levelOld }]
 * courseRows:   [{ rowNo, studentId, className, sportCode, courseType, academicYear, status }]
 * central:      ผลจาก computeCentralOverview (หรือ null ถ้ายังไม่ซิงก์)
 */
export function computeExecutiveReport({ registerRows = [], courseRows = [], central = null } = {}) {
  const rows = [];
  for (const raw of registerRows) {
    const studentId = text(raw?.studentId);
    const className = normalizeClassName(raw?.className);
    const sportCode = normalizeSportCode(raw?.sportCode);
    const levelRaw = text(raw?.levelOld);
    if (!studentId && !className && !sportCode && !levelRaw) continue; // แถวว่าง
    rows.push({
      rowNo: raw?.rowNo ?? null,
      studentId,
      className,
      classRaw: text(raw?.className),
      grade: className ? gradeOf(className) : UNSPECIFIED,
      sportCode,
      levelRaw,
      levelIdx: levelIndex(levelRaw),
      gender: genderOf(raw?.prefix),
    });
  }

  const total = rows.length;
  const centralSports = {};
  for (const s of central?.bySport || []) centralSports[s.code] = s;

  // ---------- รายวิชากีฬา ----------
  const sportMap = {};
  const gradeMap = {};
  const classSet = new Set();
  const levelDist = CENTRAL_LEVELS.map(() => 0);
  const gender = { male: 0, female: 0, unknown: 0 };
  const idCount = {};
  const quality = { noId: 0, noClass: 0, noSport: 0, badLevel: 0, spacedClass: new Set() };

  for (const r of rows) {
    const code = r.sportCode || UNSPECIFIED;
    const s = (sportMap[code] ||= { code, count: 0, levels: CENTRAL_LEVELS.map(() => 0) });
    s.count++;
    if (r.levelIdx !== null) {
      s.levels[r.levelIdx]++;
      levelDist[r.levelIdx]++;
    }

    const g = (gradeMap[r.grade] ||= { grade: r.grade, count: 0, numbered: 0, lettered: 0, classes: new Set(), sports: {} });
    g.count++;
    const room = roomOf(r.className);
    if (/^\d+$/.test(room)) g.numbered++;
    else if (room) g.lettered++;
    if (r.className) {
      g.classes.add(r.className);
      classSet.add(r.className);
    }
    g.sports[code] = (g.sports[code] || 0) + 1;

    gender[r.gender]++;
    if (r.studentId) idCount[r.studentId] = (idCount[r.studentId] || 0) + 1;
    else quality.noId++;
    if (!r.className) quality.noClass++;
    else if (r.classRaw !== r.className) quality.spacedClass.add(r.classRaw);
    if (!r.sportCode) quality.noSport++;
    if (r.levelIdx === null) quality.badLevel++;
  }

  const bySport = Object.values(sportMap)
    .map((s) => {
      const c = centralSports[s.code];
      return {
        code: s.code,
        name: sportName(s.code),
        count: s.count,
        sharePct: pct(s.count, total),
        levels: s.levels,
        beyondPL: s.count - s.levels[0],
        beyondPLPct: pct(s.count - s.levels[0], s.count),
        inCentral: !!c,
        centralRecords: c ? c.records : 0,
        assessed: c ? c.assessed : 0,
        assessedPct: c ? c.assessedPct : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const sportCodes = bySport.map((s) => s.code);
  const byGrade = Object.values(gradeMap)
    .sort((a, b) => sortGrade(a.grade, b.grade))
    .map((g) => {
      const top = Object.entries(g.sports).sort((a, b) => b[1] - a[1])[0];
      return {
        grade: g.grade,
        count: g.count,
        numbered: g.numbered,
        lettered: g.lettered,
        classCount: g.classes.size,
        topSport: top ? { code: top[0], name: sportName(top[0]), count: top[1] } : null,
        bySport: sportCodes.map((c) => g.sports[c] || 0),
      };
    });

  const primary = byGrade.filter((g) => g.grade.startsWith('ป.')).reduce((a, g) => a + g.count, 0);
  const secondary = byGrade.filter((g) => g.grade.startsWith('ม.')).reduce((a, g) => a + g.count, 0);
  const numbered = byGrade.reduce((a, g) => a + g.numbered, 0);
  const lettered = byGrade.reduce((a, g) => a + g.lettered, 0);

  // ---------- การประเมิน (Central_Scores เทียบกับทะเบียน) ----------
  const ct = central?.totals || null;
  const notInCentral = bySport.filter((s) => !s.inCentral && s.code !== UNSPECIFIED);
  const assessment = {
    centralSynced: !!central,
    centralRecords: ct ? ct.records : 0,
    coveragePct: ct ? pct(ct.records, total) : 0,
    assessed: ct ? ct.assessed : 0,
    assessedPctOfCentral: ct ? ct.assessedPct : 0,
    assessedPctOfAll: ct ? pct(ct.assessed, total) : 0,
    levelUp: ct ? ct.levelUp : 0,
    comparable: ct ? ct.comparable : 0,
    levelUpPct: ct ? ct.levelUpPct : null,
    avgScore: ct ? ct.avgScore : null,
    sportsNotInCentral: notInCentral.map((s) => ({ code: s.code, name: s.name, count: s.count })),
    studentsNotInCentral: notInCentral.reduce((a, s) => a + s.count, 0),
  };

  // ---------- คอร์สพิเศษ ----------
  const courseTypes = {};
  const courseSports = {};
  let courseTotal = 0;
  let courseFilled = 0;
  let courseSent = 0;
  for (const raw of courseRows) {
    const studentId = text(raw?.studentId);
    const type = text(raw?.courseType).toUpperCase();
    if (!studentId && !type) continue;
    courseTotal++;
    if (!type) continue;
    courseFilled++;
    courseTypes[type] = (courseTypes[type] || 0) + 1;
    const code = normalizeSportCode(raw?.sportCode) || UNSPECIFIED;
    courseSports[code] = (courseSports[code] || 0) + 1;
    if (text(raw?.status).startsWith('ส่งแล้ว')) courseSent++;
  }
  const course = {
    rows: courseTotal,
    enrolled: courseFilled,
    enrolledPct: pct(courseFilled, courseTotal),
    sent: courseSent,
    byType: Object.entries(courseTypes).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    bySport: Object.entries(courseSports).map(([code, count]) => ({ code, name: sportName(code), count })).sort((a, b) => b.count - a.count),
  };

  // ---------- คุณภาพข้อมูล ----------
  const duplicateIds = Object.entries(idCount).filter(([, n]) => n > 1);
  const unknownCodes = bySport.filter((s) => s.code !== UNSPECIFIED && !s.name);
  const dataQuality = [];
  if (quality.noId) dataQuality.push({ key: 'noId', label: 'ไม่มีรหัสประจำตัว', count: quality.noId, unit: 'แถว' });
  if (quality.noClass) dataQuality.push({ key: 'noClass', label: 'ไม่มีชั้น/ห้อง', count: quality.noClass, unit: 'แถว' });
  if (quality.noSport) dataQuality.push({ key: 'noSport', label: 'ไม่มีรหัสวิชา', count: quality.noSport, unit: 'แถว' });
  if (quality.badLevel) dataQuality.push({ key: 'badLevel', label: 'LV.เดิม ว่างหรือไม่ใช่ PL, L1–L6', count: quality.badLevel, unit: 'แถว' });
  if (duplicateIds.length) {
    dataQuality.push({ key: 'dupId', label: 'รหัสประจำตัวซ้ำในทะเบียน', count: duplicateIds.length, unit: 'รหัส', detail: duplicateIds.slice(0, 10).map(([id]) => id).join(', ') });
  }
  if (unknownCodes.length) {
    dataQuality.push({ key: 'unknownCode', label: 'รหัสวิชาที่ยังไม่มีชื่อในแท็บ "รหัส"', count: unknownCodes.length, unit: 'รหัส', detail: unknownCodes.map((s) => s.code + ' (' + s.count + ' คน)').join(', ') });
  }
  if (quality.spacedClass.size) {
    dataQuality.push({ key: 'spacedClass', label: 'ชื่อห้องมีช่องว่างเกิน', count: quality.spacedClass.size, unit: 'ห้อง', detail: [...quality.spacedClass].map((c) => '"' + c + '"').join(', ') });
  }

  // ---------- ข้อสังเกตสำหรับผู้บริหาร (สร้างจากตัวเลขจริง) ----------
  const label = (s) => (s.name ? s.name.replace(/\s*\(.*\)$/, '') + ' (' + s.code + ')' : 'รหัส ' + s.code);
  const insights = [];
  if (total) {
    const top3 = bySport.slice(0, 3);
    insights.push({
      tone: 'info',
      title: 'กีฬาที่มีผู้เรียนมากที่สุด',
      text: top3.map((s) => label(s) + ' ' + s.count.toLocaleString('th-TH') + ' คน').join(' · ') + ' รวมเป็น ' + pct(top3.reduce((a, s) => a + s.count, 0), total) + '% ของนักเรียนทั้งหมด',
    });
    insights.push({
      tone: levelDist[0] / total > 0.5 ? 'warn' : 'info',
      title: 'ระดับทักษะเดิม',
      text: 'นักเรียน ' + pct(levelDist[0], total) + '% ยังอยู่ระดับ PL (เตรียมความพร้อม) และมีเพียง ' + pct(levelDist[4] + levelDist[5] + levelDist[6], total) + '% ที่อยู่ระดับ L4 ขึ้นไป',
    });
    const allPL = bySport.filter((s) => s.code !== UNSPECIFIED && s.count > 0 && s.beyondPL === 0);
    if (allPL.length) {
      insights.push({
        tone: 'warn',
        title: 'กีฬาที่ยังไม่มีการจัดระดับ',
        text: allPL.map(label).join(', ') + ' นักเรียนทุกคนยังเป็น PL รวม ' + allPL.reduce((a, s) => a + s.count, 0).toLocaleString('th-TH') + ' คน',
      });
    }
    if (!central) {
      insights.push({ tone: 'warn', title: 'ผลการประเมิน', text: 'ยังไม่มีข้อมูลจากแท็บ Central_Scores จึงยังรายงานความคืบหน้าการประเมินไม่ได้' });
    } else {
      insights.push({
        tone: assessment.assessed === 0 ? 'alert' : assessment.assessedPctOfCentral < 100 ? 'warn' : 'good',
        title: 'ความคืบหน้าการประเมิน',
        text:
          assessment.assessed === 0
            ? 'ยังไม่มีการกรอก LV.ใหม่ ในแท็บ Central_Scores เลย (0 จาก ' + assessment.centralRecords.toLocaleString('th-TH') + ' รายการ)'
            : 'ประเมินแล้ว ' + assessment.assessed.toLocaleString('th-TH') + ' จาก ' + assessment.centralRecords.toLocaleString('th-TH') + ' รายการ (' + assessment.assessedPctOfCentral + '%)',
      });
      if (assessment.sportsNotInCentral.length) {
        insights.push({
          tone: 'warn',
          title: 'กีฬาที่ยังไม่อยู่ในระบบลงคะแนน',
          text: assessment.sportsNotInCentral.map(label).join(', ') + ' รวม ' + assessment.studentsNotInCentral.toLocaleString('th-TH') + ' คน (' + pct(assessment.studentsNotInCentral, total) + '%) ยังไม่มีแถวใน Central_Scores',
        });
      }
    }
    if (course.rows) {
      insights.push({
        tone: course.enrolled === 0 ? 'warn' : 'info',
        title: 'คอร์สพิเศษ',
        text: 'ระบุคอร์สแล้ว ' + course.enrolled.toLocaleString('th-TH') + ' จาก ' + course.rows.toLocaleString('th-TH') + ' คน (' + course.enrolledPct + '%)' + (course.byType.length ? ' — ' + course.byType.map((t) => t.type + ' ' + t.count).join(', ') : ''),
      });
    }
  }

  return {
    totals: {
      students: total,
      uniqueStudents: Object.keys(idCount).length,
      classCount: classSet.size,
      gradeCount: byGrade.filter((g) => g.grade !== UNSPECIFIED).length,
      sportCount: bySport.filter((s) => s.code !== UNSPECIFIED).length,
      primary,
      primaryPct: pct(primary, total),
      secondary,
      secondaryPct: pct(secondary, total),
      numberedRooms: numbered,
      numberedRoomsPct: pct(numbered, total),
      letteredRooms: lettered,
      letteredRoomsPct: pct(lettered, total),
      male: gender.male,
      malePct: pct(gender.male, total),
      female: gender.female,
      femalePct: pct(gender.female, total),
    },
    levels: CENTRAL_LEVELS,
    levelDistribution: CENTRAL_LEVELS.map((level, i) => ({ level, count: levelDist[i], pct: pct(levelDist[i], total) })),
    bySport,
    sportCodes,
    byGrade,
    assessment,
    course,
    dataQuality,
    insights,
  };
}
