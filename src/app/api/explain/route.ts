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

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json()) as {
      portfolioSnapshot: PortfolioSnapshot;
      riskReport: RiskReport;
      recommendation: StrategyRecommendation;
      policy: ExecutionPolicy;
    };

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

    const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim();
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: openaiBaseUrl || undefined,
    });
    const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are RiskPilot. Explain the portfolio risk and recommendation in simple language. Keep it under 180 words. Do not promise profit. Mention policy limits. Mention that this is not financial advice. Mention that execution is prepare-only unless the user explicitly approves something else.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            portfolioSnapshot: body.portfolioSnapshot,
            riskReport: body.riskReport,
            recommendation: body.recommendation,
            policy: body.policy,
          }),
        },
      ],
    });

    const explanation = limitWords(
      completion.choices[0]?.message?.content?.trim() ||
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not build explanation.',
      },
      { status: 400 },
    );
  }
}
