import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildAiIncidentRoomDecision } from '@/lib/agents/ai-incident-room';
import type { BuildIncidentRoomInput } from '@/lib/agents/incident-room';

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
  explanationMode: z.enum(['mock', 'deepseek', 'openai']),
  walletConnected: z.boolean(),
  auditArchived: z.boolean(),
  receiptEnabled: z.boolean(),
  liveGate: z.any().optional(),
  agentCouncil: z.any().optional(),
  policyObject: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json()) as BuildIncidentRoomInput;
    const incidentRoom = await buildAiIncidentRoomDecision(body);

    return NextResponse.json({
      incidentRoom,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not build incident room.',
      },
      { status: 400 },
    );
  }
}
