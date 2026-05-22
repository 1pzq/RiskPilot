import { describe, expect, it } from 'vitest';

import { createDemoPortfolio, type DemoScenarioId } from '../lib/risk/fixtures';
import { calculateRiskReport } from '../lib/risk/risk-engine';
import type { PortfolioSnapshot } from '../lib/risk/types';
import {
  buildStrategyRecommendation,
  type StrategyRecommendation,
  type StrategyType,
} from '../lib/strategy/strategy-builder';

function expectRichStrategyInfo(recommendation: StrategyRecommendation) {
  expect(recommendation.rationale.length).toBeGreaterThan(30);
  expect(recommendation.applicability.length).toBeGreaterThan(30);
  expect(recommendation.prepareOnlyReason).toMatch(/prepare_mainnet|audit-only|no transaction/i);
  expect(recommendation.fallback.length).toBeGreaterThan(30);
  expect(recommendation.constraints).toEqual(
    expect.arrayContaining(['Sui mainnet only.', 'Default execution mode remains prepare_mainnet.']),
  );
  expect(recommendation.riskTradeoffs.length).toBeGreaterThan(0);
  expect(recommendation.displayFacts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: 'Risk signals' }),
      expect.objectContaining({ label: 'Execution default', value: 'prepare_mainnet' }),
    ]),
  );
}

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
    expectRichStrategyInfo(recommendation);
    expect(recommendation.rationale).toMatch(/SUI downside/i);
    expect(recommendation.fallback).toMatch(/local simulation/i);
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
    expectRichStrategyInfo(recommendation);
    expect(recommendation.fallback).toMatch(/no-trade audit/i);
  });

  it.each([
    ['conservative_sui_holder', 'deepbook_predict_downside_binary'],
    ['leveraged_lending_user', 'lending_deleverage'],
    ['lp_impermanent_loss', 'lp_risk_reduction'],
    ['dao_stablecoin_treasury', 'stablecoin_split'],
  ] satisfies [DemoScenarioId, StrategyType][])('maps %s to %s', (scenarioId, expectedType) => {
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
    expectRichStrategyInfo(recommendation);

    if (scenarioId === 'dao_stablecoin_treasury') {
      expect(`${recommendation.rationale} ${recommendation.applicability}`).toMatch(/stablecoin|depeg|DAO/i);
    }
  });

  it('does not invent a trade for a connected wallet with no priced actionable risk or only unpriced coins', () => {
    const portfolio: PortfolioSnapshot = {
      walletAddress: '0xREAL',
      timestamp: '2026-05-21T00:00:00.000Z',
      assets: [
        {
          symbol: 'UNKNOWN',
          coinType: '0xabc::unknown::UNKNOWN',
          amount: 42,
          usdPrice: 0,
          usdValue: 0,
        },
      ],
      lendingPositions: [],
      liquidityPositions: [],
      totalUsdValue: 0,
    };
    const report = calculateRiskReport(portfolio);

    const recommendation = buildStrategyRecommendation(
      report,
      portfolio,
      { maxBudgetUsd: 5 },
      { defaultBudgetUsd: 5 },
    );

    expect(recommendation.type).toBe('wallet_review');
    expect(recommendation.estimatedCostUsd).toBe(0);
    expect(recommendation.deepbookAction.market).toBe('No trade');
    expect(recommendation.deepbookAction.amountUsd).toBe(0);
    expect(recommendation.deepbookAction.assetIn).toBe('N/A');
    expect(recommendation.deepbookAction.assetOut).toBe('N/A');
    expectRichStrategyInfo(recommendation);
    expect(recommendation.displayFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Prepared market', value: 'No trade' }),
        expect.objectContaining({ label: 'Prepared size', value: '$0.00' }),
      ]),
    );
  });
});
