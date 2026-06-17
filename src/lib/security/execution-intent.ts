import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { canonicalize } from './canonicalize';
import { digestCanonicalJson, sha256Hex } from './digest';

export type ExecutionIntentSource = 'base_wallet' | 'local_sample';

export type ExecutionIntent = {
  executionIntentId: string;
  portfolioDigest: string;
  riskReportDigest: string;
  recommendationDigest: string;
  policyDigest: string;
  policyObjectId?: string;
  intentCreatedAt: string;
  intentExpiresAt: string;
  intentSource: ExecutionIntentSource;
};

export type ExecutionIntentInput = {
  portfolioSnapshot: PortfolioSnapshot;
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyObjectId?: string;
  source: ExecutionIntentSource;
  now?: Date;
  ttlMs?: number;
};

export type ExecutionIntentVerificationInput = {
  intent?: ExecutionIntent | null;
  portfolioSnapshot?: PortfolioSnapshot;
  riskReport?: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  now?: Date;
  rejectLocalSample?: boolean;
};

const DEFAULT_INTENT_TTL_MS = 30 * 60 * 1000;

async function buildIntentId(input: Omit<ExecutionIntent, 'executionIntentId'>): Promise<string> {
  const digest = await sha256Hex(canonicalize(input));
  return `intent_${digest.slice(0, 18)}`;
}

export async function createExecutionIntent(input: ExecutionIntentInput): Promise<ExecutionIntent> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_INTENT_TTL_MS;
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const intentWithoutId = {
    portfolioDigest: await digestCanonicalJson(input.portfolioSnapshot),
    riskReportDigest: await digestCanonicalJson(input.riskReport),
    recommendationDigest: await digestCanonicalJson(input.recommendation),
    policyDigest: await digestCanonicalJson(input.policy),
    policyObjectId: input.policyObjectId,
    intentCreatedAt: createdAt,
    intentExpiresAt: expiresAt,
    intentSource: input.source,
  };

  return {
    executionIntentId: await buildIntentId(intentWithoutId),
    ...intentWithoutId,
  };
}

export async function verifyExecutionIntent(
  input: ExecutionIntentVerificationInput,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const intent = input.intent;

  if (!intent) {
    return {
      ok: false,
      errors: ['Execution intent is required for prepared execution.'],
    };
  }

  const expiry = new Date(intent.intentExpiresAt);
  const createdAt = new Date(intent.intentCreatedAt);
  const now = input.now ?? new Date();

  if (Number.isNaN(createdAt.getTime())) {
    errors.push('Execution intent created timestamp is invalid.');
  }

  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    errors.push('Execution intent expired.');
  }

  if (input.rejectLocalSample && intent.intentSource === 'local_sample') {
    errors.push('Local sample intent cannot authorize connected-wallet execution.');
  }

  if (!input.portfolioSnapshot) {
    errors.push('Execution intent portfolio snapshot is required for digest verification.');
  }

  if (!input.riskReport) {
    errors.push('Execution intent risk report is required for digest verification.');
  }

  const [recommendationDigest, policyDigest, portfolioDigest, riskReportDigest] = await Promise.all([
    digestCanonicalJson(input.recommendation),
    digestCanonicalJson(input.policy),
    input.portfolioSnapshot ? digestCanonicalJson(input.portfolioSnapshot) : Promise.resolve('missing'),
    input.riskReport ? digestCanonicalJson(input.riskReport) : Promise.resolve('missing'),
  ]);

  if (recommendationDigest !== intent.recommendationDigest) {
    errors.push('Execution intent recommendation digest mismatch.');
  }

  if (policyDigest !== intent.policyDigest) {
    errors.push('Execution intent policy digest mismatch.');
  }

  if (portfolioDigest !== intent.portfolioDigest) {
    errors.push('Execution intent portfolio digest mismatch.');
  }

  if (riskReportDigest !== intent.riskReportDigest) {
    errors.push('Execution intent risk report digest mismatch.');
  }

  const { executionIntentId, ...intentWithoutId } = intent;
  const expectedIntentId = await buildIntentId(intentWithoutId);

  if (executionIntentId !== expectedIntentId) {
    errors.push('Execution intent id is not bound to the recorded digest fields.');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
