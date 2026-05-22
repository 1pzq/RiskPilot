import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { buildMockExplanation } from '@/lib/ai/explain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  portfolioSnapshot: z.any(),
  riskReport: z.any(),
  recommendation: z.any(),
  policy: z.any(),
});

function limitWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(' ')}.`;
}

function buildExplanationInstructions() {
  return [
    'You are RiskPilot, a verifiable AI risk manager for Sui DeFi.',
    'Explain the portfolio risk and recommendation in clear demo-friendly language.',
    'Use exactly four short labeled lines: Risk, Strategy, Policy, Safety.',
    'Do not promise profit or protection.',
    'Mention the policy limits and that execution is prepare-only unless the user explicitly approves a separate wallet action.',
    'Mention that this is not financial advice.',
    'Keep the whole response under 160 words.',
  ].join(' ');
}

function buildExplanationPayload(input: {
  portfolioSnapshot: PortfolioSnapshot;
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
}) {
  return JSON.stringify({
    trackedValueUsd: input.portfolioSnapshot.totalUsdValue,
    walletAddress: input.portfolioSnapshot.walletAddress,
    assets: input.portfolioSnapshot.assets.map((asset) => ({
      symbol: asset.symbol,
      amount: asset.amount,
      usdValue: asset.usdValue,
      priced: asset.usdPrice > 0,
    })),
    score: input.riskReport.overallScore,
    level: input.riskReport.overallLevel,
    topSignals: input.riskReport.signals.slice(0, 4).map((signal) => ({
      title: signal.title,
      level: signal.level,
      summary: signal.summary,
      evidence: signal.evidence,
    })),
    recommendation: {
      title: input.recommendation.title,
      summary: input.recommendation.summary,
      estimatedCostUsd: input.recommendation.estimatedCostUsd,
      expectedRiskReduction: input.recommendation.expectedRiskReduction,
      market: input.recommendation.deepbookAction.market,
      mode: input.recommendation.deepbookAction.mode,
    },
    policy: {
      maxBudgetUsd: input.policy.maxBudgetUsd,
      maxSingleTradeUsd: input.policy.maxSingleTradeUsd,
      allowedAssets: input.policy.allowedAssets,
      allowedMarkets: input.policy.allowedMarkets,
      expiresAt: input.policy.expiresAt,
      requireManualApproval: input.policy.requireManualApproval,
    },
  });
}

function normalizeApiMode(value: string | undefined): 'responses' | 'chat' {
  return value?.toLowerCase() === 'chat' ? 'chat' : 'responses';
}

function normalizeReasoningEffort(value: string | undefined) {
  const normalized = value?.toLowerCase();
  return normalized === 'none' ||
    normalized === 'minimal' ||
    normalized === 'low' ||
    normalized === 'medium' ||
    normalized === 'high' ||
    normalized === 'xhigh'
    ? normalized
    : undefined;
}

async function createOpenAIExplanation(input: {
  portfolioSnapshot: PortfolioSnapshot;
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
}) {
  const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim();
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: openaiBaseUrl || undefined,
  });
  const model = process.env.OPENAI_MODEL ?? 'gpt-5.5';
  const payload = buildExplanationPayload(input);
  const instructions = buildExplanationInstructions();
  const apiMode = normalizeApiMode(process.env.OPENAI_API_MODE);

  if (apiMode === 'chat') {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: instructions,
        },
        {
          role: 'user',
          content: payload,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  const reasoningEffort = normalizeReasoningEffort(process.env.OPENAI_REASONING_EFFORT);
  const response = await client.responses.create({
    model,
    instructions,
    input: payload,
    max_output_tokens: 420,
    store: false,
    reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
  });

  return response.output_text?.trim() ?? '';
}

export async function POST(request: Request) {
  let parsedBody:
    | {
        portfolioSnapshot: PortfolioSnapshot;
        riskReport: RiskReport;
        recommendation: StrategyRecommendation;
        policy: ExecutionPolicy;
      }
    | null = null;

  try {
    const body = BodySchema.parse(await request.json()) as {
      portfolioSnapshot: PortfolioSnapshot;
      riskReport: RiskReport;
      recommendation: StrategyRecommendation;
      policy: ExecutionPolicy;
    };
    parsedBody = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        mode: 'mock',
        explanation: buildMockExplanation(
          body.portfolioSnapshot,
          body.riskReport,
          body.recommendation,
          body.policy,
        ),
      });
    }

    const explanation = limitWords(
      (await createOpenAIExplanation(body)) ||
        buildMockExplanation(
          body.portfolioSnapshot,
          body.riskReport,
          body.recommendation,
          body.policy,
        ),
      180,
    );

    return NextResponse.json({
      mode: 'openai',
      explanation,
    });
  } catch (error) {
    if (parsedBody) {
      return NextResponse.json({
        mode: 'mock',
        explanation: buildMockExplanation(
          parsedBody.portfolioSnapshot,
          parsedBody.riskReport,
          parsedBody.recommendation,
          parsedBody.policy,
        ),
        warning: error instanceof Error ? `OpenAI fallback used: ${error.message}` : 'OpenAI fallback used.',
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not build explanation.',
      },
      { status: 400 },
    );
  }
}
