import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '../lib/risk/fixtures';
import { calculateRiskReport } from '../lib/risk/risk-engine';
import { createDefaultPolicy, validateExecutionPolicy } from '../lib/strategy/policy';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';

describe('policy gate', () => {
  it('accepts the default policy for the recommended strategy', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const report = calculateRiskReport(portfolio);
    const recommendation = buildStrategyRecommendation(report, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
    const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));

    const result = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects expired and under-budget policies', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const report = calculateRiskReport(portfolio);
    const recommendation = buildStrategyRecommendation(report, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });

    const result = validateExecutionPolicy(
      {
        maxBudgetUsd: 1,
        maxSingleTradeUsd: 1,
        allowedAssets: ['USDC'],
        allowedMarkets: ['OTHER'],
        expiresAt: '2024-01-01T00:00:00.000Z',
        requireManualApproval: true,
      },
      recommendation,
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('expired'),
        expect.stringContaining('exceeds max budget'),
        expect.stringContaining('exceeds max single trade'),
        expect.stringContaining('Asset out'),
        expect.stringContaining('Market'),
      ]),
    );
  });
});
