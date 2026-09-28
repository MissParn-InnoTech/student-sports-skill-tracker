/**
 * skillLogic.js
 * -----------------------------------------------------------------------
 * Pure business logic (ไม่แตะฐานข้อมูลโดยตรง) - พอร์ตมาจาก Code.gs เดิม (Google Apps Script)
 * แยกไว้เป็นฟังก์ชัน pure เพื่อให้ unit test ได้ง่ายโดยไม่ต้องพึ่ง DB จริง
 *
 * "รอบการประเมิน" (round) = ชุด log ที่มี ปีการศึกษา + กีฬา + เวลาบันทึก (ระดับวินาที) เดียวกัน
 * เพราะ saveBulkScores บันทึกทุกทักษะของนักเรียน 1 คนพร้อมกันในคำขอเดียว
 */

import { getSkillsForSport } from './sportsConfig.js';

/**
 * จัดกลุ่ม log ของนักเรียน 1 คน ให้เป็น "รอบการประเมิน" แต่ละรอบ
 * @param {Array<{timestamp:Date, academicYear:number, selectedSport:string, skillName:string, finalLevel:number, coachNotes:string}>} logs
 * @returns {Array<{year:number, sport:string, ts:number, levels:Record<string,number>, note:string}>}
 */
export function groupLogsIntoRounds(logs) {
  const roundMap = {};
  logs.forEach((log) => {
    const tsMs = new Date(log.timestamp).getTime();
    const key = log.academicYear + '|' + log.selectedSport + '|' + Math.floor(tsMs / 1000);
    if (!roundMap[key]) {
      roundMap[key] = {
        year: log.academicYear,
        sport: log.selectedSport,
        ts: tsMs,
        levels: {},
        note: log.coachNotes || '',
      };
    }
    roundMap[key].levels[log.skillName] = log.finalLevel;
    if (log.coachNotes) roundMap[key].note = log.coachNotes;
    if (tsMs > roundMap[key].ts) roundMap[key].ts = tsMs;
  });
  return Object.values(roundMap);
}

/**
 * หา "รอบล่าสุด" จากรายการรอบทั้งหมด (เรียงตาม ts ใหม่สุดก่อน)
 */
export function latestRound(rounds) {
  if (!rounds.length) return null;
  return [...rounds].sort((a, b) => b.ts - a.ts)[0];
}

/**
 * Year-to-Year Logic หลักของระบบ:
 * ดูว่านักเรียน 1 คน ควรเริ่มต้นกีฬาที่เลือกปีนี้ที่ระดับเท่าไหร่
 *
 * เงื่อนไข:
 *   - ถ้าปีก่อนหน้า (year-1) เคยเล่นกีฬาเดียวกัน -> ต่อยอด (isCarryOver=true, เริ่มจาก Level ล่าสุดของปีก่อน)
 *   - ถ้าปีก่อนหน้าเคยเล่นกีฬาอื่น -> เปลี่ยนกีฬา (isCarryOver=false, previousSport=กีฬาเดิม, เริ่ม Level 1 ทุกทักษะ)
 *   - ถ้าไม่มีประวัติเลย -> นักเรียนใหม่ (isCarryOver=false, previousSport=null, เริ่ม Level 1 ทุกทักษะ)
 *
 * @param {number} academicYear ปีการศึกษาที่กำลังจะกรอกคะแนน
 * @param {string} selectedSport กีฬาที่โค้ชเลือกกรอกในปีนี้
 * @param {Array} allLogsForStudent log ทั้งหมดของนักเรียนคนนี้ (ทุกปี ทุกกีฬา)
 * @returns {{ isCarryOver: boolean, previousSport: string|null, skills: Array<{skillName:string, startingLevel:number}> }}
 */
export function computeStartingLevels(academicYear, selectedSport, allLogsForStudent) {
  const skillNames = getSkillsForSport(selectedSport);
  const prevYearLogs = allLogsForStudent.filter((l) => l.academicYear === academicYear - 1);
  const prevRounds = groupLogsIntoRounds(prevYearLogs);
  const prevLatest = latestRound(prevRounds);

  if (!prevLatest) {
    // ไม่มีประวัติปีก่อนหน้าเลย (นักเรียนใหม่ หรือปีแรกที่เข้าระบบ)
    return {
      isCarryOver: false,
      previousSport: null,
      skills: skillNames.map((skillName) => ({ skillName, startingLevel: 1 })),
    };
  }

  if (prevLatest.sport === selectedSport) {
    // เล่นกีฬาเดิมต่อเนื่อง -> ต่อยอดจาก Level ล่าสุด
    return {
      isCarryOver: true,
      previousSport: prevLatest.sport,
      skills: skillNames.map((skillName) => ({
        skillName,
        startingLevel: prevLatest.levels[skillName] || 1,
      })),
    };
  }

  // เปลี่ยนกีฬา -> รีเซ็ตเป็น Level 1 ทุกทักษะ แต่ยังบอกกีฬาเดิมไว้ให้ทราบ
  return {
    isCarryOver: false,
    previousSport: prevLatest.sport,
    skills: skillNames.map((skillName) => ({ skillName, startingLevel: 1 })),
  };
}

/** ตรวจความถูกต้องของ entry คะแนน 1 ทักษะ ก่อนบันทึก */
export function validateScoreEntry(entry) {
  const required = ['academicYear', 'studentId', 'studentName', 'selectedSport', 'skillName', 'finalLevel'];
  for (const key of required) {
    if (entry[key] === undefined || entry[key] === null || entry[key] === '') {
      throw new Error('ข้อมูลไม่ครบ: ขาดฟิลด์ "' + key + '"');
    }
  }
  const lv = Number(entry.finalLevel);
  if (!Number.isInteger(lv) || lv < 1 || lv > 6) {
    throw new Error('Final_Level ต้องเป็นเลขจำนวนเต็ม 1-6 เท่านั้น (ได้รับ: ' + entry.finalLevel + ')');
  }
  return true;
}

/**
 * avgOf: ค่าเฉลี่ย level เฉพาะทักษะที่มีค่า (ใช้ใน Class Report)
 */
export function avgOf(levels, skills) {
  let sum = 0;
  let cnt = 0;
  (skills || []).forEach((s) => {
    if (levels[s]) {
      sum += levels[s];
      cnt++;
    }
  });
  return cnt ? sum / cnt : 0;
}
