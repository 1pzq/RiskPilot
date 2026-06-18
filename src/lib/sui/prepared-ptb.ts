import { canonicalize } from '@/lib/security/canonicalize';
import { sha256Hex } from '@/lib/security/digest';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import type { ExecutionIntent } from '@/lib/security/execution-intent';

import {
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

export type SignedPreparedPtb = {
  bytes: string;
  signature: string;
  bytesDigest: string;
  evidenceKind: 'personal_message';
  messageDigest: string;
  signedAt: string;
  signer: string;
  policyObjectId?: string;
  executionIntentId?: string;
  submitted: false;
};

export type PreparedPtbEvidenceMessage = {
  kind: 'RiskPilotPreparedEvidence';
  walletAddress: string;
  policyObjectId: string;
  executionIntentId: string;
  recommendationDigest: string;
  policyDigest: string;
  market: string;
  side: DeepBookLiveTradePlan['side'];
  assetIn: DeepBookLiveTradePlan['assetIn'];
  assetOut: DeepBookLiveTradePlan['assetOut'];
  plannedAmountIn: number;
  minimumOut: number;
  submitStatus: 'not_submitted';
  warning: 'This is evidence only. It is not a transaction and cannot move funds.';
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
    note: 'Wallet signs an evidence message for authorization proof; RiskPilot does not submit a transaction or move funds.',
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

export function buildPreparedPtbEvidenceMessage(input: {
  walletAddress: string;
  policyObjectId: string;
  executionIntent: ExecutionIntent;
  preparedPtb: PreparedDeepBookPtb;
}): PreparedPtbEvidenceMessage {
  const plan = input.preparedPtb.plan;

  if (!input.preparedPtb.eligible || !plan) {
    throw new Error(input.preparedPtb.reason ?? 'Prepared evidence message is not eligible.');
  }

  return {
    kind: 'RiskPilotPreparedEvidence',
    walletAddress: input.walletAddress,
    policyObjectId: input.policyObjectId,
    executionIntentId: input.executionIntent.executionIntentId,
    recommendationDigest: input.executionIntent.recommendationDigest,
    policyDigest: input.executionIntent.policyDigest,
    market: plan.marketLabel,
    side: plan.side,
    assetIn: plan.assetIn,
    assetOut: plan.assetOut,
    plannedAmountIn: plan.amountIn,
    minimumOut: plan.minimumOut,
    submitStatus: 'not_submitted',
    warning: 'This is evidence only. It is not a transaction and cannot move funds.',
  };
}

export function encodePreparedPtbEvidenceMessage(message: PreparedPtbEvidenceMessage): Uint8Array {
  return new TextEncoder().encode(canonicalize(message));
}

export async function createSignedPreparedPtb(input: {
  bytes: string;
  signature: string;
  signer: string;
  policyObjectId?: string;
  executionIntentId?: string;
  signedAt?: Date;
}): Promise<SignedPreparedPtb> {
  const messageDigest = `msg_${(await sha256Hex(input.bytes)).slice(0, 24)}`;

  return {
    bytes: input.bytes,
    signature: input.signature,
    bytesDigest: `ptb_${messageDigest.slice(4)}`,
    evidenceKind: 'personal_message',
    messageDigest,
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
