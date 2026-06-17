import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import { validateExecutionPolicy } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { verifyExecutionIntent, type ExecutionIntent } from '@/lib/security/execution-intent';
import {
  executeDeepBookTransaction,
  executionModeFromEnvironment,
} from '@/lib/sui/deepbook';
import { hasWhatIfPreviewMarker } from '@/lib/walrus/preview-guard';

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
      mode: z.enum(['prepare_mainnet', 'mainnet']),
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

const ExecutionIntentSchema = z.object({
  executionIntentId: z.string(),
  portfolioDigest: z.string(),
  riskReportDigest: z.string(),
  recommendationDigest: z.string(),
  policyDigest: z.string(),
  policyObjectId: z.string().optional(),
  intentCreatedAt: z.string(),
  intentExpiresAt: z.string(),
  intentSource: z.enum(['base_wallet', 'local_sample']),
});

const BodySchema = z.object({
  recommendation: RecommendationSchema,
  policy: PolicySchema,
  policyCheck: z.object({
    ok: z.boolean(),
    errors: z.array(z.string()),
  }),
  executionIntent: ExecutionIntentSchema.optional(),
  portfolioSnapshot: z.any().optional(),
  riskReport: z.any().optional(),
  walletAddress: z.string(),
  executionMode: z.enum(['prepare_mainnet', 'mainnet']).optional(),
})
  .passthrough();

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();

    if (hasWhatIfPreviewMarker(rawBody)) {
      return NextResponse.json(
        {
          error: 'What-if preview payloads cannot be submitted for execution.',
        },
        { status: 400 },
      );
    }

    const body = BodySchema.parse(rawBody) as {
      recommendation: StrategyRecommendation;
      policy: ExecutionPolicy;
      policyCheck: PolicyCheckResult;
      executionIntent?: ExecutionIntent;
      portfolioSnapshot?: unknown;
      riskReport?: unknown;
      walletAddress: string;
      executionMode?: 'prepare_mainnet' | 'mainnet';
    };

    const serverPolicyCheck = validateExecutionPolicy(body.policy, body.recommendation, new Date());

    if (!serverPolicyCheck.ok || !body.policyCheck.ok) {
      return NextResponse.json(
        {
          error: [...serverPolicyCheck.errors, ...body.policyCheck.errors].join(' '),
        },
        { status: 400 },
      );
    }

    const intentCheck = await verifyExecutionIntent({
      intent: body.executionIntent,
      portfolioSnapshot: body.portfolioSnapshot as never,
      riskReport: body.riskReport as never,
      recommendation: body.recommendation,
      policy: body.policy,
    });

    if (!intentCheck.ok) {
      return NextResponse.json(
        {
          error: intentCheck.errors.join(' '),
        },
        { status: 400 },
      );
    }

    const executionMode = (process.env.NEXT_PUBLIC_MAINNET_EXECUTION_MODE ?? 'prepare').toLowerCase();
    const requestedMode = body.executionMode ?? executionModeFromEnvironment(executionMode);
    const result = await executeDeepBookTransaction(body.recommendation.deepbookAction, body.walletAddress, {
      requestedMode,
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
