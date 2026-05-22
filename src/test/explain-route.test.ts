import { describe, expect, it } from 'vitest';

import { POST } from '../app/api/explain/route';
import { createDemoPortfolio } from '../lib/risk/fixtures';
import { calculateRiskReport } from '../lib/risk/risk-engine';
import { createDefaultPolicy } from '../lib/strategy/policy';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';

function buildExplainPayload() {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));

  return {
    portfolioSnapshot: portfolio,
    riskReport,
    recommendation,
    policy,
  };
}

describe('explain route', () => {
  it('falls back to a mock explanation when OpenAI is not configured', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const response = await POST(
      new Request('http://localhost/api/explain', {
        method: 'POST',
        body: JSON.stringify(buildExplainPayload()),
      }),
    );
    const payload = (await response.json()) as { mode: string; explanation: string };

    process.env.OPENAI_API_KEY = originalApiKey;

    expect(response.status).toBe(200);
    expect(payload.mode).toBe('mock');
    expect(payload.explanation).toContain('prepare-only mainnet');
  });
});
