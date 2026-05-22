import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '../lib/risk/fixtures';
import type { PortfolioSnapshot, WalletScanSummary } from '../lib/risk/types';
import { calculateRiskReport, estimatePostStrategyRisk } from '../lib/risk/risk-engine';
import { buildMonitorRules } from '../lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '../lib/strategy/policy';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';
import { createAuditPackage, createDeepBookMarketEvidence } from '../lib/walrus/audit-package';

function buildDemoContext() {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));

  return {
    portfolio,
    riskReport,
    recommendation,
    policy,
    policyCheck,
  };
}

describe('monitor rules', () => {
  it('generates at least two default rules for the demo scenario', () => {
    const context = buildDemoContext();
    const rules = buildMonitorRules({
      ...context,
      deepbookMarketStatus: 'ready',
      now: new Date('2026-05-20T00:00:00.000Z'),
    });

    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'SUI drawdown reaches strategy threshold',
          sourceRiskSignalId: 'sui-downside',
          enabled: true,
        }),
        expect.objectContaining({
          label: 'Policy expires soon',
          recommendedAction: expect.objectContaining({
            kind: 'review',
          }),
        }),
      ]),
    );
  });

  it('keeps connected-wallet wallet_review rules review/watch/audit only', () => {
    const walletScan: WalletScanSummary = {
      owner: '0xREAL',
      scannedAt: '2026-05-21T00:00:00.000Z',
      totalObjects: 1,
      coinObjects: 1,
      deepbookObjects: 0,
      walrusBlobs: 0,
      receiptObjects: 0,
      defiCandidates: 1,
      packageCaps: 0,
      protocolHints: [
        {
          protocol: 'Unknown DeFi',
          count: 1,
          roles: ['Position object'],
        },
      ],
      sampleObjects: [],
    };
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
      walletScan,
    };
    const riskReport = calculateRiskReport(portfolio);
    const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
    const policy = createDefaultPolicy(recommendation, new Date('2026-05-21T00:00:00.000Z'));
    const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-21T00:00:00.000Z'));
    const rules = buildMonitorRules({
      portfolio,
      riskReport,
      recommendation,
      policy,
      policyCheck,
      walletScan,
      deepbookMarketStatus: 'ready',
      now: new Date('2026-05-21T00:00:00.000Z'),
    });

    expect(recommendation.type).toBe('wallet_review');
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(rules.map((rule) => rule.recommendedAction.kind)).not.toContain('prepare');
    expect(rules.every((rule) => ['review', 'watch', 'audit'].includes(rule.recommendedAction.kind))).toBe(true);
    expect(rules.map((rule) => `${rule.label} ${rule.recommendedAction.description}`).join(' ')).not.toMatch(/execute|auto-trade/i);
  });

  it('preserves disabled monitor rule state in the audit payload', () => {
    const context = buildDemoContext();
    const rules = buildMonitorRules({
      ...context,
      deepbookMarketStatus: 'ready',
      now: new Date('2026-05-20T00:00:00.000Z'),
    });
    const monitorRules = rules.map((rule, index) => ({
      ...rule,
      enabled: index === 0 ? false : rule.enabled,
    }));
    const auditPackage = createAuditPackage({
      walletAddress: context.portfolio.walletAddress,
      portfolioSnapshot: context.portfolio,
      riskReportBefore: context.riskReport,
      recommendation: context.recommendation,
      monitorRules,
      deepbookMarketEvidence: createDeepBookMarketEvidence({
        snapshot: null,
        walletAddress: context.portfolio.walletAddress,
        poolKey: 'SUI_USDC',
        routeStatus: 'ready',
      }),
      policy: context.policy,
      policyCheck: context.policyCheck,
      aiExplanation: 'Mock explanation.',
      execution: {
        mode: 'prepare_mainnet',
        status: 'prepared',
        digest: 'prep_test',
      },
      riskReportAfter: estimatePostStrategyRisk(context.riskReport, context.recommendation.expectedRiskReduction),
    });

    expect(auditPackage.monitorRules[0]).toEqual(
      expect.objectContaining({
        id: monitorRules[0]?.id,
        enabled: false,
      }),
    );
    expect(auditPackage.monitorRules).toEqual(monitorRules);
  });
});
