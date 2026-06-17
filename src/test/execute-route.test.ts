import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '@/lib/risk/fixtures';
import { calculateRiskReport } from '@/lib/risk/risk-engine';
import { createExecutionIntent } from '@/lib/security/execution-intent';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildStrategyRecommendation } from '@/lib/strategy/strategy-builder';

async function buildExecutePayload() {
  const now = new Date();
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: now.toISOString(),
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(
    riskReport,
    portfolio,
    { maxBudgetUsd: 5 },
    { defaultBudgetUsd: 5, now },
  );
  const policy = createDefaultPolicy(recommendation, now);
  const policyCheck = validateExecutionPolicy(policy, recommendation, now);
  const executionIntent = await createExecutionIntent({
    portfolioSnapshot: portfolio,
    riskReport,
    recommendation,
    policy,
    source: 'local_sample',
    now,
  });

  return {
    recommendation,
    policy,
    policyCheck,
    executionIntent,
    portfolioSnapshot: portfolio,
    riskReport,
    walletAddress: '0xDEMO',
    executionMode: 'prepare_mainnet',
  };
}

describe('execute route', () => {
  it('rejects what-if preview payloads before execution', async () => {
    const { POST } = await import('@/app/api/execute/route');

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify({
          ...(await buildExecutePayload()),
          previewOnly: true,
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('What-if preview');
  });

  it('rejects execution when intent is missing', async () => {
    const { POST } = await import('@/app/api/execute/route');
    const payloadWithIntent = await buildExecutePayload();
    const payloadWithoutIntent = {
      recommendation: payloadWithIntent.recommendation,
      policy: payloadWithIntent.policy,
      policyCheck: payloadWithIntent.policyCheck,
      portfolioSnapshot: payloadWithIntent.portfolioSnapshot,
      riskReport: payloadWithIntent.riskReport,
      walletAddress: payloadWithIntent.walletAddress,
      executionMode: payloadWithIntent.executionMode,
    };

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify(payloadWithoutIntent),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Execution intent is required');
  });

  it('rejects hand-crafted unsupported execution mode', async () => {
    const { POST } = await import('@/app/api/execute/route');

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify({
          ...(await buildExecutePayload()),
          executionMode: 'simulation',
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Invalid option');
    expect(payload.error).toContain('executionMode');
  });

  it('rejects intent verification when portfolio or risk context is missing', async () => {
    const { POST } = await import('@/app/api/execute/route');
    const payloadWithContext = await buildExecutePayload();
    const payloadWithoutContext = {
      recommendation: payloadWithContext.recommendation,
      policy: payloadWithContext.policy,
      policyCheck: payloadWithContext.policyCheck,
      executionIntent: payloadWithContext.executionIntent,
      walletAddress: payloadWithContext.walletAddress,
      executionMode: payloadWithContext.executionMode,
    };

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify(payloadWithoutContext),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('portfolio snapshot is required');
    expect(payload.error).toContain('risk report is required');
  });

  it('rejects expired execution intents', async () => {
    const { POST } = await import('@/app/api/execute/route');
    const payload = await buildExecutePayload();
    const expiredIntent = await createExecutionIntent({
      portfolioSnapshot: payload.portfolioSnapshot,
      riskReport: payload.riskReport,
      recommendation: payload.recommendation,
      policy: payload.policy,
      source: 'local_sample',
      now: new Date(Date.now() - 60 * 60 * 1000),
      ttlMs: 1000,
    });

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          executionIntent: expiredIntent,
        }),
      }),
    );
    const result = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(result.error).toContain('Execution intent expired');
  });

  it('rejects digest mismatches', async () => {
    const { POST } = await import('@/app/api/execute/route');
    const payload = await buildExecutePayload();

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          recommendation: {
            ...payload.recommendation,
            summary: `${payload.recommendation.summary} Tampered after intent lock.`,
          },
        }),
      }),
    );
    const result = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(result.error).toContain('recommendation digest mismatch');
  });

  it('blocks reconstructed what-if payloads after the preview marker is removed', async () => {
    const { POST } = await import('@/app/api/execute/route');
    const payload = await buildExecutePayload();

    const response = await POST(
      new Request('http://localhost/api/execute', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          riskReport: {
            ...payload.riskReport,
            overallScore: payload.riskReport.overallScore + 10,
          },
        }),
      }),
    );
    const result = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(result.error).toContain('risk report digest mismatch');
  });
});
