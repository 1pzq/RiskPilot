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
    policy: z.any(),
    policyCheck: z.any(),
    aiExplanation: z.string(),
    execution: z.any(),
    riskReportAfter: z.any().optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  try {
    const auditPackage = BodySchema.parse(await request.json()) as AuditPackage;
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

