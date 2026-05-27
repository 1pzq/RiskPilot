import { describe, expect, it } from 'vitest';

import { buildAgentCouncilDecision } from '@/lib/agents/decision-council';
import { buildIncidentRoomDecision } from '@/lib/agents/incident-room';
import { createDemoPortfolio } from '@/lib/risk/fixtures';
import type { PortfolioSnapshot } from '@/lib/risk/types';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { buildWhatIfSimulation } from '@/lib/risk/what-if-engine';
import { buildMonitorRules } from '@/lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';

function buildIncidentInput(options?: { policyBlocked?: boolean; walletReview?: boolean; deepbookUnavailable?: boolean }) {
  const portfolio: PortfolioSnapshot = options?.walletReview
    ? {
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
      }
    : createDemoPortfolio('0xDEMO', {
        timestamp: '2026-05-20T00:00:00.000Z',
      });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(
    riskReport,
    portfolio,
    { maxBudgetUsd: 5 },
    {
      defaultBudgetUsd: 5,
      allowDeepBookPredict: !options?.walletReview,
      now: new Date('2026-05-20T00:00:00.000Z'),
    },
  );
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const policyCheck = options?.policyBlocked
    ? {
        ok: false,
        errors: ['Estimated cost exceeds max budget.'],
      }
    : validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const monitorRules = buildMonitorRules({
    portfolio,
    riskReport,
    recommendation,
    policy,
    policyCheck,
    deepbookMarketStatus: options?.deepbookUnavailable ? 'error' : 'ready',
    now: new Date('2026-05-20T00:00:00.000Z'),
  });
  const deepbookMarketEvidence = createDeepBookMarketEvidence({
    snapshot:
      options?.walletReview || options?.deepbookUnavailable
        ? null
        : {
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
    walletAddress: portfolio.walletAddress,
    routeStatus: options?.deepbookUnavailable ? 'error' : options?.walletReview ? 'idle' : 'ready',
    error: options?.deepbookUnavailable ? 'Market lookup failed' : undefined,
  });
  const agentCouncil = buildAgentCouncilDecision({
    riskReport,
    recommendation,
    policy,
    policyCheck,
    monitorRules,
    deepbookMarketEvidence,
    explanationMode: 'mock',
    walletConnected: Boolean(options?.walletReview),
    auditArchived: false,
    receiptEnabled: true,
  });

  return {
    riskReport,
    recommendation,
    policy,
    policyCheck,
    monitorRules,
    deepbookMarketEvidence,
    explanationMode: 'mock' as const,
    walletConnected: Boolean(options?.walletReview),
    auditArchived: false,
    receiptEnabled: true,
    agentCouncil,
  };
}

describe('incident room decision', () => {
  it('builds a deterministic incident room with tasks, handoffs, consensus, and council timeline', () => {
    const decision = buildIncidentRoomDecision(buildIncidentInput());

    expect(decision.mode).toBe('deterministic_fallback');
    expect(decision.posture).toBe('prepare_ready');
    expect(decision.tasks.map((task) => task.id)).toEqual([
      'manager',
      'risk_analyst',
      'liquidity_scout',
      'policy_guard',
      'execution_planner',
      'audit_agent',
    ]);
    expect(decision.handoffs).toHaveLength(5);
    expect(decision.consensus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'policy-consensus', status: 'agree' }),
        expect.objectContaining({ id: 'market-consensus', status: 'agree' }),
      ]),
    );
    expect(decision.evidenceTimeline.find((step) => step.id === 'policy')).toMatchObject({
      status: 'complete',
      evidenceRef: 'policyCheck',
    });
  });

  it('locks policy blocked incidents as critical and blocks execution handoff', () => {
    const decision = buildIncidentRoomDecision(buildIncidentInput({ policyBlocked: true }));

    expect(decision.posture).toBe('policy_blocked');
    expect(decision.severity).toBe('critical');
    expect(decision.finalCommand).toContain('Hold the incident');
    expect(decision.tasks.find((task) => task.id === 'policy_guard')).toMatchObject({
      status: 'blocked',
      locked: true,
    });
    expect(decision.consensus.find((item) => item.id === 'policy-consensus')).toMatchObject({
      status: 'blocked',
    });
  });

  it('keeps wallet review incidents audit-only with a no-trade command', () => {
    const decision = buildIncidentRoomDecision(buildIncidentInput({ walletReview: true }));

    expect(decision.posture).toBe('audit_only');
    expect(decision.finalCommand).toContain('no-trade wallet review');
    expect(decision.tasks.find((task) => task.id === 'execution_planner')?.handoff).toContain('no-trade review');
    expect(decision.consensus.find((item) => item.id === 'execution-consensus')).toMatchObject({
      status: 'watch',
    });
  });

  it('keeps DeepBook unavailable as a market watch consensus', () => {
    const decision = buildIncidentRoomDecision(buildIncidentInput({ deepbookUnavailable: true }));

    expect(decision.tasks.find((task) => task.id === 'liquidity_scout')).toMatchObject({
      status: 'watch',
    });
    expect(decision.consensus.find((item) => item.id === 'market-consensus')).toMatchObject({
      status: 'watch',
      evidenceRef: 'deepbookMarketEvidence',
    });
  });

  it('can evaluate a policy-cut what-if preview as a blocked incident without mutating the base wallet', () => {
    const portfolio = createDemoPortfolio('0xDEMO', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });
    const simulation = buildWhatIfSimulation(portfolio, 'policy_budget_cut');
    const recommendation = buildStrategyRecommendation(
      simulation.simulatedRiskReport,
      simulation.simulatedPortfolio,
      { maxBudgetUsd: 5 },
      { defaultBudgetUsd: 5, now: new Date('2026-05-20T00:00:00.000Z') },
    );
    const basePolicy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
    const policy = {
      ...basePolicy,
      maxBudgetUsd: basePolicy.maxBudgetUsd * 0.5,
      maxSingleTradeUsd: basePolicy.maxSingleTradeUsd * 0.5,
    };
    const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));
    const monitorRules = buildMonitorRules({
      portfolio: simulation.simulatedPortfolio,
      riskReport: simulation.simulatedRiskReport,
      recommendation,
      policy,
      policyCheck,
      deepbookMarketStatus: 'ready',
      now: new Date('2026-05-20T00:00:00.000Z'),
    });

    const decision = buildIncidentRoomDecision({
      riskReport: simulation.simulatedRiskReport,
      recommendation,
      policy,
      policyCheck,
      monitorRules,
      deepbookMarketEvidence: createDeepBookMarketEvidence({
        snapshot: null,
        walletAddress: '0xDEMO',
        routeStatus: 'idle',
      }),
      explanationMode: 'mock',
      walletConnected: false,
      auditArchived: false,
      receiptEnabled: true,
    });

    expect(simulation.previewOnly).toBe(true);
    expect(policyCheck.ok).toBe(false);
    expect(decision.posture).toBe('policy_blocked');
    expect(decision.finalCommand).toContain('Hold the incident');
    expect(portfolio.totalUsdValue).toBe(simulation.basePortfolio.totalUsdValue);
  });
});
