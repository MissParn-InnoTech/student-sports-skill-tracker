import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/apiHelpers';
import { getInitialData } from '@/lib/dataAccess';

export const GET = withErrorHandling(async () => {
  const data = await getInitialData();
  return NextResponse.json(data);
});
