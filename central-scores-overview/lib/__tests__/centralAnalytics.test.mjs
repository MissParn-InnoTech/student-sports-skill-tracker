import assert from 'node:assert/strict';
import { computeCentralOverview, normalizeClassName, levelIndex } from '../centralAnalytics.js';

assert.equal(normalizeClassName(' ป.2/ B '), 'ป.2/B');
assert.equal(levelIndex('pl'), 0);
assert.equal(levelIndex('L3'), 3);
assert.equal(levelIndex(''), null);
assert.equal(levelIndex('L9'), null);

const rows = [
  { studentId: '1', firstName: 'ก', className: 'ป.1/1', sportCode: 'FS', levelOld: 'L1', levelNew: 'L2', totalScore: '80' },
  { studentId: '2', firstName: 'ข', className: 'ป.1/1', sportCode: 'FS', levelOld: 'L1', levelNew: '', totalScore: '' },
  { studentId: '3', firstName: 'ค', className: 'ป.2/ B', sportCode: 'tn', levelOld: 'PL', levelNew: 'PL', totalScore: 50 },
  { studentId: '4', firstName: 'ง', className: 'ป.2/B', sportCode: 'ZZ', levelOld: 'L2', levelNew: 'L1', totalScore: 'abc' },
  { studentId: '', firstName: 'จ', className: 'ม.1/1', sportCode: 'G', levelOld: 'L7', levelNew: '', totalScore: '10' },
  { studentId: '1', firstName: 'ก', className: 'ป.1/1', sportCode: 'FS', levelOld: 'L1', levelNew: '', totalScore: '' },
  { studentId: '', className: '', sportCode: '', levelOld: '', levelNew: '', totalScore: '' },
];
const o = computeCentralOverview(rows);
assert.equal(o.totals.records, 6);
assert.equal(o.totals.blankRowsSkipped, 1);
assert.equal(o.totals.uniqueStudents, 4);
assert.equal(o.totals.assessed, 3);
assert.equal(o.totals.pending, 3);
assert.equal(o.totals.assessedPct, 50);
assert.equal(o.totals.levelUp, 1);
assert.equal(o.totals.levelSame, 1);
assert.equal(o.totals.levelDown, 1);
assert.equal(o.totals.withScore, 3);
assert.equal(o.totals.avgScore, 46.67);
assert.equal(o.totals.sportCount, 4);
assert.equal(o.totals.classCount, 3);
const fs = o.bySport.find((s) => s.code === 'FS');
assert.equal(fs.records, 3);
assert.equal(fs.assessed, 1);
assert.equal(fs.sharePct, 50);
assert.deepEqual(o.byGrade.map((g) => g.grade), ['ป.1', 'ป.2', 'ม.1']);
assert.equal(o.byGrade[1].classes.length, 1);
assert.equal(o.byGrade[1].classes[0].records, 2);
assert.equal(o.bySport.reduce((a, s) => a + s.records, 0), o.totals.records);
assert.equal(o.byGrade.reduce((a, g) => a + g.records, 0), o.totals.records);
const q = Object.fromEntries(o.dataQuality.map((d) => [d.key, d.count]));
assert.deepEqual(q, { missingStudentId: 1, unknownSportCode: 1, invalidLevel: 1, invalidScore: 1, scoreWithoutLevel: 1, duplicates: 2, classNameCleaned: 1 });
assert.equal(o.levelDistribution[1].oldCount, 3);
assert.equal(o.levelNewFilled, 3);
const empty = computeCentralOverview([]);
assert.equal(empty.totals.records, 0);
assert.equal(empty.totals.assessedPct, 0);
console.log('centralAnalytics: ผ่านทุกข้อ');
