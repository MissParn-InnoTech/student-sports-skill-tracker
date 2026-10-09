import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getCentralOverview } from '@/lib/centralScores';
import { getMasterTab } from '@/lib/masterTabs';
import { computeExecutiveReport } from '@/lib/executiveAnalytics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/overview — ข้อมูลหน้า "รายงานผู้บริหาร" (/admin)
 * คำนวณจากสำเนา 3 แท็บของ Master_Sports_System: Student_Register, Central_Scores, Course_Register
 * ฟิลด์เดิมของ Central_Scores (totals, bySport, byGrade ฯลฯ) ยังอยู่ครบ และเพิ่ม executive + sources
 */
export const GET = withErrorHandling(async () => {
  const [central, register, course] = await Promise.all([
    getCentralOverview(),
    getMasterTab('Student_Register'),
    getMasterTab('Course_Register'),
  ]);
  const executive = computeExecutiveReport({
    registerRows: register.rows,
    courseRows: course.rows,
    central: central.synced ? central : null,
  });
  return NextResponse.json({
    ...central,
    executive,
    sources: {
      Student_Register: { synced: register.synced, lastSyncedTs: register.lastSyncedTs, rows: register.rows.length },
      Central_Scores: { synced: central.synced, lastSyncedTs: central.lastSyncedTs, rows: central.totals?.records ?? 0 },
      Course_Register: { synced: course.synced, lastSyncedTs: course.lastSyncedTs, rows: course.rows.length },
    },
  });
});
