import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '../lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '../lib/risk/risk-engine';

describe('risk engine', () => {
  it('produces a bounded deterministic report for the demo portfolio', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const report = calculateRiskReport(portfolio);

    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.signals.length).toBeGreaterThanOrEqual(3);
    expect(report.signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(['concentration-top-asset', 'sui-downside', 'stablecoin-concentration']),
    );
    expect(report.scenarioResults.map((scenario) => scenario.scenario)).toEqual(
      expect.arrayContaining(['SUI -10%', 'SUI -20%', 'Stablecoin 脱锚 -5%']),
    );
  });

  it('reduces the estimated risk after a strategy', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const report = calculateRiskReport(portfolio);
    const after = estimatePostStrategyRisk(report, 35);

    expect(after.overallScore).toBeLessThanOrEqual(report.overallScore);
    expect(after.estimated).toBe(true);
  });
});
