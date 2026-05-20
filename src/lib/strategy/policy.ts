import type { StrategyRecommendation } from './strategy-builder';

export type ExecutionPolicy = {
  maxBudgetUsd: number;
  maxSingleTradeUsd: number;
  allowedAssets: string[];
  allowedMarkets: string[];
  expiresAt: string;
  requireManualApproval: boolean;
};

export type PolicyCheckResult = {
  ok: boolean;
  errors: string[];
};

export type PolicyInput = {
  maxBudgetUsd: number;
  maxSingleTradeUsd: number;
  allowedAssets: string;
  allowedMarkets: string;
  expiresAt: string;
  requireManualApproval: boolean;
};

function normalizeList(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function splitListInput(value: string): string[] {
  return normalizeList(
    value
      .split(/[,;\n]/g)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function joinListInput(values: string[]): string {
  return values.join(', ');
}

export function createDefaultPolicy(
  recommendation: Pick<StrategyRecommendation, 'estimatedCostUsd' | 'deepbookAction'>,
  now = new Date(),
): ExecutionPolicy {
  const roundedCost = Math.max(1, Math.ceil(recommendation.estimatedCostUsd));

  return {
    maxBudgetUsd: roundedCost,
    maxSingleTradeUsd: roundedCost,
    allowedAssets: [recommendation.deepbookAction.assetIn, recommendation.deepbookAction.assetOut],
    allowedMarkets: [recommendation.deepbookAction.market],
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    requireManualApproval: true,
  };
}

export function policyToInput(policy: ExecutionPolicy): PolicyInput {
  return {
    maxBudgetUsd: policy.maxBudgetUsd,
    maxSingleTradeUsd: policy.maxSingleTradeUsd,
    allowedAssets: joinListInput(policy.allowedAssets),
    allowedMarkets: joinListInput(policy.allowedMarkets),
    expiresAt: policy.expiresAt,
    requireManualApproval: policy.requireManualApproval,
  };
}

export function inputToPolicy(input: PolicyInput): ExecutionPolicy {
  return {
    maxBudgetUsd: Number(input.maxBudgetUsd),
    maxSingleTradeUsd: Number(input.maxSingleTradeUsd),
    allowedAssets: splitListInput(input.allowedAssets),
    allowedMarkets: splitListInput(input.allowedMarkets),
    expiresAt: input.expiresAt,
    requireManualApproval: Boolean(input.requireManualApproval),
  };
}

export function validateExecutionPolicy(
  policy: ExecutionPolicy,
  recommendation: StrategyRecommendation,
  now = new Date(),
): PolicyCheckResult {
  const errors: string[] = [];
  const expiry = new Date(policy.expiresAt);

  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    errors.push('Policy expired. Choose an expiry in the future.');
  }

  if (recommendation.estimatedCostUsd > policy.maxBudgetUsd) {
    errors.push(
      `Estimated cost ${recommendation.estimatedCostUsd.toFixed(2)} exceeds max budget ${policy.maxBudgetUsd.toFixed(2)}.`,
    );
  }

  if (recommendation.deepbookAction.amountUsd > policy.maxSingleTradeUsd) {
    errors.push(
      `Trade size ${recommendation.deepbookAction.amountUsd.toFixed(2)} exceeds max single trade ${policy.maxSingleTradeUsd.toFixed(2)}.`,
    );
  }

  if (!policy.allowedAssets.includes(recommendation.deepbookAction.assetIn)) {
    errors.push(`Asset in ${recommendation.deepbookAction.assetIn} is not allowed.`);
  }

  if (!policy.allowedAssets.includes(recommendation.deepbookAction.assetOut)) {
    errors.push(`Asset out ${recommendation.deepbookAction.assetOut} is not allowed.`);
  }

  if (!policy.allowedMarkets.includes(recommendation.deepbookAction.market)) {
    errors.push(`Market ${recommendation.deepbookAction.market} is not allowed.`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

