import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getCentralOverview } from '@/lib/centralScores';

export const dynamic = 'force-dynamic';

/** GET /api/overview — ภาพรวมระบบ คำนวณจากแท็บ Central_Scores (Master_Sports_System) เท่านั้น */
export const GET = withErrorHandling(async () => {
  const data = await getCentralOverview();
  return NextResponse.json(data);
});
