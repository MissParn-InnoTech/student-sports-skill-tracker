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
