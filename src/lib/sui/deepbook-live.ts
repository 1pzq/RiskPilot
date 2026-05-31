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
  assetIn: 'SUI' | 'USDC';
  assetOut: 'SUI' | 'USDC';
  amountIn: number;
  estimatedOut: number;
  minimumOut: number;
  slippagePct: number;
  summary: string;
  marketLabel: string;
};

export type DeepBookLiveGate = {
  hasWallet: boolean;
  isSpotAction: boolean;
  isSupportedPair: boolean;
  hasPositiveAmount: boolean;
  policyOk: boolean;
  marketReady: boolean;
  userSelectedLive: boolean;
  featureEnabled: boolean;
  eligible: boolean;
  canSubmitLive: boolean;
  reasons: string[];
};

export type DeepBookLiveGateInput = {
  accountAddress?: string | null;
  recommendation: Pick<StrategyRecommendation, 'deepbookAction'>;
  policyOk: boolean;
  selectedExecutionMode: 'simulation' | 'prepare_mainnet' | 'mainnet';
  marketSnapshot: DeepBookLiveMarketSnapshot | null;
  marketStatus?: 'idle' | 'loading' | 'ready' | 'error';
  featureEnabled?: boolean;
};

export function isSupportedLiveSpotPair(
  recommendation: Pick<StrategyRecommendation, 'deepbookAction'>,
): boolean {
  const { assetIn, assetOut } = recommendation.deepbookAction;

  return (
    (assetIn === 'SUI' && assetOut === 'USDC') ||
    (assetIn === 'USDC' && assetOut === 'SUI')
  );
}

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
  if (!isLiveDeepBookEligible(recommendation)) {
    return null;
  }

  const assetIn = recommendation.deepbookAction.assetIn as 'SUI' | 'USDC';
  const assetOut = recommendation.deepbookAction.assetOut as 'SUI' | 'USDC';

  const side: 'buy' | 'sell' = assetIn === 'SUI' ? 'sell' : 'buy';
  const amountIn = assetIn === 'SUI'
    ? round(recommendation.deepbookAction.amountUsd / marketSnapshot.midPrice, 6)
    : round(recommendation.deepbookAction.amountUsd, 6);
  const estimatedOut = side === 'sell'
    ? round(amountIn * marketSnapshot.quoteOutForOneBase, 6)
    : round(amountIn * marketSnapshot.baseOutForOneQuote, 6);
  const slippagePct = 2;
  const minimumOut = round(Math.max(0, estimatedOut * (1 - slippagePct / 100)), 6);
  const marketLabel = `${marketSnapshot.baseCoin}/${marketSnapshot.quoteCoin}`;
  const summary =
    side === 'sell'
      ? `Live DeepBook mainnet swap: sell ${amountIn.toFixed(4)} ${assetIn} for at least ${minimumOut.toFixed(4)} ${assetOut}.`
      : `Live DeepBook mainnet swap: buy ${minimumOut.toFixed(4)} ${assetOut} with up to ${amountIn.toFixed(4)} ${assetIn}.`;

  return {
    poolKey: marketSnapshot.poolKey,
    side,
    assetIn,
    assetOut,
    amountIn,
    estimatedOut,
    minimumOut,
    slippagePct,
    summary,
    marketLabel,
  };
}

export function isLiveDeepBookEligible(
  recommendation: Pick<StrategyRecommendation, 'deepbookAction'>,
): boolean {
  return (
    recommendation.deepbookAction.kind === 'spot' &&
    recommendation.deepbookAction.amountUsd > 0 &&
    isSupportedLiveSpotPair(recommendation)
  );
}

export function getDeepBookLiveGate(input: DeepBookLiveGateInput): DeepBookLiveGate {
  const hasWallet = Boolean(input.accountAddress);
  const isSpotAction = input.recommendation.deepbookAction.kind === 'spot';
  const isSupportedPair = isSupportedLiveSpotPair(input.recommendation);
  const hasPositiveAmount = input.recommendation.deepbookAction.amountUsd > 0;
  const policyOk = input.policyOk;
  const marketReady = input.marketStatus === 'ready' && Boolean(input.marketSnapshot);
  const userSelectedLive = input.selectedExecutionMode === 'mainnet';
  const featureEnabled = input.featureEnabled ?? true;
  const reasons: string[] = [];

  if (!featureEnabled) {
    reasons.push('Live DeepBook execution is disabled by configuration.');
  }

  if (!hasWallet) {
    reasons.push('Connect a Sui mainnet wallet.');
  }

  if (!isSpotAction) {
    reasons.push('DeepBook Predict remains prepare-only in this demo.');
  }

  if (!isSupportedPair) {
    reasons.push('Live execution only supports spot SUI/USDC or USDC/SUI.');
  }

  if (!hasPositiveAmount) {
    reasons.push('Live execution requires a positive trade amount.');
  }

  if (!policyOk) {
    reasons.push('Policy checks must pass before live execution.');
  }

  if (!marketReady) {
    reasons.push('DeepBook market snapshot must be ready.');
  }

  if (!userSelectedLive) {
    reasons.push('Select live mainnet explicitly.');
  }

  const eligible =
    featureEnabled &&
    hasWallet &&
    isSpotAction &&
    isSupportedPair &&
    hasPositiveAmount &&
    policyOk &&
    marketReady;

  return {
    hasWallet,
    isSpotAction,
    isSupportedPair,
    hasPositiveAmount,
    policyOk,
    marketReady,
    userSelectedLive,
    featureEnabled,
    eligible,
    canSubmitLive: eligible && userSelectedLive,
    reasons,
  };
}

export function buildLiveDeepBookFailureWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Wallet signing or Sui execution failed.';

  return `Live DeepBook Spot submission failed or was rejected. RiskPilot stopped before Walrus archive; choose Prepare mainnet and confirm again to archive a prepare-only fallback: ${message}`;
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
