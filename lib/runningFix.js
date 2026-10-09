/**
 * runningFix.js
 * -----------------------------------------------------------------------
 * เครื่องมือแก้ข้อมูลครั้งเดียว: ผลประเมินที่ถูกบันทึกผิดเป็นกีฬา "วิ่ง (Running)"
 *
 * ที่มาของปัญหา: สคริปต์ซิงก์ในไฟล์ Grade_<กีฬา> ของครูระบุชื่อกีฬาตายตัว (selectedSport)
 * ไฟล์ของบางกีฬาส่งมาเป็น "วิ่ง (Running)" ผลประเมินของนักเรียนกีฬานั้นจึงเข้ามาผิดชื่อ
 *
 * หลักการ: ไม่เดา — ย้ายเฉพาะรายการที่มีหลักฐานชี้กีฬาที่ถูกต้องชัดเจน
 *   หลักฐาน 1: รหัสวิชาของนักเรียนในแท็บ Central_Scores (รอบซิงก์ล่าสุด)
 *   หลักฐาน 2: กีฬาของนักเรียนคนเดียวกันในปีการศึกษาก่อนหน้า (ตาราง skill_logs)
 * ทุกแถวที่ถูกแก้/ลบ ถูกสำเนาไว้ในตาราง skill_logs_sport_fix_backup ก่อนเสมอ
 */
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { SPORTS_MASTER } from './sportsConfig.js';
import { SPORT_NAME_BY_CODE } from './centralAnalytics.js';

export const WRONG_SPORT = 'วิ่ง (Running)';

export const FIX_GROUPS = {
  confirmed: 'ยืนยันสองแหล่ง: Central_Scores และกีฬาปีก่อนหน้า ชี้กีฬาเดียวกัน',
  centralOnly: 'มีหลักฐานจาก Central_Scores อย่างเดียว (ไม่มีผลปีก่อนหน้า)',
  prevOnly: 'มีหลักฐานจากกีฬาปีก่อนหน้าอย่างเดียว (ไม่พบใน Central_Scores)',
  conflict: 'หลักฐานขัดกัน: Central_Scores กับกีฬาปีก่อนหน้า เป็นคนละกีฬา',
  unknown: 'ไม่มีหลักฐาน หรือมีหลายกีฬาจนชี้ไม่ได้',
};
export const MOVABLE_GROUPS = ['confirmed', 'centralOnly', 'prevOnly'];

/** classifyRunningLog: pure function — ตัดสินว่าแถว "วิ่ง" 1 แถวควรย้ายไปกีฬาใด จากหลักฐาน 2 แหล่ง */
export function classifyRunningLog(centralSports, prevSports) {
  const c = [...new Set(centralSports || [])];
  const p = [...new Set(prevSports || [])];
  if (c.length === 1 && p.length === 1) {
    return c[0] === p[0] ? { group: 'confirmed', target: c[0] } : { group: 'conflict', target: null };
  }
  if (c.length === 1 && p.length === 0) return { group: 'centralOnly', target: c[0] };
  if (c.length === 0 && p.length === 1) return { group: 'prevOnly', target: p[0] };
  return { group: 'unknown', target: null };
}

