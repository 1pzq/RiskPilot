import { afterEach, describe, expect, it, vi } from 'vitest';

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

  return {
    riskReport,
    recommendation,
    policy,
    policyCheck,
    monitorRules,
    deepbookMarketEvidence: createDeepBookMarketEvidence({
      snapshot: null,
      walletAddress: '0xDEMO',
      routeStatus: 'idle',
    }),
    explanationMode: 'mock' as const,
    walletConnected: false,
    auditArchived: false,
    receiptEnabled: true,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('agent council route', () => {
  it('returns deterministic fallback when OpenAI is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { POST } = await import('@/app/api/agent-council/route');

    const response = await POST(
      new Request('http://localhost/api/agent-council', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      }),
    );
    const payload = (await response.json()) as { decision: { mode: string; posture: string; warning?: string } };

    expect(response.status).toBe(200);
    expect(payload.decision.mode).toBe('deterministic_fallback');
    expect(payload.decision.warning).toContain('OPENAI_API_KEY');
  });

  it('returns an AI council from mocked chat completion', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    vi.stubEnv('OPENAI_MODEL', 'deepseek-test');
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              managerSummary: 'Route AI manager summary.',
              agents: [
                {
                  id: 'manager',
                  summary: 'Route manager keeps the locked posture.',
                  evidence: ['Locked posture from deterministic council.'],
                  handoff: 'Default action remains prepare/archive.',
                  confidence: 90,
                },
              ],
            }),
          },
        },
      ],
    });
    const { POST } = await import('@/app/api/agent-council/route');

    const response = await POST(
      new Request('http://localhost/api/agent-council', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      }),
    );
    const payload = (await response.json()) as { decision: { mode: string; model?: string; managerSummary: string } };

    expect(response.status).toBe(200);
    expect(payload.decision.mode).toBe('openai');
    expect(payload.decision.model).toBe('deepseek-test');
    expect(payload.decision.managerSummary).toBe('Route AI manager summary.');
  });
});
