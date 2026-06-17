import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../app/api/explain/route';
import { createDemoPortfolio } from '../lib/risk/fixtures';
import { calculateRiskReport } from '../lib/risk/risk-engine';
import { createDefaultPolicy } from '../lib/strategy/policy';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';

const chatCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: chatCreate,
        },
      },
      responses: {
        create: vi.fn(),
      },
    };
  }),
}));

function buildExplainPayload() {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));

  return {
    portfolioSnapshot: portfolio,
    riskReport,
    recommendation,
    policy,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('explain route', () => {
  it('uses DeepSeek-compatible chat when configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.deepseek.com');
    vi.stubEnv('OPENAI_MODEL', 'deepseek-test');
    vi.stubEnv('OPENAI_API_MODE', 'chat');
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Risk: DeepSeek reviewed the wallet. Strategy: Prepare only. Policy: Limits apply. Safety: No autonomous transaction.',
          },
        },
      ],
    });

    const response = await POST(
      new Request('http://localhost/api/explain', {
        method: 'POST',
        body: JSON.stringify(buildExplainPayload()),
      }),
    );
    const payload = (await response.json()) as { mode: string; model: string; explanation: string };

    expect(response.status).toBe(200);
    expect(payload.mode).toBe('deepseek');
    expect(payload.model).toBe('deepseek-test');
    expect(payload.explanation).toContain('DeepSeek reviewed');
    expect(chatCreate).toHaveBeenCalled();
  });

  it('falls back to a mock explanation when AI provider is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');

    const response = await POST(
      new Request('http://localhost/api/explain', {
        method: 'POST',
        body: JSON.stringify(buildExplainPayload()),
      }),
    );
    const payload = (await response.json()) as { mode: string; explanation: string };

    expect(response.status).toBe(200);
    expect(payload.mode).toBe('mock');
    expect(payload.explanation).toContain('仅 Prepare mainnet');
  });
});
