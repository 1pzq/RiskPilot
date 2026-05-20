import { describe, expect, it } from 'vitest';

import { createDemoPortfolio, type DemoScenarioId } from '../lib/risk/fixtures';
import { calculateRiskReport } from '../lib/risk/risk-engine';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';

describe('strategy builder', () => {
  it('recommends prepare-only DeepBook Predict downside cover for the demo portfolio', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const report = calculateRiskReport(portfolio);

    const recommendation = buildStrategyRecommendation(
      report,
      portfolio,
      { maxBudgetUsd: 5 },
      { defaultBudgetUsd: 5 },
    );

    expect(recommendation.type).toBe('deepbook_predict_downside_binary');
    expect(recommendation.deepbookAction.mode).toBe('prepare_mainnet');
    expect(recommendation.deepbookAction.kind).toBe('predict_binary');
    expect(recommendation.deepbookAction.market).toBe('SUI downside -10% / 7D');
    expect(recommendation.deepbookAction.assetIn).toBe('USDC');
    expect(recommendation.deepbookAction.assetOut).toBe('SUI downside cover');
    expect(recommendation.parameters?.deepbookPredict?.thresholdPct).toBe(-10);
    expect(recommendation.parameters?.deepbookPredict?.expiryDays).toBe(7);
    expect(recommendation.estimatedCostUsd).toBeLessThanOrEqual(5);
    expect(recommendation.targetRiskSignalIds).toContain('sui-downside');
  });

  it('keeps the spot downside protection fallback when DeepBook Predict is disabled', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const report = calculateRiskReport(portfolio);

    const recommendation = buildStrategyRecommendation(
      report,
      portfolio,
      { maxBudgetUsd: 5 },
      { defaultBudgetUsd: 5, allowDeepBookPredict: false },
    );

    expect(recommendation.type).toBe('sui_downside_protection');
    expect(recommendation.deepbookAction.kind).toBe('spot');
    expect(recommendation.deepbookAction.mode).toBe('prepare_mainnet');
    expect(recommendation.deepbookAction.market).toBe('SUI/USDC');
  });

  it.each([
    ['leveraged_lending_user', 'lending_deleverage'],
    ['lp_impermanent_loss', 'lp_risk_reduction'],
    ['dao_stablecoin_treasury', 'stablecoin_split'],
  ] satisfies [DemoScenarioId, string][])('maps %s to %s', (scenarioId, expectedType) => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      scenarioId,
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const report = calculateRiskReport(portfolio);

    const recommendation = buildStrategyRecommendation(
      report,
      portfolio,
      { maxBudgetUsd: 5 },
      { defaultBudgetUsd: 5 },
    );

    expect(recommendation.type).toBe(expectedType);
    expect(recommendation.deepbookAction.mode).toBe('prepare_mainnet');
  });
});
