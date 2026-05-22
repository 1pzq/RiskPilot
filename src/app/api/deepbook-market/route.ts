import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fetchDeepBookLiveMarketSnapshot, LIVE_DEEPBOOK_POOL_KEY } from '@/lib/sui/deepbook-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  poolKey: z.string().optional(),
  walletAddress: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = QuerySchema.parse({
      poolKey: url.searchParams.get('poolKey') ?? undefined,
      walletAddress: url.searchParams.get('walletAddress') ?? undefined,
    });

    const snapshot = await fetchDeepBookLiveMarketSnapshot(
      query.walletAddress?.trim() || '0x2',
      query.poolKey?.trim() || LIVE_DEEPBOOK_POOL_KEY,
    );

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not load DeepBook market data.',
      },
      { status: 400 },
    );
  }
}
