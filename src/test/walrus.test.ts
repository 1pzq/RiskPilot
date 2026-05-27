import { describe, expect, it } from 'vitest';

import { buildAgentCouncilDecision } from '../lib/agents/decision-council';
import { buildIncidentRoomDecision } from '../lib/agents/incident-room';
import { createDemoPortfolio } from '../lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '../lib/risk/risk-engine';
import { buildMonitorRules } from '../lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '../lib/strategy/policy';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';
import { createDeepBookMarketEvidence } from '../lib/walrus/audit-package';
import { storeAuditPackage } from '../lib/walrus/walrus-client';
import { storeAuditPackageWithConnectedWallet } from '../lib/walrus/wallet-archive';
import type { AuditPackage } from '../lib/walrus/types';

function buildAuditPackage(): AuditPackage {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
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
  const agentCouncil = buildAgentCouncilDecision({
    riskReport,
    recommendation,
    policy,
    policyCheck,
    monitorRules,
    deepbookMarketEvidence,
    explanationMode: 'mock',
    walletConnected: false,
    auditArchived: true,
    receiptEnabled: true,
  });
  const incidentRoom = buildIncidentRoomDecision({
    riskReport,
    recommendation,
    policy,
    policyCheck,
    monitorRules,
    deepbookMarketEvidence,
    explanationMode: 'mock',
    walletConnected: false,
    auditArchived: true,
    receiptEnabled: true,
    agentCouncil,
  });

  return {
    id: 'audit_test',
    createdAt: '2026-05-20T00:00:00.000Z',
    walletAddress: '0xDEMO',
    portfolioSnapshot: portfolio,
    riskReportBefore: riskReport,
    recommendation,
    monitorRules,
    deepbookMarketEvidence,
    policy,
    policyCheck,
    agentCouncil,
    incidentRoom,
    aiExplanation: 'Mock explanation.',
    execution: {
      mode: 'prepare_mainnet',
      status: 'prepared',
      digest: 'prep_test',
    },
    riskReportAfter: estimatePostStrategyRisk(riskReport, recommendation.expectedRiskReduction),
  };
}

