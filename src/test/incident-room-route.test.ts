import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAgentCouncilDecision } from '@/lib/agents/decision-council';
import { createDemoPortfolio } from '@/lib/risk/fixtures';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { buildMonitorRules } from '@/lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';

const chatCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
      responses: {
        create: vi.fn(),
      },
      chat: {
        completions: {
          create: chatCreate,
        },
      },
    };
  }),
}));

function buildPayload() {
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
    snapshot: null,
    walletAddress: '0xDEMO',
    routeStatus: 'idle',
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
    agentCouncil,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('incident room route', () => {
  it('returns deterministic fallback when OpenAI is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { POST } = await import('@/app/api/incident-room/route');

    const response = await POST(
      new Request('http://localhost/api/incident-room', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      }),
    );
    const payload = (await response.json()) as {
      incidentRoom: { mode: string; posture: string; warning?: string; tasks: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(payload.incidentRoom.mode).toBe('deterministic_fallback');
    expect(payload.incidentRoom.posture).toBe('prepare_ready');
    expect(payload.incidentRoom.warning).toContain('OPENAI_API_KEY');
    expect(payload.incidentRoom.tasks).toHaveLength(6);
  });

  it('returns an AI incident room from mocked chat completion while final command stays locked', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    vi.stubEnv('OPENAI_MODEL', 'deepseek-test');
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              managerBriefing: 'Route AI incident manager briefing.',
              finalCommand: 'AI should not control the locked final command.',
              tasks: [
                {
                  id: 'manager',
                  findings: ['Route manager keeps deterministic posture.'],
                  handoff: 'Keep final command bounded.',
                },
              ],
            }),
          },
        },
      ],
    });
    const { POST } = await import('@/app/api/incident-room/route');

    const response = await POST(
      new Request('http://localhost/api/incident-room', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      }),
    );
    const payload = (await response.json()) as {
      incidentRoom: { mode: string; model?: string; managerBriefing: string; finalCommand: string };
    };

    expect(response.status).toBe(200);
    expect(payload.incidentRoom.mode).toBe('openai');
    expect(payload.incidentRoom.model).toBe('deepseek-test');
    expect(payload.incidentRoom.managerBriefing).toBe('Route AI incident manager briefing.');
    expect(payload.incidentRoom.finalCommand).toContain('Prepare the mainnet action package');
  });
});
