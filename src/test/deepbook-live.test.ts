import { describe, expect, it } from 'vitest';

import {
  buildDeepBookLiveTradePlan,
  buildLiveDeepBookFailureWarning,
  getDeepBookLiveGate,
  isLiveDeepBookEligible,
  type DeepBookLiveMarketSnapshot,
} from '../lib/sui/deepbook-live';

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
  fetchedAt: '2026-05-21T00:00:00.000Z',
};

describe('DeepBook live helper', () => {
  it('marks spot SUI/USDC strategies as live eligible', () => {
    expect(
      isLiveDeepBookEligible({
        deepbookAction: {
          mode: 'prepare_mainnet',
          kind: 'spot',
          market: 'SUI/USDC',
          side: 'sell',
          assetIn: 'SUI',
          assetOut: 'USDC',
          amountUsd: 5,
          description: 'demo',
        },
      }),
    ).toBe(true);
  });

  it('requires every explicit opt-in gate before entering the mainnet path', () => {
    const recommendation = {
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
    };

    expect(
      getDeepBookLiveGate({
        accountAddress: '0xabc',
        recommendation,
        policyOk: true,
        selectedExecutionMode: 'mainnet',
        marketSnapshot,
        marketStatus: 'ready',
      }),
    ).toMatchObject({
      eligible: true,
      canSubmitLive: true,
      hasWallet: true,
      policyOk: true,
      marketReady: true,
      userSelectedLive: true,
    });

    expect(
      getDeepBookLiveGate({
        accountAddress: '0xabc',
        recommendation,
        policyOk: true,
        selectedExecutionMode: 'prepare_mainnet',
        marketSnapshot,
        marketStatus: 'ready',
      }),
    ).toMatchObject({
      eligible: true,
      canSubmitLive: false,
      userSelectedLive: false,
    });
  });

  it('does not mark predict strategies as live eligible', () => {
    const recommendation = {
      deepbookAction: {
        mode: 'prepare_mainnet' as const,
        kind: 'predict_binary' as const,
        market: 'SUI downside -10% / 7D',
        side: 'buy' as const,
        assetIn: 'USDC',
        assetOut: 'SUI downside cover',
        amountUsd: 5,
        description: 'demo',
      },
    };

    expect(isLiveDeepBookEligible(recommendation)).toBe(false);
    expect(
      getDeepBookLiveGate({
        accountAddress: '0xabc',
        recommendation,
        policyOk: true,
        selectedExecutionMode: 'mainnet',
        marketSnapshot,
        marketStatus: 'ready',
      }).canSubmitLive,
    ).toBe(false);
  });

  it('does not allow wallet review or zero-size no-trade actions into live execution', () => {
    const walletReviewRecommendation = {
      deepbookAction: {
        mode: 'prepare_mainnet' as const,
        kind: 'spot' as const,
        market: 'No trade',
        side: 'sell' as const,
        assetIn: 'N/A',
        assetOut: 'N/A',
        amountUsd: 0,
        description: 'review only',
      },
    };

    const gate = getDeepBookLiveGate({
      accountAddress: '0xabc',
      recommendation: walletReviewRecommendation,
      policyOk: true,
      selectedExecutionMode: 'mainnet',
      marketSnapshot,
      marketStatus: 'ready',
    });

    expect(isLiveDeepBookEligible(walletReviewRecommendation)).toBe(false);
    expect(gate.canSubmitLive).toBe(false);
    expect(gate.reasons).toEqual(
      expect.arrayContaining([
        'Live execution only supports spot SUI/USDC or USDC/SUI.',
        'Live execution requires a positive trade amount.',
      ]),
    );
  });

  it('builds a sell plan from the live mainnet pool snapshot', () => {
    const plan = buildDeepBookLiveTradePlan(
      {
        title: 'Protect SUI downside',
        type: 'sui_downside_protection',
        deepbookAction: {
          mode: 'prepare_mainnet',
          kind: 'spot',
          market: 'SUI/USDC',
          side: 'sell',
          assetIn: 'SUI',
          assetOut: 'USDC',
          amountUsd: 5,
          description: 'demo',
        },
      },
      marketSnapshot,
    );

    expect(plan).not.toBeNull();
    expect(plan?.poolKey).toBe('SUI_USDC');
    expect(plan?.side).toBe('sell');
    expect(plan?.amountIn).toBeCloseTo(1.538462, 5);
    expect(plan?.estimatedOut).toBeCloseTo(4.923076, 5);
    expect(plan?.minimumOut).toBeCloseTo(4.824615, 5);
    expect(plan?.slippagePct).toBe(2);
    expect(plan?.summary).toContain('Live DeepBook mainnet swap');
  });

  it('builds a buy plan from the live mainnet pool snapshot', () => {
    const plan = buildDeepBookLiveTradePlan(
      {
        title: 'Split stablecoin sleeve',
        type: 'stablecoin_split',
        deepbookAction: {
          mode: 'prepare_mainnet',
          kind: 'spot',
          market: 'USDC/SUI',
          side: 'buy',
          assetIn: 'USDC',
          assetOut: 'SUI',
          amountUsd: 5,
          description: 'demo',
        },
      },
      marketSnapshot,
    );

    expect(plan).not.toBeNull();
    expect(plan?.side).toBe('buy');
    expect(plan?.amountIn).toBe(5);
    expect(plan?.estimatedOut).toBeCloseTo(1.53846, 4);
    expect(plan?.minimumOut).toBeCloseTo(1.50769, 4);
  });

  it('builds a clear warning for live execution failure fallback', () => {
    expect(buildLiveDeepBookFailureWarning(new Error('User rejected request'))).toContain(
      'prepare-only fallback',
    );
    expect(buildLiveDeepBookFailureWarning(new Error('User rejected request'))).toContain(
      'User rejected request',
    );
  });
});
