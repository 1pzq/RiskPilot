import type { PortfolioSnapshot, RiskReport, RiskSignal, WalletScanSummary } from '@/lib/risk/types';
import type { ExecutionPolicy, PolicyCheckResult } from './policy';
import type { StrategyRecommendation } from './strategy-builder';

export type MonitorRuleSeverity = 'info' | 'medium' | 'high' | 'critical';

export type MonitorRecommendedAction = {
  kind: 'watch' | 'review' | 'audit' | 'prepare';
  label: string;
  description: string;
};

export type MonitorRule = {
  id: string;
  label: string;
  condition: string;
  trigger: string;
  severity: MonitorRuleSeverity;
  sourceRiskSignalId?: string;
  recommendedAction: MonitorRecommendedAction;
  enabled: boolean;
};

export type BuildMonitorRulesInput = {
  portfolio: PortfolioSnapshot;
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyCheck?: PolicyCheckResult;
  walletScan?: WalletScanSummary | null;
  deepbookMarketStatus?: 'idle' | 'loading' | 'ready' | 'error';
  deepbookMarketError?: string | null;
  now?: Date;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatUsd(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

function byCategory(report: RiskReport, category: RiskSignal['category']): RiskSignal | undefined {
  return report.signals.find((signal) => signal.category === category);
}

function byId(report: RiskReport, id: string): RiskSignal | undefined {
  return report.signals.find((signal) => signal.id === id);
}

function severityFromSignal(signal: RiskSignal | undefined): MonitorRuleSeverity {
  if (!signal) {
    return 'info';
  }

  if (signal.level === 'critical') {
    return 'critical';
  }

  if (signal.level === 'high') {
    return 'high';
  }

  if (signal.level === 'medium') {
    return 'medium';
  }

  return 'info';
}

function hoursUntil(value: string, now: Date): number {
  const expiresAt = new Date(value).getTime();

  if (!Number.isFinite(expiresAt)) {
    return Number.NEGATIVE_INFINITY;
  }

  return (expiresAt - now.getTime()) / (60 * 60 * 1000);
}

function buildRuleId(recommendation: StrategyRecommendation, suffix: string): string {
  return `${recommendation.id}-watch-${suffix}`;
}

function buildReviewAction(recommendation: StrategyRecommendation, label: string): MonitorRecommendedAction {
  return {
    kind: 'review',
    label,
    description: `${recommendation.prepareOnlyReason} ${recommendation.fallback}`,
  };
}

function buildPrepareAction(recommendation: StrategyRecommendation, label: string): MonitorRecommendedAction {
  return {
    kind: 'prepare',
    label,
    description: `${recommendation.applicability} ${recommendation.prepareOnlyReason}`,
  };
}

function buildAuditAction(label: string, description: string): MonitorRecommendedAction {
  return {
    kind: 'audit',
    label,
    description,
  };
}

export function buildMonitorRules(input: BuildMonitorRulesInput): MonitorRule[] {
  const {
    portfolio,
    riskReport,
    recommendation,
    policy,
    policyCheck,
    walletScan,
    deepbookMarketStatus = 'idle',
    deepbookMarketError,
    now = new Date(),
  } = input;
  const rules: MonitorRule[] = [];
  const walletReviewOnly = recommendation.type === 'wallet_review';
  const suiSignal = byId(riskReport, 'sui-downside');
  const concentrationSignal = byCategory(riskReport, 'concentration');
  const stablecoinSignal = byCategory(riskReport, 'stablecoin');
  const lendingSignal = byCategory(riskReport, 'liquidation');
  const lpSignal = byCategory(riskReport, 'lp');

  if (!walletReviewOnly && recommendation.targetRiskSignalIds.includes('sui-downside')) {
    const thresholdPct = Math.abs(recommendation.parameters?.deepbookPredict?.thresholdPct ?? -10);
    const expiryDays = recommendation.parameters?.deepbookPredict?.expiryDays;
    rules.push({
      id: buildRuleId(recommendation, `sui-drawdown-${thresholdPct}`),
      label: 'SUI drawdown reaches strategy threshold',
      condition: `SUI-linked exposure remains material for ${portfolio.walletAddress}.`,
      trigger: `Trigger review if SUI is down ${thresholdPct}%${expiryDays ? ` within ${expiryDays}D` : ''}.`,
      severity: severityFromSignal(suiSignal ?? concentrationSignal),
      sourceRiskSignalId: suiSignal?.id ?? concentrationSignal?.id,
      recommendedAction: buildPrepareAction(recommendation, 'Review prepared downside plan'),
      enabled: true,
    });
  }

  const hoursToExpiry = hoursUntil(policy.expiresAt, now);
  const expirySeverity: MonitorRuleSeverity =
    hoursToExpiry <= 0 ? 'critical' : hoursToExpiry <= 6 ? 'high' : hoursToExpiry <= 24 ? 'medium' : 'info';
  rules.push({
    id: buildRuleId(recommendation, 'policy-expiry'),
    label: 'Policy expires soon',
    condition: `Policy expiry is ${policy.expiresAt}.`,
    trigger: 'Trigger review when the policy is inside the final 6 hours or has already expired.',
    severity: expirySeverity,
    recommendedAction: buildReviewAction(recommendation, 'Refresh policy before preparing'),
    enabled: true,
  });

  if (!walletReviewOnly && recommendation.deepbookAction.amountUsd > 0) {
    const exceedsBudget =
      recommendation.estimatedCostUsd > policy.maxBudgetUsd ||
      recommendation.deepbookAction.amountUsd > policy.maxSingleTradeUsd ||
      policyCheck?.errors.some((error) => error.toLowerCase().includes('budget') || error.toLowerCase().includes('trade size')) === true;
    rules.push({
      id: buildRuleId(recommendation, 'budget-cap'),
      label: 'Budget cap would be exceeded',
      condition: `Prepared size is ${formatUsd(recommendation.deepbookAction.amountUsd)} against a ${formatUsd(policy.maxBudgetUsd)} max budget and ${formatUsd(policy.maxSingleTradeUsd)} single-trade cap.`,
      trigger: 'Trigger review if live quotes, user edits, or policy changes push the prepared size above the active caps.',
      severity: exceedsBudget ? 'critical' : 'medium',
      recommendedAction: buildReviewAction(recommendation, 'Reduce size or update policy'),
      enabled: true,
    });
  }

  if (stablecoinSignal) {
    rules.push({
      id: buildRuleId(recommendation, 'stablecoin-concentration'),
      label: 'Stablecoin concentration remains high',
      condition: stablecoinSignal.summary,
      trigger: 'Trigger treasury review if the stablecoin sleeve remains above the concentration threshold.',
      severity: severityFromSignal(stablecoinSignal),
      sourceRiskSignalId: stablecoinSignal.id,
      recommendedAction: walletReviewOnly
        ? buildReviewAction(recommendation, 'Review stablecoin exposure')
        : buildPrepareAction(recommendation, 'Review treasury split plan'),
      enabled: true,
    });
  }

  if (lendingSignal) {
    rules.push({
      id: buildRuleId(recommendation, 'lending-health'),
      label: 'Lending health risk should be reviewed',
      condition: lendingSignal.summary,
      trigger: 'Trigger lending review if health factor remains below the safe review threshold.',
      severity: severityFromSignal(lendingSignal),
      sourceRiskSignalId: lendingSignal.id,
      recommendedAction: buildReviewAction(recommendation, 'Review repay or collateral options'),
      enabled: true,
    });
  }

  if (lpSignal) {
    rules.push({
      id: buildRuleId(recommendation, 'lp-risk'),
      label: 'LP impermanent loss risk remains high',
      condition: lpSignal.summary,
      trigger: 'Trigger LP review if the position remains medium or high impermanent-loss risk.',
      severity: severityFromSignal(lpSignal),
      sourceRiskSignalId: lpSignal.id,
      recommendedAction: buildReviewAction(recommendation, 'Review LP unwind path'),
      enabled: true,
    });
  }

  if (walletScan && walletScan.defiCandidates > 0) {
    rules.push({
      id: `${portfolio.walletAddress}-watch-wallet-defi-candidates`,
      label: 'Wallet scan found DeFi candidate objects',
      condition: `${walletScan.defiCandidates} candidate object${walletScan.defiCandidates === 1 ? '' : 's'} need protocol-specific review.`,
      trigger: 'Trigger manual review when unsupported DeFi objects appear in the wallet scan.',
      severity: 'medium',
      recommendedAction: {
        kind: 'review',
        label: 'Review wallet object scan',
        description: 'This rule is review-only: unsupported or unpriced objects are recorded for audit and cannot create a substitute trade.',
      },
      enabled: true,
    });
  }

  if (deepbookMarketStatus !== 'ready') {
    rules.push({
      id: buildRuleId(recommendation, 'deepbook-market-unavailable'),
      label: 'DeepBook market snapshot unavailable',
      condition: `DeepBook market status is ${deepbookMarketStatus}.`,
      trigger: deepbookMarketError ?? 'Trigger audit note if market evidence is unavailable when preparing the package.',
      severity: deepbookMarketStatus === 'error' ? 'high' : 'info',
      recommendedAction: buildAuditAction(
        'Record market evidence gap',
        'Keep the package prepare-only and archive the missing market snapshot as audit context.',
      ),
      enabled: true,
    });
  }

  if (walletReviewOnly && rules.length === 0) {
    rules.push({
      id: buildRuleId(recommendation, 'wallet-review'),
      label: 'Connected wallet remains review-only',
      condition: 'No priced actionable risk signal is available.',
      trigger: 'Trigger manual review if new priced DeFi positions or supported risk signals appear.',
      severity: 'info',
      recommendedAction: buildAuditAction(
        'Keep audit-only review',
        'No trade is prepared for wallet_review; RiskPilot only records watch context and wallet observations.',
      ),
      enabled: true,
    });
  }

  return rules;
}