let backupReady = false;
async function ensureBackupTable() {
  if (backupReady) return;
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS skill_logs_sport_fix_backup (' +
      'id SERIAL PRIMARY KEY, ' +
      'skill_log_id INTEGER NOT NULL, ' +
      'action TEXT NOT NULL, ' +
      'original_sport TEXT NOT NULL, ' +
      'new_sport TEXT, ' +
      'original_row TEXT NOT NULL, ' +
      'fixed_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  backupReady = true;
}

async function tableExists(name) {
  const r = await prisma.$queryRaw`SELECT to_regclass(${'public.' + name})::text AS t`;
  return !!r[0]?.t;
}

/** buildRunningFixPlan: อ่านอย่างเดียว — วางแผนว่าแต่ละแถวจะทำอะไร (ไม่แก้ข้อมูล) */
export async function buildRunningFixPlan() {
  const validSports = new Set(Object.keys(SPORTS_MASTER).filter((s) => s !== WRONG_SPORT));
  const wrongLogs = await prisma.skillLog.findMany({ where: { selectedSport: WRONG_SPORT }, orderBy: { id: 'asc' } });
  const studentIds = [...new Set(wrongLogs.map((l) => l.studentId))];

  // หลักฐาน 1: Central_Scores รอบซิงก์ล่าสุด
  const centralByStudent = {};
  let centralSynced = false;
  if ((await tableExists('central_scores')) && (await tableExists('central_scores_sync'))) {
    const sync = await prisma.$queryRaw`SELECT sync_id FROM central_scores_sync ORDER BY completed_at DESC LIMIT 1`;
    if (sync.length > 0) {
      centralSynced = true;
      const rows = await prisma.$queryRaw`SELECT student_id, sport_code FROM central_scores WHERE sync_id = ${sync[0].sync_id}`;
      rows.forEach((r) => {
        const id = String(r.student_id || '').trim();
        const name = SPORT_NAME_BY_CODE[String(r.sport_code || '').trim().toUpperCase()];
        if (!id || !name || !validSports.has(name)) return;
        (centralByStudent[id] = centralByStudent[id] || new Set()).add(name);
      });
    }
  }

  // หลักฐาน 2 + ตรวจการชน: ผลประเมินอื่น ๆ ของนักเรียนกลุ่มนี้
  const otherLogs = studentIds.length
    ? await prisma.skillLog.findMany({ where: { studentId: { in: studentIds }, NOT: { selectedSport: WRONG_SPORT } } })
    : [];
  const prevByKey = {};
  const existingByKey = {};
  otherLogs.forEach((l) => {
    if (validSports.has(l.selectedSport)) {
      const k = l.studentId + '|' + l.academicYear;
      (prevByKey[k] = prevByKey[k] || new Set()).add(l.selectedSport);
    }
    existingByKey[[l.studentId, l.academicYear, l.selectedSport, l.skillName].join('|')] = l;
  });

  const items = wrongLogs.map((log) => {
    const central = [...(centralByStudent[log.studentId] || [])];
    const prev = [...(prevByKey[log.studentId + '|' + (log.academicYear - 1)] || [])];
    const { group, target } = classifyRunningLog(central, prev);
    let action = 'skip';
    let existing = null;
    if (target) {
      existing = existingByKey[[log.studentId, log.academicYear, target, log.skillName].join('|')] || null;
      if (!existing) action = 'move';
      else if (existing.finalLevel === log.finalLevel) action = 'removeDuplicate';
      else action = 'skipLevelMismatch';
    }
    return { log, group, target, action, central, prev, existingLevel: existing ? existing.finalLevel : null };
  });

  return { items, centralSynced };
}

function summarize(plan) {
  const groups = Object.keys(FIX_GROUPS).map((key) => {
    const list = plan.items.filter((i) => i.group === key);
    const byTarget = {};
    list.forEach((i) => {
      if (i.target) byTarget[i.target] = (byTarget[i.target] || 0) + 1;
    });
    return {
      key,
      label: FIX_GROUPS[key],
      movable: MOVABLE_GROUPS.includes(key),
      count: list.length,
      move: list.filter((i) => i.action === 'move').length,
      removeDuplicate: list.filter((i) => i.action === 'removeDuplicate').length,
      skipLevelMismatch: list.filter((i) => i.action === 'skipLevelMismatch').length,
      byTarget: Object.keys(byTarget).map((sport) => ({ sport, count: byTarget[sport] })).sort((a, b) => b.count - a.count),
      examples: list.slice(0, 15).map((i) => ({
        studentId: i.log.studentId,
        studentName: i.log.studentName,
        academicYear: i.log.academicYear,
        skillName: i.log.skillName,
        level: i.log.finalLevel,
        central: i.central,
        prev: i.prev,
        target: i.target,
        action: i.action,
        existingLevel: i.existingLevel,
      })),
    };
  });
  const byYear = {};
  const notes = {};
  let minTs = null;
  let maxTs = null;
  plan.items.forEach((i) => {
    byYear[i.log.academicYear] = (byYear[i.log.academicYear] || 0) + 1;
    const n = i.log.coachNotes || '(ไม่มีหมายเหตุ)';
    notes[n] = (notes[n] || 0) + 1;
    const t = i.log.timestamp.getTime();
    if (minTs === null || t < minTs) minTs = t;
    if (maxTs === null || t > maxTs) maxTs = t;
  });
  return {
    wrongSport: WRONG_SPORT,
    total: plan.items.length,
    students: new Set(plan.items.map((i) => i.log.studentId)).size,
    centralSynced: plan.centralSynced,
    byYear: Object.keys(byYear).sort().map((y) => ({ academicYear: Number(y), count: byYear[y] })),
    firstRecordedTs: minTs,
    lastRecordedTs: maxTs,
    coachNotes: Object.keys(notes).map((note) => ({ note, count: notes[note] })).sort((a, b) => b.count - a.count).slice(0, 5),
    groups,
  };
}

export async function getRunningFixReport() {
  return summarize(await buildRunningFixPlan());
}

/** applyRunningFix: ย้าย/ลบแถวซ้ำ เฉพาะกลุ่มที่เลือก — สำรองทุกแถวก่อน และทำในธุรกรรมเดียว */
export async function applyRunningFix({ groups, actor }) {
  const chosen = (Array.isArray(groups) ? groups : []).filter((g) => MOVABLE_GROUPS.includes(g));
  if (chosen.length === 0) throw new Error('ยังไม่ได้เลือกกลุ่มที่จะย้าย');
  await ensureBackupTable();
  const plan = await buildRunningFixPlan();
  const todo = plan.items.filter((i) => chosen.includes(i.group) && (i.action === 'move' || i.action === 'removeDuplicate'));
  const moves = todo.filter((i) => i.action === 'move');
  const dups = todo.filter((i) => i.action === 'removeDuplicate');
  if (todo.length === 0) return { moved: 0, duplicatesRemoved: 0, report: summarize(plan) };

  const backupValues = todo.map((i) =>
    Prisma.sql`(${i.log.id}, ${i.action}, ${WRONG_SPORT}, ${i.target}, ${JSON.stringify(i.log)})`
  );
  const moveValues = moves.map((i) => Prisma.sql`(${i.log.id}::int, ${i.target}::text)`);
  const byTarget = {};
  moves.forEach((i) => {
    byTarget[i.target] = (byTarget[i.target] || 0) + 1;
  });

  const ops = [
    prisma.$executeRaw`
      INSERT INTO skill_logs_sport_fix_backup (skill_log_id, action, original_sport, new_sport, original_row)
      VALUES ${Prisma.join(backupValues)}
    `,
  ];
  if (moves.length > 0) {
    ops.push(prisma.$executeRaw`
      UPDATE skill_logs AS s SET selected_sport = v.target
      FROM (VALUES ${Prisma.join(moveValues)}) AS v(id, target)
      WHERE s.id = v.id AND s.selected_sport = ${WRONG_SPORT}
    `);
  }
  if (dups.length > 0) {
    ops.push(prisma.$executeRaw`
      DELETE FROM skill_logs WHERE selected_sport = ${WRONG_SPORT} AND id IN (${Prisma.join(dups.map((i) => i.log.id))})
    `);
  }
  ops.push(
    prisma.auditLog.create({
      data: {
        action: 'ADMIN_FIX_RUNNING_SPORT',
        actor: actor || '(ไม่ทราบผู้ใช้)',
        sport: WRONG_SPORT,
        studentCount: new Set(todo.map((i) => i.log.studentId)).size,
        details: `แก้ผลประเมินที่บันทึกผิดเป็น "${WRONG_SPORT}": ย้ายกลับกีฬาที่ถูกต้อง ${moves.length} รายการ ${JSON.stringify(byTarget)}, ลบแถวซ้ำ (มีผลกีฬาที่ถูกต้องระดับเดียวกันอยู่แล้ว) ${dups.length} รายการ — กลุ่มหลักฐานที่ใช้: ${chosen.join(', ')} — สำเนาแถวเดิมอยู่ในตาราง skill_logs_sport_fix_backup`,
      },
    })
  );
  const results = await prisma.$transaction(ops);
  return {
    moved: moves.length ? results[1] : 0,
    duplicatesRemoved: dups.length ? results[moves.length ? 2 : 1] : 0,
    byTarget,
    report: await getRunningFixReport(),
  };
}
