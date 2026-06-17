import type { SuiObjectChange } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';

import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';

export const AGENT_POLICY_PACKAGE_ID =
  process.env.NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID?.trim() ||
  process.env.NEXT_PUBLIC_RECEIPT_PACKAGE_ID?.trim() ||
  '';

export type AgentPolicyObjectStatus = 'not_minted' | 'minted' | 'selected' | 'revoked' | 'expired' | 'mismatch';

export type AgentPolicyObject = {
  objectId: string;
  owner?: string;
  packageId: string;
  allowedMarkets: string[];
  allowedAssets: string[];
  maxBudgetUsd: number;
  maxSingleTradeUsd: number;
  expiresAt: string;
  requireManualApproval: boolean;
  revoked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  source: 'wallet_mint' | 'manual_selection' | 'archive_history';
};

export type AgentPolicyObjectCheck = PolicyCheckResult & {
  status: AgentPolicyObjectStatus;
};

type BuildAgentPolicyTransactionInput = {
  policy: ExecutionPolicy;
  packageId?: string;
};

type BuildPolicyReceiptTransactionInput = {
  policyObjectId: string;
  strategyId: string;
  auditBlobId: string;
  executionDigest: string;
  packageId?: string;
};

const USD_MICROS = 1_000_000;

function usdToMicros(value: number): bigint {
  return BigInt(Math.max(0, Math.round(value * USD_MICROS)));
}

function dateToMs(value: string): bigint {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error('Policy expiry timestamp is invalid.');
  }

  return BigInt(timestamp);
}

function requirePackageId(packageId: string): string {
  if (!packageId) {
    throw new Error('NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID or NEXT_PUBLIC_RECEIPT_PACKAGE_ID is not configured.');
  }

  return packageId;
}

function pureStringVector(tx: Transaction, values: string[]) {
  return tx.pure.vector('string', values);
}

