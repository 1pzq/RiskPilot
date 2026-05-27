import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '@/lib/risk/fixtures';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';

function buildExecutePayload() {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));

  return {
    recommendation,
    policy,
    policyCheck,
    walletAddress: '0xDEMO',
    executionMode: 'prepare_mainnet',
  };
}

describe('execute route', () => {
  it('rejects what-if preview payloads before execution', async () => {
    const { POST } = await import('@/app/api/execute/route');

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify({
          ...buildExecutePayload(),
          previewOnly: true,
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('What-if preview');
  });
});