describe('Walrus audit storage', () => {
  it('keeps DeepBook market evidence in the audit package payload', () => {
    const auditPackage = buildAuditPackage();

    expect(auditPackage.deepbookMarketEvidence).toMatchObject({
      source: '/api/deepbook-market',
      status: 'ready',
      routeStatus: 'ready',
      walletAddress: '0xDEMO',
      poolKey: 'SUI_USDC',
      baseCoin: 'SUI',
      quoteCoin: 'USDC',
      midPrice: 3.25,
      quoteOutForOneBase: 3.2,
      registeredPool: true,
      poolStatus: 'registered',
      fetchedAt: '2026-05-21T00:00:00.000Z',
    });
  });

  it('keeps monitor rules in the audit package payload', () => {
    const auditPackage = buildAuditPackage();

    expect(auditPackage.monitorRules.length).toBeGreaterThanOrEqual(2);
    expect(auditPackage.monitorRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'SUI drawdown reaches strategy threshold',
          enabled: true,
          recommendedAction: expect.objectContaining({
            kind: 'prepare',
          }),
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

  it('keeps the agent council and evidence timeline in the audit package payload', () => {
    const auditPackage = buildAuditPackage();

    expect(auditPackage.agentCouncil).toMatchObject({
      mode: 'deterministic_fallback',
      posture: 'prepare_ready',
      agents: expect.arrayContaining([
        expect.objectContaining({ id: 'risk_analyst' }),
        expect.objectContaining({ id: 'policy_guard' }),
        expect.objectContaining({ id: 'manager' }),
      ]),
    });
    expect(auditPackage.agentCouncil?.evidenceTimeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wallet-scan', evidenceRef: 'portfolioSnapshot' }),
        expect.objectContaining({ id: 'deepbook', evidenceRef: 'deepbookMarketEvidence' }),
        expect.objectContaining({ id: 'walrus', status: 'complete' }),
      ]),
    );
  });

  it('keeps the incident room task board and consensus in the audit package payload', () => {
    const auditPackage = buildAuditPackage();

    expect(auditPackage.incidentRoom).toMatchObject({
      mode: 'deterministic_fallback',
      posture: 'prepare_ready',
      sourceCouncilId: auditPackage.agentCouncil?.id,
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: 'manager', locked: true }),
        expect.objectContaining({ id: 'liquidity_scout', evidenceRefs: expect.arrayContaining(['deepbookMarketEvidence']) }),
        expect.objectContaining({ id: 'audit_agent' }),
      ]),
      consensus: expect.arrayContaining([
        expect.objectContaining({ id: 'policy-consensus', evidenceRef: 'policyCheck' }),
        expect.objectContaining({ id: 'market-consensus', evidenceRef: 'deepbookMarketEvidence' }),
      ]),
    });
    expect(auditPackage.incidentRoom?.evidenceTimeline).toEqual(auditPackage.agentCouncil?.evidenceTimeline);
  });

  it('preserves real mainnet transaction digest and effects status in the audit package', () => {
    const auditPackage = buildAuditPackage();
    auditPackage.execution = {
      mode: 'mainnet',
      status: 'confirmed',
      digest: 'Fui3ESVAtzsVwe55tPGE4VirWgouVw68o7kGH7X6woqP',
      effectsStatus: 'success',
      preparedTransactionSummary: 'Live DeepBook mainnet swap: sell SUI for USDC.',
      adapter: {
        venue: 'DeepBook mainnet',
        requestedMode: 'mainnet',
        mainnetOnly: true,
      },
    };

    expect(auditPackage.execution).toMatchObject({
      mode: 'mainnet',
      status: 'confirmed',
      digest: 'Fui3ESVAtzsVwe55tPGE4VirWgouVw68o7kGH7X6woqP',
      effectsStatus: 'success',
      adapter: {
        venue: 'DeepBook mainnet',
        requestedMode: 'mainnet',
      },
    });
    expect(auditPackage.deepbookMarketEvidence.poolKey).toBe('SUI_USDC');
    expect(auditPackage.monitorRules.length).toBeGreaterThan(0);
  });

  it('records an unavailable DeepBook market evidence state when the snapshot is missing', () => {
    const evidence = createDeepBookMarketEvidence({
      snapshot: null,
      walletAddress: '0x2',
      poolKey: 'SUI_USDC',
      routeStatus: 'error',
      error: 'DeepBook market lookup failed',
    });

    expect(evidence).toMatchObject({
      status: 'unavailable',
      routeStatus: 'error',
      poolKey: 'SUI_USDC',
      poolStatus: 'unknown',
      whitelistStatus: 'unknown',
      error: 'DeepBook market lookup failed',
    });
    expect(evidence.fallbackReason).toContain('unavailable');
  });

  it('blocks server-side Walrus archive by default', async () => {
    await expect(storeAuditPackage(buildAuditPackage())).rejects.toThrow(
      'Server-side Walrus archive is disabled',
    );
  });

  it('blocks what-if preview payloads before wallet-paid Walrus archive can request a signature', async () => {
    const auditPackage = buildAuditPackage();
    const signAndExecute = async () => {
      throw new Error('signAndExecute should not be called for preview payloads.');
    };

    await expect(
      storeAuditPackageWithConnectedWallet({
        auditPackage: ({
          ...auditPackage,
          deepbookMarketEvidence: {
            ...auditPackage.deepbookMarketEvidence,
            previewOnly: true,
          },
        } as unknown) as AuditPackage,
        walletAddress: '0xDEMO',
        signAndExecute,
      }),
    ).rejects.toThrow('What-if preview payloads cannot be submitted');
  });

});
