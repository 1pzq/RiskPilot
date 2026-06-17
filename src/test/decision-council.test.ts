import { describe, expect, it } from 'vitest';

import { buildAgentCouncilDecision } from '@/lib/agents/decision-council';
import { createDemoPortfolio } from '@/lib/risk/fixtures';
import type { PortfolioSnapshot } from '@/lib/risk/types';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { buildMonitorRules } from '@/lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';

function buildCouncilInput() {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(
    riskReport,
    portfolio,
    { maxBudgetUsd: 5 },
    { defaultBudgetUsd: 5, now: new Date('2026-05-20T00:00:00.000Z') },
  );
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const monitorRules = buildMonitorRules({
    portfolio,
    riskReport,
    recommendation,
    policy,
    policyCheck,
    deepbookMarketStatus: 'ready',
    now: new Date('2026-05-20T00:00:00.000Z'),
  });
  const deepbookMarketEvidence = createDeepBookMarketEvidence({
    snapshot: {
      poolKey: 'SUI_USDC',
      poolAddress: '0xPOOL',
      baseCoin: 'SUI',
      quoteCoin: 'USDC',
      midPrice: 3.25,
      quoteOutForOneBase: 3.2,
      baseOutForOneQuote: 0.307692,
      vaultBalances: {
        base: 1045.12,
        quote: 3412.88,
        deep: 251.44,
      },
      tradeParams: {
        takerFee: 0.0025,
        makerFee: 0.0015,
        stakeRequired: 150,
      },
      registeredPool: true,
      whitelisted: true,
      fetchedAt: '2026-05-21T00:00:00.000Z',
    },
    walletAddress: '0xDEMO',
    routeStatus: 'ready',
  });

  return {
    riskReport,
    recommendation,
    policy,
    policyCheck,
    monitorRules,
    deepbookMarketEvidence,
    explanationMode: 'mock' as const,
    walletConnected: false,
    auditArchived: false,
    receiptEnabled: true,
  };
}

describe('agent council decision', () => {
  it('builds a prepare-ready council from risk, policy, market, and monitor evidence', () => {
    const decision = buildAgentCouncilDecision(buildCouncilInput());

    expect(decision.posture).toBe('prepare_ready');
    expect(decision.agents).toHaveLength(5);
    expect(decision.agents.map((agent) => agent.id)).toEqual([
      'risk_analyst',
      'strategy_agent',
      'policy_guard',
      'audit_agent',
      'manager',
    ]);
    expect(decision.evidenceTimeline.map((step) => step.id)).toEqual([
      'wallet-scan',
      'risk-signals',
      'strategy',
      'policy',
      'deepbook',
      'walrus',
      'receipt',
    ]);
    expect(decision.evidenceTimeline.find((step) => step.id === 'policy')).toMatchObject({
      status: 'complete',
      evidenceRef: 'policyCheck',
    });
  });

  it('blocks the manager posture when the policy gate fails', () => {
    const input = buildCouncilInput();
    const policyCheck = {
      ok: false,
      errors: ['Estimated cost exceeds max budget.'],
    };

    const decision = buildAgentCouncilDecision({
      ...input,
      policyCheck,
    });

    expect(decision.posture).toBe('policy_blocked');
    expect(decision.managerSummary).toContain('阻断执行');
    expect(decision.agents.find((agent) => agent.id === 'policy_guard')).toMatchObject({
      status: 'blocked',
    });
    expect(decision.evidenceTimeline.find((step) => step.id === 'policy')).toMatchObject({
      status: 'blocked',
    });
  });

  it('keeps wallet review decisions audit-only and does not imply live execution', () => {
    const portfolio: PortfolioSnapshot = {
      walletAddress: '0xREAL',
      timestamp: '2026-05-20T00:00:00.000Z',
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
    const riskReport = calculateRiskReport(portfolio);
    const recommendation = buildStrategyRecommendation(
      riskReport,
      portfolio,
      { maxBudgetUsd: 5 },
      { defaultBudgetUsd: 5, allowDeepBookPredict: false, now: new Date('2026-05-20T00:00:00.000Z') },
    );
    const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
    const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));
    const monitorRules = buildMonitorRules({
      portfolio,
      riskReport,
      recommendation,
      policy,
      policyCheck,
      now: new Date('2026-05-20T00:00:00.000Z'),
    });

    const decision = buildAgentCouncilDecision({
      riskReport,
      recommendation,
      policy,
      policyCheck,
      monitorRules,
      deepbookMarketEvidence: createDeepBookMarketEvidence({
        snapshot: null,
        walletAddress: '0xREAL',
        routeStatus: 'idle',
      }),
      explanationMode: 'mock',
      walletConnected: true,
      auditArchived: false,
      receiptEnabled: false,
    });

    expect(decision.posture).toBe('audit_only');
    expect(decision.managerSummary).toContain('仅审计');
    expect(decision.agents.find((agent) => agent.id === 'manager')?.handoff).toBe('默认动作仍为 Prepare/归档。');
  });

  it('marks DeepBook evidence as pending or warning when the market snapshot is unavailable', () => {
    const input = buildCouncilInput();
    const decision = buildAgentCouncilDecision({
      ...input,
      deepbookMarketEvidence: createDeepBookMarketEvidence({
        snapshot: null,
        walletAddress: '0xDEMO',
        routeStatus: 'error',
        error: 'Market lookup failed',
      }),
    });

    expect(decision.evidenceTimeline.find((step) => step.id === 'deepbook')).toMatchObject({
      status: 'warning',
      evidenceRef: 'deepbookMarketEvidence',
    });
  });
});
