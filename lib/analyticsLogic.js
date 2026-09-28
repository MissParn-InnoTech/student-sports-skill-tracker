/**
 * analyticsLogic.js
 * -----------------------------------------------------------------------
 * Pure logic สำหรับ Executive Dashboard ขั้นสูง (ไม่แตะฐานข้อมูลโดยตรง):
 *  - Retention Rate by Sport: นักเรียนที่เรียนกีฬานั้นจนถึง Level สูงสุด (6) กี่% เทียบกับที่ย้ายกลางคัน
 *  - Average Time-to-Level-Up (TLU): จำนวน "รอบการประเมิน" เฉลี่ยที่ใช้ต่อการเลื่อนขึ้น 1 Level ต่อกีฬา
 *  - Cumulative Achievement: จำนวนนักเรียนที่ทำ Level สูงสุดสำเร็จ แยกตามกีฬา + รวมทั้งโรงเรียน
 *
 * หมายเหตุสำคัญ: ระบบบันทึกผลเป็น "รอบการประเมิน" (ครูกรอกคะแนน 1 ครั้ง มักเป็นรายปีการศึกษา)
 * ไม่ได้ละเอียดถึงระดับ "คาบเรียน" รายครั้ง ดังนั้น Time-to-Level-Up ที่คำนวณได้ในที่นี้คือ
 * "จำนวนรอบการประเมินเฉลี่ยต่อการขึ้น 1 Level" ไม่ใช่จำนวนคาบเรียนจริง
 */
import { groupLogsIntoRounds, avgOf } from './skillLogic.js';
import { getSkillsForSport } from './sportsConfig.js';

/** ถือว่า "ถึง Level สูงสุดแล้ว" เมื่อค่าเฉลี่ยทุกทักษะของรอบนั้น >= เกณฑ์นี้ (จาก 6) */
export const MAX_LEVEL_THRESHOLD = 5.5;

/**
 * จัดรอบการประเมิน (เรียงตามเวลาแล้ว) ของนักเรียน 1 คน ให้เป็น "ช่วงการเล่นกีฬาต่อเนื่อง" (stint)
 * เช่น เล่นฟุตซอล 3 ปีติด แล้วเปลี่ยนไปบาสเกตบอล 2 ปี = 2 stints
 */
function buildStints(rounds) {
  const stints = [];
  let current = null;
  rounds.forEach((r) => {
    if (current && current.sport === r.sport) {
      current.rounds.push(r);
    } else {
      current = { sport: r.sport, rounds: [r] };
      stints.push(current);
    }
  });
  return stints;
}

/**
 * computeSportAnalytics: คำนวณ Retention Rate, Average TLU, และจำนวนนักเรียนที่ถึง Level สูงสุด แยกตามกีฬา
 * @param {Record<string, Array>} logsByStudent { studentId: [SkillLog แถวดิบ จาก Prisma, ...] }
 * @returns {{ bySport: Array<{sport, graduated, switchedAway, stillActive, retentionRate, avgRoundsPerLevel}>, totalMaxAchievers: number }}
 */
export function computeSportAnalytics(logsByStudent) {
  const perSport = {};
  const schoolWideAchievers = new Set();

  function getSportBucket(sport) {
    if (!perSport[sport]) {
      perSport[sport] = { graduatedStudents: new Set(), switchedAway: 0, stillActive: 0, roundsSum: 0, levelUpSum: 0 };
    }
    return perSport[sport];
  }

  Object.entries(logsByStudent).forEach(([studentId, logs]) => {
    const rounds = groupLogsIntoRounds(logs).sort((a, b) => a.year - b.year || a.ts - b.ts);
    if (rounds.length === 0) return;
    const stints = buildStints(rounds);

    stints.forEach((stint, idx) => {
      const sport = stint.sport;
      let skills;
      try {
        skills = getSkillsForSport(sport);
      } catch {
        return; // ข้ามกีฬาที่ไม่รู้จักในปัจจุบัน (เผื่อข้อมูลเก่า/ชื่อกีฬาที่เปลี่ยนไปแล้ว)
      }
      const bucket = getSportBucket(sport);
      const isLastStint = idx === stints.length - 1;
      const firstAvg = avgOf(stint.rounds[0].levels, skills);
      const lastAvg = avgOf(stint.rounds[stint.rounds.length - 1].levels, skills);
      const reachedMax = lastAvg >= MAX_LEVEL_THRESHOLD;

      if (reachedMax) {
        bucket.graduatedStudents.add(studentId);
        schoolWideAchievers.add(studentId);
      } else if (!isLastStint) {
        // ยังไม่ถึง Level สูงสุด แต่มีช่วงกีฬาอื่นตามมาทีหลัง = ย้ายกลางคัน
        bucket.switchedAway += 1;
      } else {
        // ช่วงล่าสุดของนักเรียนคนนี้ ยังไม่ถึง Level สูงสุด และยังไม่ย้ายไปไหน = กำลังเรียนต่อ (ยังสรุปผลไม่ได้)
        bucket.stillActive += 1;
      }

      if (stint.rounds.length > 1 && lastAvg > firstAvg) {
        bucket.roundsSum += stint.rounds.length - 1;
        bucket.levelUpSum += lastAvg - firstAvg;
      }
    });
  });

  const bySport = Object.keys(perSport)
    .map((sport) => {
      const b = perSport[sport];
      const graduated = b.graduatedStudents.size;
      const resolved = graduated + b.switchedAway;
      return {
        sport,
        graduated,
        switchedAway: b.switchedAway,
        stillActive: b.stillActive,
        retentionRate: resolved ? Math.round((graduated / resolved) * 100) : null,
        avgRoundsPerLevel: b.levelUpSum > 0 ? +(b.roundsSum / b.levelUpSum).toFixed(1) : null,
      };
    })
    .sort((a, b) => (b.retentionRate ?? -1) - (a.retentionRate ?? -1));

  return { bySport, totalMaxAchievers: schoolWideAchievers.size };
}

