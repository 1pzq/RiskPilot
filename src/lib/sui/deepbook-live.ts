import { deepbook, mainnetCoins, mainnetPackageIds, mainnetPools } from '@mysten/deepbook-v3';
import { Transaction } from '@mysten/sui/transactions';

import type { StrategyRecommendation } from '../strategy/strategy-builder';
import { createMainnetSuiClient } from './client';

export const LIVE_DEEPBOOK_POOL_KEY = 'SUI_USDC';

export type DeepBookLiveMarketSnapshot = {
  poolKey: string;
  poolAddress: string;
  baseCoin: string;
  quoteCoin: string;
  midPrice: number;
  quoteOutForOneBase: number;
  baseOutForOneQuote: number;
  vaultBalances: {
    base: number;
    quote: number;
    deep: number;
  };
  tradeParams: {
    takerFee: number;
    makerFee: number;
    stakeRequired: number;
  };
  registeredPool: boolean;
  whitelisted: boolean;
  fetchedAt: string;
};

export type DeepBookLiveTradePlan = {
  poolKey: string;
  side: 'buy' | 'sell';
  amountIn: number;
  estimatedOut: number;
  minimumOut: number;
  summary: string;
  marketLabel: string;
};

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function createDeepBookClient(walletAddress: string) {
  return createMainnetSuiClient().$extend(
    deepbook({
      address: walletAddress,
      coins: mainnetCoins,
      pools: mainnetPools,
      packageIds: mainnetPackageIds,
    }),
  );
}

export async function fetchDeepBookLiveMarketSnapshot(
  walletAddress: string,
  poolKey: string = LIVE_DEEPBOOK_POOL_KEY,
): Promise<DeepBookLiveMarketSnapshot> {
  const client = createDeepBookClient(walletAddress);
  const pool = mainnetPools[poolKey];
  const sampleBaseQuantity = 10;
  const sampleQuoteQuantity = 10;

  const [midPrice, quoteOutForOneBase, baseOutForOneQuote, vaultBalances, tradeParams, registeredPool, whitelisted] =
    await Promise.all([
      client.deepbook.midPrice(poolKey),
      client.deepbook.getQuoteQuantityOut(poolKey, sampleBaseQuantity),
      client.deepbook.getBaseQuantityOut(poolKey, sampleQuoteQuantity),
      client.deepbook.vaultBalances(poolKey),
      client.deepbook.poolTradeParams(poolKey),
      client.deepbook.registeredPool(poolKey),
      client.deepbook.whitelisted(poolKey),
    ]);

  return {
    poolKey,
    poolAddress: pool.address,
    baseCoin: pool.baseCoin,
    quoteCoin: pool.quoteCoin,
    midPrice,
    quoteOutForOneBase: Number((quoteOutForOneBase.quoteOut / sampleBaseQuantity).toFixed(6)),
    baseOutForOneQuote: Number((baseOutForOneQuote.baseOut / sampleQuoteQuantity).toFixed(6)),
    vaultBalances,
    tradeParams,
    registeredPool,
    whitelisted,
    fetchedAt: new Date().toISOString(),
  };
}

export function buildDeepBookLiveTradePlan(
  recommendation: Pick<StrategyRecommendation, 'deepbookAction' | 'title' | 'type'>,
  marketSnapshot: DeepBookLiveMarketSnapshot,
): DeepBookLiveTradePlan | null {
  if (recommendation.deepbookAction.kind !== 'spot') {
    return null;
  }

  const assetIn = recommendation.deepbookAction.assetIn;
  const assetOut = recommendation.deepbookAction.assetOut;

  if (!((assetIn === 'SUI' && assetOut === 'USDC') || (assetIn === 'USDC' && assetOut === 'SUI'))) {
    return null;
  }

  const side: 'buy' | 'sell' = assetIn === 'SUI' ? 'sell' : 'buy';
  const amountIn = assetIn === 'SUI'
    ? round(recommendation.deepbookAction.amountUsd / marketSnapshot.midPrice, 6)
    : round(recommendation.deepbookAction.amountUsd, 6);
  const estimatedOut = side === 'sell'
    ? round(amountIn * marketSnapshot.quoteOutForOneBase, 6)
    : round(amountIn * marketSnapshot.baseOutForOneQuote, 6);
  const minimumOut = round(Math.max(0, estimatedOut * 0.98), 6);
  const marketLabel = `${marketSnapshot.baseCoin}/${marketSnapshot.quoteCoin}`;
  const summary =
    side === 'sell'
      ? `Live DeepBook mainnet swap: sell ${amountIn.toFixed(4)} ${assetIn} for at least ${minimumOut.toFixed(4)} ${assetOut}.`
      : `Live DeepBook mainnet swap: buy ${minimumOut.toFixed(4)} ${assetOut} with up to ${amountIn.toFixed(4)} ${assetIn}.`;

  return {
    poolKey: marketSnapshot.poolKey,
    side,
    amountIn,
    estimatedOut,
    minimumOut,
    summary,
    marketLabel,
  };
}

export function isLiveDeepBookEligible(
  recommendation: Pick<StrategyRecommendation, 'deepbookAction'>,
): boolean {
  return (
    recommendation.deepbookAction.kind === 'spot' &&
    ((recommendation.deepbookAction.assetIn === 'SUI' && recommendation.deepbookAction.assetOut === 'USDC') ||
      (recommendation.deepbookAction.assetIn === 'USDC' && recommendation.deepbookAction.assetOut === 'SUI'))
  );
}

export function buildDeepBookLiveTransaction(
  walletAddress: string,
  recommendation: Pick<StrategyRecommendation, 'deepbookAction' | 'title' | 'type'>,
  marketSnapshot: DeepBookLiveMarketSnapshot,
) {
  const plan = buildDeepBookLiveTradePlan(recommendation, marketSnapshot);

  if (!plan) {
    throw new Error('Live DeepBook execution is only available for spot SUI/USDC or USDC/SUI swaps in this build.');
  }

  const client = createDeepBookClient(walletAddress);
  const tx = new Transaction();

  if (plan.side === 'sell') {
    const [baseCoinResult, quoteCoinResult, deepCoinResult] = client.deepbook.deepBook.swapExactBaseForQuote({
      poolKey: plan.poolKey,
      amount: plan.amountIn,
      deepAmount: 0,
      minOut: plan.minimumOut,
    })(tx);

    tx.transferObjects(
      [baseCoinResult, quoteCoinResult, deepCoinResult],
      tx.pure.address(walletAddress),
    );
  } else {
    const [baseCoinResult, quoteCoinResult, deepCoinResult] = client.deepbook.deepBook.swapExactQuoteForBase({
      poolKey: plan.poolKey,
      amount: plan.amountIn,
      deepAmount: 0,
      minOut: plan.minimumOut,
    })(tx);

    tx.transferObjects(
      [baseCoinResult, quoteCoinResult, deepCoinResult],
      tx.pure.address(walletAddress),
    );
  }

  return {
    transaction: tx,
    plan,
  };
}
