import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { AuditPackage } from '@/lib/walrus/types';
import { SERVER_WALRUS_ARCHIVE_DISABLED_MESSAGE } from '@/lib/walrus/walrus-client';
import { hasWhatIfPreviewMarker } from '@/lib/walrus/preview-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    walletAddress: z.string(),
    portfolioSnapshot: z.any(),
    riskReportBefore: z.any(),
    recommendation: z.any(),
    monitorRules: z.array(z.any()),
    deepbookMarketEvidence: z.any(),
    policy: z.any(),
    policyCheck: z.any(),
    policyObjectId: z.string().optional(),
    policyObject: z.any().optional(),
    executionIntent: z.any().optional(),
    agentCouncil: z.any().optional(),
    incidentRoom: z.any().optional(),
    aiExplanation: z.string(),
    execution: z.any(),
    riskReportAfter: z.any().optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();

    if (hasWhatIfPreviewMarker(rawBody)) {
      return NextResponse.json(
        {
          error: 'What-if preview payloads cannot replace the archived audit package.',
        },
        { status: 400 },
      );
    }

    BodySchema.parse(rawBody) as AuditPackage;

    return NextResponse.json(
      {
        error: SERVER_WALRUS_ARCHIVE_DISABLED_MESSAGE,
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not archive audit package.',
      },
      { status: 400 },
    );
  }
}
