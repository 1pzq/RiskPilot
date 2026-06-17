import { describe, expect, it } from 'vitest';

import {
  buildPreparedDeepBookPtbTransaction,
  buildPreparedDeepBookPtb,
  createSignedPreparedPtb,
  executionDigestForReceipt,
} from '@/lib/sui/prepared-ptb';
import type { DeepBookLiveMarketSnapshot } from '@/lib/sui/deepbook-live';
import { createAuditPackage, createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';

const marketSnapshot: DeepBookLiveMarketSnapshot = {
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
  fetchedAt: '2026-06-14T00:00:00.000Z',
};

const spotRecommendation = {
  title: 'SUI downside protection',
  type: 'sui_downside_protection' as const,
  deepbookAction: {
    mode: 'prepare_mainnet' as const,
    kind: 'spot' as const,
    market: 'SUI/USDC',
    side: 'sell' as const,
    assetIn: 'SUI',
    assetOut: 'USDC',
    amountUsd: 5,
    description: 'demo',
  },
} satisfies Parameters<typeof buildPreparedDeepBookPtb>[0]['recommendation'];

describe('prepared DeepBook PTB', () => {
  it('builds a supported SUI/USDC spot PTB plan without submitting it', () => {
    const prepared = buildPreparedDeepBookPtb({
      recommendation: spotRecommendation,
      marketSnapshot,
    });

    expect(prepared).toMatchObject({
      status: 'built',
      eligible: true,
      safety: {
        mode: 'prepare_mainnet',
        submitted: false,
        walletSignature: 'required_before_archive',
      },
      poolEvidence: {
        poolKey: 'SUI_USDC',
        poolAddress: '0xPOOL',
        deepbookPackageId: expect.stringMatching(/^0x/u),
        baseCoin: 'SUI',
        quoteCoin: 'USDC',
      },
    });
    expect(prepared.plan).toMatchObject({
      side: 'sell',
      assetIn: 'SUI',
      assetOut: 'USDC',
      marketLabel: 'SUI/USDC',
    });
  });

  it('builds a sign-only transaction wrapper for eligible SUI/USDC proof paths', () => {
    const prepared = buildPreparedDeepBookPtbTransaction({
      walletAddress: '0xabc',
      recommendation: spotRecommendation,
      marketSnapshot,
    });

    expect(prepared.ptbPlan.summary).toContain('Live DeepBook mainnet swap');
    expect(prepared.preparedPtb).toMatchObject({
      eligible: true,
      safety: {
        mode: 'prepare_mainnet',
        submitted: false,
      },
    });
    expect(prepared.transaction).toBeTruthy();
  });

  it('blocks the sign-only transaction wrapper for unsupported paths', () => {
    expect(() =>
      buildPreparedDeepBookPtbTransaction({
        walletAddress: '0xabc',
        recommendation: {
          ...spotRecommendation,
          deepbookAction: {
            ...spotRecommendation.deepbookAction,
            assetIn: 'DEEP',
            assetOut: 'USDC',
          },
        },
        marketSnapshot,
      }),
    ).toThrow('Only spot SUI/USDC or USDC/SUI');
  });

  it('returns clear ineligibility reasons for Predict and no-trade paths', () => {
    expect(
      buildPreparedDeepBookPtb({
        recommendation: {
          title: 'Predict',
          type: 'deepbook_predict_downside_binary',
          deepbookAction: {
            mode: 'prepare_mainnet',
            kind: 'predict_binary',
            market: 'SUI downside -10% / 7D',
            side: 'buy',
            assetIn: 'USDC',
            assetOut: 'SUI downside cover',
            amountUsd: 5,
            description: 'demo',
          },
        },
        marketSnapshot,
      }).reason,
    ).toContain('DeepBook Predict-style');

    expect(
      buildPreparedDeepBookPtb({
        recommendation: {
          ...spotRecommendation,
          deepbookAction: {
            ...spotRecommendation.deepbookAction,
            market: 'No trade',
            assetIn: 'N/A',
            assetOut: 'N/A',
            amountUsd: 0,
          },
        },
        marketSnapshot,
      }).reason,
    ).toContain('No-trade');
  });

  it('binds signed prepared PTB metadata to signer, policy object, and execution intent', async () => {
    await expect(
      createSignedPreparedPtb({
        bytes: 'AAECAw==',
        signature: 'sig',
        signer: '0xabc',
        policyObjectId: '0xpolicy',
        executionIntentId: 'intent_123',
        signedAt: new Date('2026-06-14T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      bytes: 'AAECAw==',
      signature: 'sig',
      signer: '0xabc',
      policyObjectId: '0xpolicy',
      executionIntentId: 'intent_123',
      signedAt: '2026-06-14T00:00:00.000Z',
      submitted: false,
      bytesDigest: expect.stringMatching(/^ptb_[a-f0-9]{24}$/u),
    });
  });

  it('uses signed PTB digest before legacy execution identifiers for receipts', () => {
    expect(
      executionDigestForReceipt({
        signedPreparedPtb: { bytesDigest: 'ptb_signed' },
        digest: 'prep_old',
        preparedTransactionSummary: 'summary',
        fallbackId: 'audit_id',
      }),
    ).toBe('ptb_signed');

    expect(
      executionDigestForReceipt({
        digest: 'prep_old',
        preparedTransactionSummary: 'summary',
        fallbackId: 'audit_id',
      }),
    ).toBe('prep_old');
  });

  it('carries prepared and signed PTB evidence in the audit package', async () => {
    const preparedPtb = buildPreparedDeepBookPtb({
      recommendation: spotRecommendation,
      marketSnapshot,
    });
    const signedPreparedPtb = await createSignedPreparedPtb({
      bytes: 'AAECAw==',
      signature: 'sig',
      signer: '0xabc',
      policyObjectId: '0xpolicy',
      executionIntentId: 'intent_123',
      signedAt: new Date('2026-06-14T00:00:00.000Z'),
    });
    const policy: ExecutionPolicy = {
      maxBudgetUsd: 10,
      maxSingleTradeUsd: 5,
      allowedAssets: ['SUI', 'USDC'],
      allowedMarkets: ['SUI/USDC'],
      requireManualApproval: true,
      expiresAt: '2026-06-21T00:00:00.000Z',
    };
    const portfolioSnapshot = {
      walletAddress: '0xabc',
      totalUsdValue: 100,
      assets: [],
      exposures: [],
    } as unknown as PortfolioSnapshot;
    const riskReportBefore = {
      overallScore: 50,
      summary: 'demo',
      signals: [],
    } as unknown as RiskReport;

    const auditPackage = createAuditPackage({
      walletAddress: '0xabc',
      portfolioSnapshot,
      riskReportBefore,
      recommendation: {
        id: 'strategy_1',
        summary: 'demo',
        targetRiskSignalIds: [],
        rationale: 'demo',
        applicability: 'demo',
        prepareOnlyReason: 'demo',
        fallback: 'demo',
        constraints: [],
        riskTradeoffs: [],
        displayFacts: [],
        estimatedCostUsd: 5,
        expectedRiskReduction: 10,
        ...spotRecommendation,
      },
      monitorRules: [],
      deepbookMarketEvidence: createDeepBookMarketEvidence({
        snapshot: marketSnapshot,
        walletAddress: '0xabc',
      }),
      policy,
      policyCheck: { ok: true, errors: [] },
      policyObjectId: '0xpolicy',
      aiExplanation: 'demo',
      execution: {
        mode: 'prepare_mainnet',
        status: 'prepared',
        digest: signedPreparedPtb.bytesDigest,
        preparedTransactionSummary: preparedPtb.plan?.summary,
        preparedPtb: { ...preparedPtb, status: 'signed' },
        signedPreparedPtb,
      },
    });

    expect(auditPackage.execution.signedPreparedPtb?.bytesDigest).toBe(signedPreparedPtb.bytesDigest);
    expect(auditPackage.execution.preparedPtb?.poolEvidence?.poolAddress).toBe('0xPOOL');
    expect(auditPackage.execution.digest).toBe(signedPreparedPtb.bytesDigest);
  });
});
