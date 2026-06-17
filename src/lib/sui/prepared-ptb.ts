import { sha256Hex } from '@/lib/security/digest';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';

import {
  buildDeepBookLiveTransaction,
  buildDeepBookLiveTradePlan,
  isSupportedLiveSpotPair,
  MAINNET_DEEPBOOK_PACKAGE_ID,
  type DeepBookLiveMarketSnapshot,
  type DeepBookLiveTradePlan,
} from './deepbook-live';

export type PreparedPtbStatus = 'built' | 'not_eligible' | 'signed';

export type PreparedDeepBookPtb = {
  status: PreparedPtbStatus;
  eligible: boolean;
  reason?: string;
  plan?: DeepBookLiveTradePlan;
  poolEvidence?: {
    poolKey: string;
    poolAddress: string;
    deepbookPackageId: string;
    baseCoin: string;
    quoteCoin: string;
    midPrice: number;
    registeredPool: boolean;
    whitelisted: boolean;
    fetchedAt: string;
  };
  safety: {
    mode: 'prepare_mainnet';
    submitted: false;
    walletSignature: 'required_before_archive';
    note: string;
  };
};

export type PreparedDeepBookPtbTransaction = {
  transaction: ReturnType<typeof buildDeepBookLiveTransaction>['transaction'];
  ptbPlan: DeepBookLiveTradePlan;
  preparedPtb: PreparedDeepBookPtb;
};

export type SignedPreparedPtb = {
  bytes: string;
  signature: string;
  bytesDigest: string;
  signedAt: string;
  signer: string;
  policyObjectId?: string;
  executionIntentId?: string;
  submitted: false;
};

export function getPreparedPtbIneligibilityReason(
  recommendation: Pick<StrategyRecommendation, 'deepbookAction'>,
  marketSnapshot: DeepBookLiveMarketSnapshot | null,
): string | null {
  const action = recommendation.deepbookAction;

  if (action.kind !== 'spot') {
    return 'DeepBook Predict-style actions are policy terms in this demo; only spot SUI/USDC can build a concrete PTB.';
  }

  if (action.market === 'No trade' || action.amountUsd <= 0) {
    return 'No-trade wallet review has no DeepBook PTB to build.';
  }

  if (!isSupportedLiveSpotPair(recommendation)) {
    return `Only spot SUI/USDC or USDC/SUI can build a concrete DeepBook PTB; received ${action.assetIn}/${action.assetOut}.`;
  }

  if (!marketSnapshot) {
    return 'DeepBook market snapshot is required before building the prepared PTB.';
  }

  return null;
}

export function buildPreparedDeepBookPtb(input: {
  recommendation: Pick<StrategyRecommendation, 'deepbookAction' | 'title' | 'type'>;
  marketSnapshot: DeepBookLiveMarketSnapshot | null;
}): PreparedDeepBookPtb {
  const reason = getPreparedPtbIneligibilityReason(input.recommendation, input.marketSnapshot);
  const safety = {
    mode: 'prepare_mainnet' as const,
    submitted: false as const,
    walletSignature: 'required_before_archive' as const,
    note: 'Wallet signs the prepared PTB bytes for authorization evidence; RiskPilot does not submit this transaction.',
  };

  if (reason || !input.marketSnapshot) {
    return {
      status: 'not_eligible',
      eligible: false,
      reason: reason ?? 'DeepBook market snapshot is required before building the prepared PTB.',
      safety,
    };
  }

  const plan = buildDeepBookLiveTradePlan(input.recommendation, input.marketSnapshot);

  if (!plan) {
    return {
      status: 'not_eligible',
      eligible: false,
      reason: 'This recommendation cannot be represented as a supported DeepBook spot PTB.',
      safety,
    };
  }

  return {
    status: 'built',
    eligible: true,
    plan,
    poolEvidence: {
      poolKey: input.marketSnapshot.poolKey,
      poolAddress: input.marketSnapshot.poolAddress,
      deepbookPackageId: MAINNET_DEEPBOOK_PACKAGE_ID,
      baseCoin: input.marketSnapshot.baseCoin,
      quoteCoin: input.marketSnapshot.quoteCoin,
      midPrice: input.marketSnapshot.midPrice,
      registeredPool: input.marketSnapshot.registeredPool,
      whitelisted: input.marketSnapshot.whitelisted,
      fetchedAt: input.marketSnapshot.fetchedAt,
    },
    safety,
  };
}

export function buildPreparedDeepBookPtbTransaction(input: {
  walletAddress: string;
  recommendation: Pick<StrategyRecommendation, 'deepbookAction' | 'title' | 'type'>;
  marketSnapshot: DeepBookLiveMarketSnapshot | null;
}): PreparedDeepBookPtbTransaction {
  const preparedPtb = buildPreparedDeepBookPtb({
    recommendation: input.recommendation,
    marketSnapshot: input.marketSnapshot,
  });

  if (!preparedPtb.eligible || !preparedPtb.plan || !input.marketSnapshot) {
    throw new Error(preparedPtb.reason ?? 'Prepared DeepBook Spot PTB is not eligible.');
  }

  const liveTransaction = buildDeepBookLiveTransaction(
    input.walletAddress,
    input.recommendation,
    input.marketSnapshot,
  );

  return {
    transaction: liveTransaction.transaction,
    ptbPlan: liveTransaction.plan,
    preparedPtb,
  };
}

export async function createSignedPreparedPtb(input: {
  bytes: string;
  signature: string;
  signer: string;
  policyObjectId?: string;
  executionIntentId?: string;
  signedAt?: Date;
}): Promise<SignedPreparedPtb> {
  return {
    bytes: input.bytes,
    signature: input.signature,
    bytesDigest: `ptb_${(await sha256Hex(input.bytes)).slice(0, 24)}`,
    signedAt: (input.signedAt ?? new Date()).toISOString(),
    signer: input.signer,
    policyObjectId: input.policyObjectId,
    executionIntentId: input.executionIntentId,
    submitted: false,
  };
}

export function executionDigestForReceipt(input: {
  signedPreparedPtb?: Pick<SignedPreparedPtb, 'bytesDigest'>;
  digest?: string;
  preparedTransactionSummary?: string;
  fallbackId: string;
}): string {
  return (
    input.signedPreparedPtb?.bytesDigest ??
    input.digest ??
    input.preparedTransactionSummary ??
    input.fallbackId
  );
}