export function buildCreateAgentPolicyTransaction({
  policy,
  packageId = AGENT_POLICY_PACKAGE_ID,
}: BuildAgentPolicyTransactionInput) {
  const resolvedPackageId = requirePackageId(packageId);
  const tx = new Transaction();

  tx.moveCall({
    target: `${resolvedPackageId}::agent_policy::create_policy`,
    arguments: [
      pureStringVector(tx, policy.allowedMarkets),
      pureStringVector(tx, policy.allowedAssets),
      tx.pure.u64(usdToMicros(policy.maxBudgetUsd)),
      tx.pure.u64(usdToMicros(policy.maxSingleTradeUsd)),
      tx.pure.u64(dateToMs(policy.expiresAt)),
      tx.pure.bool(policy.requireManualApproval),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function buildUpdateAgentPolicyTransaction({
  policyObjectId,
  policy,
  packageId = AGENT_POLICY_PACKAGE_ID,
}: BuildAgentPolicyTransactionInput & { policyObjectId: string }) {
  const resolvedPackageId = requirePackageId(packageId);
  const tx = new Transaction();

  tx.moveCall({
    target: `${resolvedPackageId}::agent_policy::update_policy`,
    arguments: [
      tx.object(policyObjectId),
      pureStringVector(tx, policy.allowedMarkets),
      pureStringVector(tx, policy.allowedAssets),
      tx.pure.u64(usdToMicros(policy.maxBudgetUsd)),
      tx.pure.u64(usdToMicros(policy.maxSingleTradeUsd)),
      tx.pure.u64(dateToMs(policy.expiresAt)),
      tx.pure.bool(policy.requireManualApproval),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function buildRevokeAgentPolicyTransaction({
  policyObjectId,
  packageId = AGENT_POLICY_PACKAGE_ID,
}: {
  policyObjectId: string;
  packageId?: string;
}) {
  const resolvedPackageId = requirePackageId(packageId);
  const tx = new Transaction();

  tx.moveCall({
    target: `${resolvedPackageId}::agent_policy::revoke_policy`,
    arguments: [tx.object(policyObjectId), tx.object(SUI_CLOCK_OBJECT_ID)],
  });

  return tx;
}

export function buildRecordPolicyReceiptTransaction({
  policyObjectId,
  strategyId,
  auditBlobId,
  executionDigest,
  packageId = AGENT_POLICY_PACKAGE_ID,
}: BuildPolicyReceiptTransactionInput) {
  const resolvedPackageId = requirePackageId(packageId);
  const tx = new Transaction();

  tx.moveCall({
    target: `${resolvedPackageId}::agent_policy::record_strategy_receipt`,
    arguments: [
      tx.object(policyObjectId),
      tx.pure.string(strategyId),
      tx.pure.string(auditBlobId),
      tx.pure.string(executionDigest),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function extractAgentPolicyObjectId(
  objectChanges: SuiObjectChange[] | null | undefined,
  packageId = AGENT_POLICY_PACKAGE_ID,
) {
  const expectedType = packageId ? `${packageId}::agent_policy::AgentPolicy` : '';
  const createdPolicy = objectChanges?.find((change) => {
    if (change.type !== 'created') {
      return false;
    }

    return expectedType ? change.objectType === expectedType : change.objectType.endsWith('::agent_policy::AgentPolicy');
  });

  return createdPolicy?.type === 'created' ? createdPolicy.objectId : undefined;
}

export function buildAgentPolicyObjectFromPolicy(input: {
  objectId: string;
  policy: ExecutionPolicy;
  owner?: string;
  packageId?: string;
  source?: AgentPolicyObject['source'];
}): AgentPolicyObject {
  return {
    objectId: input.objectId,
    owner: input.owner,
    packageId: input.packageId ?? AGENT_POLICY_PACKAGE_ID,
    allowedMarkets: input.policy.allowedMarkets,
    allowedAssets: input.policy.allowedAssets,
    maxBudgetUsd: input.policy.maxBudgetUsd,
    maxSingleTradeUsd: input.policy.maxSingleTradeUsd,
    expiresAt: input.policy.expiresAt,
    requireManualApproval: input.policy.requireManualApproval,
    revoked: false,
    source: input.source ?? 'wallet_mint',
  };
}

export function validateAgentPolicyObject(
  policyObject: AgentPolicyObject | null,
  policy: ExecutionPolicy,
  recommendation: StrategyRecommendation,
  now = new Date(),
): AgentPolicyObjectCheck {
  const errors: string[] = [];

  if (!policyObject) {
    return {
      ok: false,
      status: 'not_minted',
      errors: ['Mint or select a Sui AgentPolicy object before treating this as on-chain delegated authority.'],
    };
  }

  if (policyObject.revoked) {
    errors.push('Selected AgentPolicy object is revoked.');
  }

  const expiry = new Date(policyObject.expiresAt);

  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    errors.push('Selected AgentPolicy object is expired.');
  }

  if (recommendation.estimatedCostUsd > policyObject.maxBudgetUsd) {
    errors.push('Recommendation exceeds selected AgentPolicy budget.');
  }

  if (recommendation.deepbookAction.amountUsd > policyObject.maxSingleTradeUsd) {
    errors.push('Recommendation exceeds selected AgentPolicy single trade cap.');
  }

  if (!policyObject.allowedAssets.includes(recommendation.deepbookAction.assetIn)) {
    errors.push(`AgentPolicy does not allow asset in ${recommendation.deepbookAction.assetIn}.`);
  }

  if (!policyObject.allowedAssets.includes(recommendation.deepbookAction.assetOut)) {
    errors.push(`AgentPolicy does not allow asset out ${recommendation.deepbookAction.assetOut}.`);
  }

  if (!policyObject.allowedMarkets.includes(recommendation.deepbookAction.market)) {
    errors.push(`AgentPolicy does not allow market ${recommendation.deepbookAction.market}.`);
  }

  if (policyObject.maxBudgetUsd !== policy.maxBudgetUsd || policyObject.maxSingleTradeUsd !== policy.maxSingleTradeUsd) {
    errors.push('Selected AgentPolicy budget no longer matches the app policy editor.');
  }

  const status: AgentPolicyObjectStatus = policyObject.revoked
    ? 'revoked'
    : errors.some((error) => error.toLowerCase().includes('expired'))
      ? 'expired'
      : errors.length > 0
        ? 'mismatch'
        : policyObject.source === 'manual_selection'
          ? 'selected'
          : 'minted';

  return {
    ok: errors.length === 0,
    status,
    errors,
  };
}
