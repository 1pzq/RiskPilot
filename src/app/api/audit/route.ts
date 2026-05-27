import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { AuditPackage } from '@/lib/walrus/types';
import { storeAuditPackage } from '@/lib/walrus/walrus-client';

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
    agentCouncil: z.any().optional(),
    incidentRoom: z.any().optional(),
    aiExplanation: z.string(),
    execution: z.any(),
    riskReportAfter: z.any().optional(),
  })
  .passthrough();

function hasWhatIfPreviewMarker(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (record.previewOnly === true || record.source === 'what_if_preview') {
    return true;
  }

  return Object.values(record).some((entry) => hasWhatIfPreviewMarker(entry));
}

export async function POST(request: Request) {
  try {
    const auditPackage = BodySchema.parse(await request.json()) as AuditPackage;

    if (hasWhatIfPreviewMarker(auditPackage)) {
      return NextResponse.json(
        {
          error: 'What-if preview payloads cannot replace the archived audit package.',
        },
        { status: 400 },
      );
    }

    const storage = await storeAuditPackage(auditPackage);

    return NextResponse.json({
      auditPackage,
      storage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not archive audit package.',
      },
      { status: 400 },
    );
  }
}
