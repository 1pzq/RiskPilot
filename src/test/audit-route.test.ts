import { describe, expect, it } from 'vitest';

import { buildAgentCouncilDecision } from '@/lib/agents/decision-council';
import { buildIncidentRoomDecision } from '@/lib/agents/incident-room';
import { createDemoPortfolio } from '@/lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '@/lib/risk/risk-engine';
import { buildMonitorRules } from '@/lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';
import type { AuditPackage } from '@/lib/walrus/types';

function buildAuditPackage(): AuditPackage {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const policyCheck = validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z'));
  const deepbookMarketEvidence = createDeepBookMarketEvidence({
    snapshot: null,
    walletAddress: '0xDEMO',
    routeStatus: 'idle',
  });
  const monitorRules = buildMonitorRules({
    portfolio,
    riskReport,
    recommendation,
    policy,
    policyCheck,
    deepbookMarketStatus: 'ready',
    now: new Date('2026-05-20T00:00:00.000Z'),
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
    auditArchived: false,
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
    auditArchived: false,
    receiptEnabled: true,
    agentCouncil,
  });

  return {
    id: 'audit_route_preview_guard',
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

describe('audit route', () => {
  it('rejects ordinary archive payloads because Walrus payment must happen in the connected wallet', async () => {
    const { POST } = await import('@/app/api/audit/route');

    const response = await POST(
      new Request('http://localhost/api/audit', {
        method: 'POST',
        body: JSON.stringify(buildAuditPackage()),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Server-side Walrus archive is disabled');
  });

  it('rejects what-if preview payloads before archive storage', async () => {
    const { POST } = await import('@/app/api/audit/route');

    const response = await POST(
      new Request('http://localhost/api/audit', {
        method: 'POST',
        body: JSON.stringify({
          ...buildAuditPackage(),
          riskReportBefore: {
            ...buildAuditPackage().riskReportBefore,
            previewOnly: true,
          },
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('What-if preview');
  });
});
