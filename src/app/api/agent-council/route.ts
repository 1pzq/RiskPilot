import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildAiAgentCouncilDecision, type BuildAiAgentCouncilInput } from '@/lib/agents/ai-council';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  riskReport: z.any(),
  recommendation: z.any(),
  policy: z.any(),
  policyCheck: z.object({
    ok: z.boolean(),
    errors: z.array(z.string()),
  }),
  monitorRules: z.array(z.any()),
  deepbookMarketEvidence: z.any(),
  explanationMode: z.enum(['mock', 'openai']),
  walletConnected: z.boolean(),
  auditArchived: z.boolean(),
  receiptEnabled: z.boolean(),
  liveGate: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json()) as BuildAiAgentCouncilInput;
    const decision = await buildAiAgentCouncilDecision(body);

    return NextResponse.json({
      decision,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not build agent council.',
      },
      { status: 400 },
    );
  }
}
