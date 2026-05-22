import { describe, expect, it } from 'vitest';

import {
  buildDeepBookLiveTradePlan,
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

  it('does not mark predict strategies as live eligible', () => {
    expect(
      isLiveDeepBookEligible({
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
      }),
    ).toBe(false);
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
});