/**
 * computeYearlyPopularity: ดัชนีชี้วัดความนิยมกีฬารายปี (Year-Over-Year Sport Popularity)
 * นับจำนวนนักเรียน "ไม่ซ้ำคน" ต่อกีฬาต่อปีการศึกษา (ถ้านักเรียนคนเดียวมีหลายรอบของกีฬาเดียวกันในปีเดียวกัน นับครั้งเดียว)
 * @param {Record<string, Array>} logsByStudent { studentId: [SkillLog แถวดิบ จาก Prisma, ...] }
 * @returns {{ years: number[], rows: Array<{ sport: string, series: Array<{year:number, count:number, delta:number|null, pctChange:number|null}> }> }}
 */
export function computeYearlyPopularity(logsByStudent) {
  const studentsBySportYear = {}; // sport -> year -> Set(studentId)
  const yearsSet = new Set();

  Object.entries(logsByStudent).forEach(([studentId, logs]) => {
    const rounds = groupLogsIntoRounds(logs);
    rounds.forEach((r) => {
      yearsSet.add(r.year);
      if (!studentsBySportYear[r.sport]) studentsBySportYear[r.sport] = {};
      if (!studentsBySportYear[r.sport][r.year]) studentsBySportYear[r.sport][r.year] = new Set();
      studentsBySportYear[r.sport][r.year].add(studentId);
    });
  });

  const years = [...yearsSet].sort((a, b) => a - b);

  const rows = Object.keys(studentsBySportYear)
    .map((sport) => {
      let prevCount = null;
      const series = years.map((year) => {
        const count = studentsBySportYear[sport][year] ? studentsBySportYear[sport][year].size : 0;
        const delta = prevCount === null ? null : count - prevCount;
        const pctChange = prevCount ? +(((count - prevCount) / prevCount) * 100).toFixed(0) : null;
        prevCount = count;
        return { year, count, delta, pctChange };
      });
      const latestCount = series.length ? series[series.length - 1].count : 0;
      return { sport, series, latestCount };
    })
    .sort((a, b) => b.latestCount - a.latestCount);

  return { years, rows };
}

/**
 * computeSportSwitchingRates: วิเคราะห์ว่านักเรียนที่เลิกเล่นกีฬาหนึ่ง มักย้ายไปเล่นกีฬาใดต่อมากที่สุด
 * ใช้ "ช่วงการเล่นกีฬาต่อเนื่อง" (stint) ของนักเรียนแต่ละคน แล้วนับการเปลี่ยนจาก stint หนึ่งไป stint ถัดไป
 * @param {Record<string, Array>} logsByStudent { studentId: [SkillLog แถวดิบ จาก Prisma, ...] }
 * @returns {Array<{ from: string, totalSwitches: number, top: Array<{ to: string, count: number, pct: number }> }>}
 */
export function computeSportSwitchingRates(logsByStudent) {
  const transitions = {}; // fromSport -> toSport -> count

  Object.values(logsByStudent).forEach((logs) => {
    const rounds = groupLogsIntoRounds(logs).sort((a, b) => a.year - b.year || a.ts - b.ts);
    if (rounds.length === 0) return;
    const stints = buildStints(rounds);
    for (let i = 0; i < stints.length - 1; i++) {
      const from = stints[i].sport;
      const to = stints[i + 1].sport;
      if (!transitions[from]) transitions[from] = {};
      transitions[from][to] = (transitions[from][to] || 0) + 1;
    }
  });

  return Object.keys(transitions)
    .map((from) => {
      const destinations = transitions[from];
      const totalSwitches = Object.values(destinations).reduce((a, b) => a + b, 0);
      const top = Object.keys(destinations)
        .map((to) => ({ to, count: destinations[to], pct: Math.round((destinations[to] / totalSwitches) * 100) }))
        .sort((a, b) => b.count - a.count);
      return { from, totalSwitches, top };
    })
    .sort((a, b) => b.totalSwitches - a.totalSwitches);
}
