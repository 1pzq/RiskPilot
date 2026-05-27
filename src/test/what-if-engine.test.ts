import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '@/lib/risk/fixtures';
import { buildWhatIfSimulation } from '@/lib/risk/what-if-engine';

describe('what-if risk engine', () => {
  it('builds a preview-only SUI drawdown simulation without mutating the base portfolio', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const baseSui = portfolio.assets.find((asset) => asset.symbol === 'SUI');

    const simulation = buildWhatIfSimulation(portfolio, 'sui_drawdown_15');
    const simulatedSui = simulation.simulatedPortfolio.assets.find((asset) => asset.symbol === 'SUI');

    expect(simulation.previewOnly).toBe(true);
    expect(simulatedSui?.usdValue).toBeLessThan(baseSui?.usdValue ?? 0);
    expect(portfolio.assets.find((asset) => asset.symbol === 'SUI')?.usdValue).toBe(baseSui?.usdValue);
    expect(simulation.delta.totalValueDeltaUsd).toBeLessThan(0);
    expect(simulation.simulatedRiskReport.overallScore).toBeGreaterThanOrEqual(0);
    expect(simulation.simulatedRiskReport.overallScore).toBeLessThanOrEqual(100);
  });

  it('makes the sharper SUI drawdown produce a larger portfolio value loss than the moderate drawdown', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const moderate = buildWhatIfSimulation(portfolio, 'sui_drawdown_8');
    const severe = buildWhatIfSimulation(portfolio, 'sui_drawdown_15');

    expect(Math.abs(severe.delta.totalValueDeltaUsd)).toBeGreaterThan(Math.abs(moderate.delta.totalValueDeltaUsd));
  });

  it('marks policy budget cut as a policy preview without changing wallet assets', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const simulation = buildWhatIfSimulation(portfolio, 'policy_budget_cut');

    expect(simulation.policyOverride).toMatchObject({
      maxBudgetMultiplier: 0.5,
      maxSingleTradeMultiplier: 0.5,
    });
    expect(simulation.delta.policyNote).toContain('Policy caps');
    expect(simulation.simulatedPortfolio.assets).toEqual(simulation.basePortfolio.assets);
  });

  it('adds an unknown asset as unpriced preview data without producing NaN values', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const simulation = buildWhatIfSimulation(portfolio, 'unknown_asset_inflow');
    const unknown = simulation.simulatedPortfolio.assets.find((asset) => asset.symbol === 'UNKNOWN');

    expect(unknown).toMatchObject({
      usdPrice: 0,
      usdValue: 0,
    });
    expect(Number.isFinite(simulation.simulatedPortfolio.totalUsdValue)).toBe(true);
    expect(Number.isFinite(simulation.simulatedRiskReport.overallScore)).toBe(true);
  });

  it('can force DeepBook market evidence into unavailable preview mode', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const simulation = buildWhatIfSimulation(portfolio, 'deepbook_unavailable');

    expect(simulation.marketOverride).toMatchObject({
      deepbookStatus: 'unavailable',
      routeStatus: 'error',
    });
    expect(simulation.delta.marketNote).toContain('DeepBook');
  });
});
