import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import { validateExecutionPolicy } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import {
  executeDeepBookTransaction,
  executionModeFromEnvironment,
} from '@/lib/sui/deepbook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RecommendationSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    summary: z.string(),
    targetRiskSignalIds: z.array(z.string()),
    estimatedCostUsd: z.number(),
    expectedRiskReduction: z.number(),
    deepbookAction: z.object({
      mode: z.enum(['simulate', 'prepare_mainnet', 'mainnet']),
      kind: z.enum(['spot', 'predict_binary']).default('spot'),
      market: z.string(),
      side: z.enum(['buy', 'sell']),
      assetIn: z.string(),
      assetOut: z.string(),
      amountUsd: z.number(),
      description: z.string(),
    }),
  })
  .passthrough();

const PolicySchema = z
  .object({
    maxBudgetUsd: z.number(),
    maxSingleTradeUsd: z.number(),
    allowedAssets: z.array(z.string()),
    allowedMarkets: z.array(z.string()),
    expiresAt: z.string(),
    requireManualApproval: z.boolean(),
  })
  .passthrough();

const BodySchema = z.object({
  recommendation: RecommendationSchema,
  policy: PolicySchema,
  policyCheck: z.object({
    ok: z.boolean(),
    errors: z.array(z.string()),
  }),
  walletAddress: z.string(),
  executionMode: z.enum(['simulation', 'prepare_mainnet', 'mainnet']).optional(),
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
    const body = BodySchema.parse(await request.json()) as {
      recommendation: StrategyRecommendation;
      policy: ExecutionPolicy;
      policyCheck: PolicyCheckResult;
      walletAddress: string;
      executionMode?: 'simulation' | 'prepare_mainnet' | 'mainnet';
    };

    if (hasWhatIfPreviewMarker(body)) {
      return NextResponse.json(
        {
          error: 'What-if preview payloads cannot be submitted for execution.',
        },
        { status: 400 },
      );
    }

    const serverPolicyCheck = validateExecutionPolicy(body.policy, body.recommendation, new Date());

    if (!serverPolicyCheck.ok || !body.policyCheck.ok) {
      return NextResponse.json(
        {
          error: [...serverPolicyCheck.errors, ...body.policyCheck.errors].join(' '),
        },
        { status: 400 },
      );
    }

    const executionMode = (process.env.NEXT_PUBLIC_MAINNET_EXECUTION_MODE ?? 'prepare').toLowerCase();
    const enableRealDeepBook = (process.env.NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL ?? 'true').toLowerCase() !== 'false';
    const requestedMode = body.executionMode ?? executionModeFromEnvironment(executionMode);
    const result = await executeDeepBookTransaction(body.recommendation.deepbookAction, body.walletAddress, {
      requestedMode,
      enableRealDeepBook,
      allowLocalFallback: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not prepare execution.',
      },
      { status: 400 },
    );
  }
}
