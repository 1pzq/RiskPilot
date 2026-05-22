import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDemoPortfolio } from '../lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '../lib/risk/risk-engine';
import { createDefaultPolicy, validateExecutionPolicy } from '../lib/strategy/policy';
import { buildStrategyRecommendation } from '../lib/strategy/strategy-builder';
import { storeAuditPackage, storeAuditPackageWalrus } from '../lib/walrus/walrus-client';
import type { AuditPackage } from '../lib/walrus/types';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function buildAuditPackage(): AuditPackage {
  const portfolio = createDemoPortfolio('0xDEMO', {
    timestamp: '2026-05-20T00:00:00.000Z',
  });
  const riskReport = calculateRiskReport(portfolio);
  const recommendation = buildStrategyRecommendation(riskReport, portfolio, { maxBudgetUsd: 5 }, { defaultBudgetUsd: 5 });
  const policy = createDefaultPolicy(recommendation, new Date('2026-05-20T00:00:00.000Z'));

  return {
    id: 'audit_test',
    createdAt: '2026-05-20T00:00:00.000Z',
    walletAddress: '0xDEMO',
    portfolioSnapshot: portfolio,
    riskReportBefore: riskReport,
    recommendation,
    policy,
    policyCheck: validateExecutionPolicy(policy, recommendation, new Date('2026-05-20T00:00:00.000Z')),
    aiExplanation: 'Mock explanation.',
    execution: {
      mode: 'prepare_mainnet',
      status: 'prepared',
      digest: 'prep_test',
    },
    riskReportAfter: estimatePostStrategyRisk(riskReport, recommendation.expectedRiskReduction),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

describe('Walrus audit storage', () => {
  it('uses local storage when explicitly configured for local development', async () => {
    process.env.WALRUS_MODE = 'local';

    const result = await storeAuditPackage(buildAuditPackage());

    expect(result.mode).toBe('local');
    expect(result.provider).toBe('local-file');
    expect(result.warning).toContain('WALRUS_MODE');
    expect(result.checksum).toHaveLength(64);
  });

  it('falls back locally when Walrus mainnet is not configured', async () => {
    delete process.env.WALRUS_MODE;
    delete process.env.WALRUS_PUBLISHER_URL;

    const result = await storeAuditPackage(buildAuditPackage());

    expect(result.mode).toBe('local');
    expect(result.fallback).toBe(true);
    expect(result.error).toContain('WALRUS_PUBLISHER_URL');
    expect(result.warning).toContain('not configured');
  });

  it('uploads to the configured Walrus publisher endpoint', async () => {
    process.env.WALRUS_PUBLISHER_URL = 'https://publisher.walrus.mainnet.example';
    process.env.WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus.mainnet.example';

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        newlyCreated: {
          blobObject: {
            blobId: 'walrus_blob_123',
          },
        },
      }),
    })) as unknown as typeof fetch;

    globalThis.fetch = fetchMock;

    const result = await storeAuditPackageWalrus(buildAuditPackage());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://publisher.walrus.mainnet.example/v1/blobs?epochs=1',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        mode: 'walrus',
        provider: 'walrus-mainnet-publisher',
        id: 'walrus_blob_123',
        url: 'https://aggregator.walrus.mainnet.example/v1/blobs/walrus_blob_123',
      }),
    );
  });
});
