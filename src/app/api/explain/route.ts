import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { buildMockExplanation } from '@/lib/ai/explain';
import { getAiProviderConfig, missingAiProviderMessage } from '@/lib/ai/provider';

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
    '用中文解释 Portfolio 风险和推荐，保持 demo 友好、清晰简短。',
    '只输出四行，标签必须是：风险、策略、Policy、安全。',
    '不要承诺收益或保护。',
    '说明 Policy 限制，并说明除非用户明确批准单独的钱包动作，否则执行仅为 Prepare。',
    '说明这不是投资建议。',
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

async function createAiExplanation(input: {
  portfolioSnapshot: PortfolioSnapshot;
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
}) {
  const config = getAiProviderConfig();

  if (!config.apiKey) {
    throw new Error(missingAiProviderMessage(config));
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const payload = buildExplanationPayload(input);
  const instructions = buildExplanationInstructions();

  if (config.apiMode === 'chat') {
    const completion = await client.chat.completions.create({
      model: config.model,
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

  const response = await client.responses.create({
    model: config.model,
    instructions,
    input: payload,
    max_output_tokens: 420,
    store: false,
    reasoning: config.reasoningEffort ? { effort: config.reasoningEffort } : undefined,
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

    const config = getAiProviderConfig();

    if (!config.apiKey) {
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
      (await createAiExplanation(body)) ||
        buildMockExplanation(
          body.portfolioSnapshot,
          body.riskReport,
          body.recommendation,
          body.policy,
        ),
      180,
    );

    return NextResponse.json({
      mode: config.provider,
      model: config.model,
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
        warning: error instanceof Error ? `AI provider 已使用兜底：${error.message}` : 'AI provider 已使用兜底。',
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '无法生成解释。',
      },
      { status: 400 },
    );
  }
}
