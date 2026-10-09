// node lib/__tests__/executiveAnalytics.test.mjs
import assert from 'node:assert/strict';
import { computeExecutiveReport } from '../executiveAnalytics.js';
import { computeCentralOverview } from '../centralAnalytics.js';

const register = [
  { rowNo: 2, studentId: '1', prefix: 'เด็กชาย', className: 'ป.1/1', sportCode: 'FS', levelOld: 'L1' },
  { rowNo: 3, studentId: '2', prefix: 'เด็กหญิง', className: 'ป.1/A', sportCode: 'SW', levelOld: 'PL' },
  { rowNo: 4, studentId: '3', prefix: 'นาย', className: 'ม.1/ B', sportCode: 'bk', levelOld: 'PL' },
  { rowNo: 5, studentId: '3', prefix: 'นางสาว', className: 'ม.1/2', sportCode: 'FS', levelOld: 'L4' },
  { rowNo: 6, studentId: '', prefix: '', className: '', sportCode: '', levelOld: '' },
];
const central = computeCentralOverview([
  { studentId: '1', className: 'ป.1/1', sportCode: 'FS', levelOld: 'L1', levelNew: 'L2', totalScore: '80' },
  { studentId: '3', className: 'ม.1/2', sportCode: 'FS', levelOld: 'L4', levelNew: '', totalScore: '' },
]);
const course = [
  { studentId: '1', className: 'ป.1/1', sportCode: 'SW', courseType: 'October', status: 'ส่งแล้ว 09/10/26' },
  { studentId: '2', className: 'ป.1/A', sportCode: '', courseType: '', status: 'รอกรอก' },
];

const r = computeExecutiveReport({ registerRows: register, courseRows: course, central });
assert.equal(r.totals.students, 4);
assert.equal(r.totals.classCount, 4);
assert.equal(r.totals.primary, 2);
assert.equal(r.totals.secondary, 2);
assert.equal(r.totals.numberedRooms, 2);
assert.equal(r.totals.letteredRooms, 2);
assert.equal(r.totals.male, 2);
assert.equal(r.totals.female, 2);
assert.equal(r.bySport[0].code, 'FS');
assert.equal(r.bySport[0].count, 2);
assert.equal(r.bySport[0].assessed, 1);
assert.deepEqual(r.levelDistribution.map((l) => l.count), [2, 1, 0, 0, 1, 0, 0]);
assert.equal(r.byGrade.map((g) => g.grade).join(','), 'ป.1,ม.1');
assert.equal(r.assessment.centralRecords, 2);
assert.equal(r.assessment.assessed, 1);
assert.deepEqual(r.assessment.sportsNotInCentral.map((s) => s.code).sort(), ['BK', 'SW']);
assert.equal(r.course.rows, 2);
assert.equal(r.course.enrolled, 1);
assert.equal(r.course.byType[0].type, 'OCTOBER');
assert.equal(r.course.sent, 1);
const keys = r.dataQuality.map((q) => q.key);
assert.ok(keys.includes('dupId') && keys.includes('unknownCode') && keys.includes('spacedClass'));
const sum = r.byGrade.reduce((a, g) => a + g.bySport.reduce((x, y) => x + y, 0), 0);
assert.equal(sum, 4);

const empty = computeExecutiveReport({});
assert.equal(empty.totals.students, 0);
assert.equal(empty.insights.length, 0);
console.log('executiveAnalytics: ผ่านทุกข้อ');
