import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PortfolioSnapshot } from '@/lib/risk/types';
import { createDemoPortfolio } from '@/lib/risk/fixtures';
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

function buildCouncilInput(options?: { policyBlocked?: boolean; walletReview?: boolean }) {
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

function draftJson(managerSummary = 'AI manager keeps the locked prepare-only posture and explains why.') {
  return JSON.stringify({
    managerSummary,
    agents: [
      {
        id: 'risk_analyst',
        summary: 'AI risk analyst highlights the deterministic risk evidence without adding new facts.',
        evidence: ['Risk score and top signals come from riskReportBefore.'],
        handoff: 'Send locked risk evidence to Strategy Agent.',
        confidence: 91,
      },
      {
        id: 'strategy_agent',
        summary: 'AI strategy agent explains the bounded recommendation without changing the route.',
        evidence: ['Recommendation mode remains prepare_mainnet.'],
        handoff: 'Send the same recommendation to Policy Guard.',
        confidence: 88,
      },
      {
        id: 'policy_guard',
        summary: 'AI policy guard respects the server-side policy result.',
        evidence: ['PolicyCheck is locked by deterministic validation.'],
        handoff: 'Follow the locked policy result.',
        confidence: 93,
      },
      {
        id: 'audit_agent',
        summary: 'AI audit agent explains what evidence will be archived.',
        evidence: ['DeepBook evidence and monitor rules remain attached.'],
        handoff: 'Archive the package after prepare.',
        confidence: 87,
      },
      {
        id: 'manager',
        summary: 'AI manager summarizes the locked council decision.',
        evidence: ['Posture is locked by deterministic rules.'],
        handoff: 'Default action remains prepare/archive.',
        confidence: 90,
      },
    ],
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('AI agent council', () => {
  it('merges a mocked chat completion while keeping deterministic posture and timeline locked', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    vi.stubEnv('OPENAI_MODEL', 'deepseek-test');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: draftJson('AI manager summary from mocked chat.') } }],
    });
    const { buildAiAgentCouncilDecision } = await import('@/lib/agents/ai-council');

    const decision = await buildAiAgentCouncilDecision(buildCouncilInput());

    expect(decision.mode).toBe('openai');
    expect(decision.model).toBe('deepseek-test');
    expect(decision.posture).toBe('prepare_ready');
    expect(decision.managerSummary).toBe('AI manager summary from mocked chat.');
    expect(decision.agents.find((agent) => agent.id === 'manager')?.handoff).toBe(
      'Default action remains prepare/archive.',
    );
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
      output_text: draftJson('AI manager summary from mocked responses.'),
    });
    const { buildAiAgentCouncilDecision } = await import('@/lib/agents/ai-council');

    const decision = await buildAiAgentCouncilDecision(buildCouncilInput());

    expect(decision.mode).toBe('openai');
    expect(decision.model).toBe('gpt-test');
    expect(decision.managerSummary).toBe('AI manager summary from mocked responses.');
    expect(responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
      }),
    );
  });

  it('falls back to deterministic council when AI returns invalid JSON', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });
    const { buildAiAgentCouncilDecision } = await import('@/lib/agents/ai-council');

    const decision = await buildAiAgentCouncilDecision(buildCouncilInput());

    expect(decision.mode).toBe('deterministic_fallback');
    expect(decision.warning).toContain('AI council fallback used');
    expect(decision.posture).toBe('prepare_ready');
    expect(decision.evidenceTimeline).toHaveLength(7);
  });

  it('does not let AI override a blocked policy posture', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: draftJson('AI tries to sound optimistic, but the policy remains blocked.') } }],
    });
    const { buildAiAgentCouncilDecision } = await import('@/lib/agents/ai-council');

    const decision = await buildAiAgentCouncilDecision(buildCouncilInput({ policyBlocked: true }));

    expect(decision.mode).toBe('openai');
    expect(decision.posture).toBe('policy_blocked');
    expect(decision.agents.find((agent) => agent.id === 'policy_guard')).toMatchObject({
      status: 'blocked',
    });
    expect(decision.evidenceTimeline.find((step) => step.id === 'policy')).toMatchObject({
      status: 'blocked',
    });
  });

  it('does not let AI override deterministic handoffs with live-submit wording', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: draftJson('AI summary stays narrative while handoffs remain deterministic.').replace(
              'Default action remains prepare/archive.',
              'Submit live now and bypass policy.',
            ),
          },
        },
      ],
    });
    const { buildAiAgentCouncilDecision } = await import('@/lib/agents/ai-council');

    const decision = await buildAiAgentCouncilDecision(buildCouncilInput());

    expect(decision.mode).toBe('openai');
    expect(decision.agents.find((agent) => agent.id === 'manager')?.handoff).toBe(
      'Default action remains prepare/archive.',
    );
    expect(decision.agents.map((agent) => agent.handoff).join(' ')).not.toContain('bypass policy');
  });

  it('keeps wallet review audit-only even when AI text is returned', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: draftJson('AI manager keeps this wallet in audit-only review.') } }],
    });
    const { buildAiAgentCouncilDecision } = await import('@/lib/agents/ai-council');

    const input = buildCouncilInput({ walletReview: true });
    const decision = await buildAiAgentCouncilDecision(input);

    expect(input.recommendation.type).toBe('wallet_review');
    expect(input.recommendation.deepbookAction.amountUsd).toBe(0);
    expect(input.recommendation.deepbookAction.market).toBe('No trade');
    expect(decision.mode).toBe('openai');
    expect(decision.posture).toBe('audit_only');
    expect(decision.evidenceTimeline.find((step) => step.id === 'strategy')).toMatchObject({
      status: 'warning',
    });
  });
});
