import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDemoPortfolio } from '@/lib/risk/fixtures';
import type { PortfolioSnapshot } from '@/lib/risk/types';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { buildMonitorRules } from '@/lib/strategy/monitor';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';

const responsesCreate = vi.fn();
const chatCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
      responses: {
        create: responsesCreate,
      },
      chat: {
        completions: {
          create: chatCreate,
        },
      },
    };
  }),
}));

function buildIncidentInput(options?: { policyBlocked?: boolean; walletReview?: boolean }) {
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
      snapshot: options?.walletReview
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
      routeStatus: options?.walletReview ? 'idle' : 'ready',
    }),
    explanationMode: 'mock' as const,
    walletConnected: options?.walletReview ?? false,
    auditArchived: false,
    receiptEnabled: true,
  };
}

function draftJson(managerBriefing = 'AI manager runs the incident room without changing locked posture.') {
  return JSON.stringify({
    managerBriefing,
    finalCommand: 'AI final command keeps the default prepare/archive boundary.',
    tasks: [
      {
        id: 'manager',
        findings: ['AI manager references locked deterministic posture.'],
        handoff: 'Keep the final command inside deterministic bounds.',
      },
      {
        id: 'risk_analyst',
        findings: ['AI risk analyst summarizes risk evidence.'],
        handoff: 'Pass risk context to Liquidity Scout.',
      },
      {
        id: 'liquidity_scout',
        findings: ['AI liquidity scout summarizes DeepBook evidence.'],
        handoff: 'Pass market readiness to Execution Planner.',
      },
      {
        id: 'policy_guard',
        findings: ['AI policy guard respects policyCheck.'],
        handoff: 'Keep policy gate locked.',
      },
      {
        id: 'execution_planner',
        findings: ['AI execution planner keeps prepare-only default.'],
        handoff: 'Send bounded package to Audit Agent.',
      },
      {
        id: 'audit_agent',
        findings: ['AI audit agent summarizes evidence sealing.'],
        handoff: 'Archive evidence after prepare.',
      },
    ],
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('AI incident room', () => {
  it('merges a mocked chat completion while keeping deterministic posture, consensus, and timeline locked', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    vi.stubEnv('OPENAI_MODEL', 'deepseek-test');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: draftJson('AI incident manager briefing from mocked chat.') } }],
    });
    const { buildAiIncidentRoomDecision } = await import('@/lib/agents/ai-incident-room');

    const decision = await buildAiIncidentRoomDecision(buildIncidentInput());

    expect(decision.mode).toBe('openai');
    expect(decision.model).toBe('deepseek-test');
    expect(decision.posture).toBe('prepare_ready');
    expect(decision.managerBriefing).toBe('AI incident manager briefing from mocked chat.');
    expect(decision.consensus.find((item) => item.id === 'policy-consensus')).toMatchObject({
      status: 'agree',
      evidenceRef: 'policyCheck',
    });
    expect(decision.evidenceTimeline.find((step) => step.id === 'policy')).toMatchObject({
      status: 'complete',
      evidenceRef: 'policyCheck',
    });
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: 'json_object' },
      }),
    );
  });

  it('uses the mocked Responses API when configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'responses');
    vi.stubEnv('OPENAI_MODEL', 'gpt-test');
    responsesCreate.mockResolvedValue({
      output_text: draftJson('AI incident manager briefing from mocked responses.'),
    });
    const { buildAiIncidentRoomDecision } = await import('@/lib/agents/ai-incident-room');

    const decision = await buildAiIncidentRoomDecision(buildIncidentInput());

    expect(decision.mode).toBe('openai');
    expect(decision.model).toBe('gpt-test');
    expect(decision.managerBriefing).toBe('AI incident manager briefing from mocked responses.');
    expect(responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
      }),
    );
  });

  it('falls back to deterministic incident room when AI returns invalid JSON', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });
    const { buildAiIncidentRoomDecision } = await import('@/lib/agents/ai-incident-room');

    const decision = await buildAiIncidentRoomDecision(buildIncidentInput());

    expect(decision.mode).toBe('deterministic_fallback');
    expect(decision.warning).toContain('AI incident room fallback used');
    expect(decision.posture).toBe('prepare_ready');
    expect(decision.tasks).toHaveLength(6);
  });

  it('does not let AI override a blocked policy posture', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: draftJson('AI tries to sound optimistic, but policy remains blocked.') } }],
    });
    const { buildAiIncidentRoomDecision } = await import('@/lib/agents/ai-incident-room');

    const decision = await buildAiIncidentRoomDecision(buildIncidentInput({ policyBlocked: true }));

    expect(decision.mode).toBe('openai');
    expect(decision.posture).toBe('policy_blocked');
    expect(decision.severity).toBe('critical');
    expect(decision.tasks.find((task) => task.id === 'policy_guard')).toMatchObject({
      status: 'blocked',
    });
    expect(decision.consensus.find((item) => item.id === 'policy-consensus')).toMatchObject({
      status: 'blocked',
    });
  });

  it('keeps wallet review audit-only even when AI text is returned', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: draftJson('AI manager keeps this as no-trade review.') } }],
    });
    const { buildAiIncidentRoomDecision } = await import('@/lib/agents/ai-incident-room');

    const decision = await buildAiIncidentRoomDecision(buildIncidentInput({ walletReview: true }));

    expect(decision.mode).toBe('openai');
    expect(decision.posture).toBe('audit_only');
    expect(decision.finalCommand).toContain('no-trade wallet review');
    expect(decision.tasks.find((task) => task.id === 'execution_planner')).toMatchObject({
      status: 'watch',
    });
    expect(decision.consensus.find((item) => item.id === 'execution-consensus')).toMatchObject({
      status: 'watch',
    });
  });
});
