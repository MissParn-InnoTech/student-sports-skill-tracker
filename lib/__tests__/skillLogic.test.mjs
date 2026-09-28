/**
 * Quick standalone test runner (no test framework dependency) for lib/skillLogic.js
 * รันด้วย: node lib/__tests__/skillLogic.test.mjs
 */
import { computeStartingLevels, groupLogsIntoRounds, validateScoreEntry, avgOf } from '../skillLogic.js';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  OK:', msg);
}

console.log('=== TEST: computeStartingLevels - ต่อยอด (carry-over) ===');
{
  const logs = [
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Ball Control', finalLevel: 3, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Passing', finalLevel: 4, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Shooting', finalLevel: 2, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Defending', finalLevel: 3, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Agility', finalLevel: 5, timestamp: new Date('2025-03-15'), coachNotes: '' },
  ];
  const res = computeStartingLevels(2569, 'ฟุตซอล (Futsal)', logs);
  assert(res.isCarryOver === true, 'เล่นกีฬาเดิมต่อเนื่อง -> isCarryOver = true');
  assert(res.previousSport === 'ฟุตซอล (Futsal)', 'previousSport ถูกต้อง');
  assert(JSON.stringify(res.skills.map((s) => s.startingLevel)) === JSON.stringify([3, 4, 2, 3, 5]),
    'starting levels ตรงกับปีก่อน [3,4,2,3,5]');
}

console.log('\n=== TEST: computeStartingLevels - เปลี่ยนกีฬา (reset) ===');
{
  const logs = [
    { academicYear: 2568, selectedSport: 'บาสเกตบอล (Basketball)', skillName: 'Dribbling', finalLevel: 4, timestamp: new Date('2025-03-15'), coachNotes: '' },
  ];
  const res = computeStartingLevels(2569, 'ฟุตซอล (Futsal)', logs);
  assert(res.isCarryOver === false, 'เปลี่ยนกีฬา -> isCarryOver = false');
  assert(res.previousSport === 'บาสเกตบอล (Basketball)', 'previousSport = กีฬาเดิมที่เคยเล่น');
  assert(res.skills.every((s) => s.startingLevel === 1), 'ทุกทักษะเริ่มที่ Level 1 หลังเปลี่ยนกีฬา');
}

console.log('\n=== TEST: computeStartingLevels - นักเรียนใหม่ ไม่มีประวัติ ===');
{
  const res = computeStartingLevels(2569, 'เทควันโด (Taekwondo)', []);
  assert(res.isCarryOver === false && res.previousSport === null, 'นักเรียนใหม่ -> ไม่มี previousSport');
  assert(res.skills.every((s) => s.startingLevel === 1), 'ทุกทักษะเริ่มที่ Level 1');
}

console.log('\n=== TEST: computeStartingLevels - ปีปัจจุบันต้องไม่ปนกับปีก่อนหน้า ===');
{
  const logs = [
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Ball Control', finalLevel: 3, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Passing', finalLevel: 4, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Shooting', finalLevel: 2, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Defending', finalLevel: 3, timestamp: new Date('2025-03-15'), coachNotes: '' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Agility', finalLevel: 5, timestamp: new Date('2025-03-15'), coachNotes: '' },
    // เผลอมี log ปี 2569 (ปีเดียวกับที่กำลัง query) ปนอยู่ด้วย - ต้องไม่ถูกเอามาคิดเป็น "ปีก่อนหน้า"
    { academicYear: 2569, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Ball Control', finalLevel: 4, timestamp: new Date('2026-03-15'), coachNotes: '' },
  ];
  const res = computeStartingLevels(2569, 'ฟุตซอล (Futsal)', logs);
  assert(res.skills.find((s) => s.skillName === 'Ball Control').startingLevel === 3,
    'ยังอ้างอิง log ปี 2568 (Level 3) ไม่หยิบ log ปี 2569 ที่เพิ่งบันทึกมาปนกัน');
}

console.log('\n=== TEST: groupLogsIntoRounds ===');
{
  const logs = [
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Ball Control', finalLevel: 3, timestamp: new Date('2025-03-15T09:00:00'), coachNotes: 'ดีขึ้น' },
    { academicYear: 2568, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Passing', finalLevel: 4, timestamp: new Date('2025-03-15T09:00:00'), coachNotes: '' },
    { academicYear: 2569, selectedSport: 'ฟุตซอล (Futsal)', skillName: 'Ball Control', finalLevel: 4, timestamp: new Date('2026-03-15T09:00:00'), coachNotes: '' },
  ];
  const rounds = groupLogsIntoRounds(logs);
  assert(rounds.length === 2, 'จัดกลุ่มได้ 2 รอบ (ปี 2568 และ 2569)');
  const r2568 = rounds.find((r) => r.year === 2568);
  assert(r2568.levels['Ball Control'] === 3 && r2568.levels['Passing'] === 4, 'รอบ 2568 มีค่าทักษะถูกต้อง');
  assert(r2568.note === 'ดีขึ้น', 'note ของรอบถูกเก็บไว้');
}

console.log('\n=== TEST: validateScoreEntry ===');
{
  let threw = false;
  try {
    validateScoreEntry({ academicYear: 2569, studentId: 'X', studentName: 'X', selectedSport: 'S', skillName: 'K', finalLevel: 9 });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'ปฏิเสธ Final_Level นอกช่วง 1-6');

  let threw2 = false;
  try {
    validateScoreEntry({ academicYear: 2569, studentId: 'X', studentName: 'X', selectedSport: 'S', skillName: 'K', finalLevel: 4 });
  } catch (e) {
    threw2 = true;
  }
  assert(!threw2, 'Final_Level = 4 ผ่านการตรวจสอบ');
}

console.log('\n=== TEST: avgOf ===');
{
  const avg = avgOf({ A: 4, B: 2, C: 6 }, ['A', 'B', 'C', 'D']);
  assert(avg === 4, 'avgOf เฉลี่ยเฉพาะทักษะที่มีค่าจริง (D ไม่มีค่า ไม่นับ) = (4+2+6)/3 = 4');
}

console.log('\n✅ ALL skillLogic TESTS PASSED');
