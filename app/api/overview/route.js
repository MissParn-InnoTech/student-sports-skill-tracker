import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getSystemOverview } from '@/lib/dataAccess';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const data = await getSystemOverview();
  return NextResponse.json(data);
});
