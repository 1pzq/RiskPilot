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
      label: 'SUI 回撤达到策略阈值',
      condition: `${portfolio.walletAddress} 的 SUI 相关敞口仍然显著。`,
      trigger: `如果 SUI 下跌 ${thresholdPct}%${expiryDays ? `（${expiryDays}D 内）` : ''}，触发复核。`,
      severity: severityFromSignal(suiSignal ?? concentrationSignal),
      sourceRiskSignalId: suiSignal?.id ?? concentrationSignal?.id,
      recommendedAction: buildPrepareAction(recommendation, '复核已准备的下行计划'),
      enabled: true,
    });
  }

  const hoursToExpiry = hoursUntil(policy.expiresAt, now);
  const expirySeverity: MonitorRuleSeverity =
    hoursToExpiry <= 0 ? 'critical' : hoursToExpiry <= 6 ? 'high' : hoursToExpiry <= 24 ? 'medium' : 'info';
  rules.push({
    id: buildRuleId(recommendation, 'policy-expiry'),
    label: 'Policy 即将过期',
    condition: `Policy 过期时间为 ${policy.expiresAt}。`,
    trigger: '当 Policy 进入最后 6 小时或已经过期时触发复核。',
    severity: expirySeverity,
    recommendedAction: buildReviewAction(recommendation, 'Prepare 前刷新 Policy'),
    enabled: true,
  });

  if (!walletReviewOnly && recommendation.deepbookAction.amountUsd > 0) {
    const exceedsBudget =
      recommendation.estimatedCostUsd > policy.maxBudgetUsd ||
      recommendation.deepbookAction.amountUsd > policy.maxSingleTradeUsd ||
      policyCheck?.errors.some((error) => error.toLowerCase().includes('budget') || error.toLowerCase().includes('trade size')) === true;
    rules.push({
      id: buildRuleId(recommendation, 'budget-cap'),
      label: '可能超过预算上限',
      condition: `已准备规模为 ${formatUsd(recommendation.deepbookAction.amountUsd)}，当前最大预算为 ${formatUsd(policy.maxBudgetUsd)}，单笔上限为 ${formatUsd(policy.maxSingleTradeUsd)}。`,
      trigger: '如果 Live 报价、用户编辑或 Policy 变更让已准备规模超过当前上限，则触发复核。',
      severity: exceedsBudget ? 'critical' : 'medium',
      recommendedAction: buildReviewAction(recommendation, '降低规模或更新 Policy'),
      enabled: true,
    });
  }

  if (stablecoinSignal) {
    rules.push({
      id: buildRuleId(recommendation, 'stablecoin-concentration'),
      label: 'Stablecoin 集中度仍然偏高',
      condition: stablecoinSignal.summary,
      trigger: '如果 stablecoin 仓位仍高于集中度阈值，触发金库复核。',
      severity: severityFromSignal(stablecoinSignal),
      sourceRiskSignalId: stablecoinSignal.id,
      recommendedAction: walletReviewOnly
        ? buildReviewAction(recommendation, '复核 stablecoin 敞口')
        : buildPrepareAction(recommendation, '复核金库拆分计划'),
      enabled: true,
    });
  }

  if (lendingSignal) {
    rules.push({
      id: buildRuleId(recommendation, 'lending-health'),
      label: '借贷健康风险需要复核',
      condition: lendingSignal.summary,
      trigger: '如果健康因子仍低于安全复核阈值，触发借贷复核。',
      severity: severityFromSignal(lendingSignal),
      sourceRiskSignalId: lendingSignal.id,
      recommendedAction: buildReviewAction(recommendation, '复核还款或抵押品选项'),
      enabled: true,
    });
  }

  if (lpSignal) {
    rules.push({
      id: buildRuleId(recommendation, 'lp-risk'),
      label: 'LP 无常损失风险仍然偏高',
      condition: lpSignal.summary,
      trigger: '如果仓位仍处于中高无常损失风险，触发 LP 复核。',
      severity: severityFromSignal(lpSignal),
      sourceRiskSignalId: lpSignal.id,
      recommendedAction: buildReviewAction(recommendation, '复核 LP 撤出路径'),
      enabled: true,
    });
  }

  if (walletScan && walletScan.defiCandidates > 0) {
    rules.push({
      id: `${portfolio.walletAddress}-watch-wallet-defi-candidates`,
      label: '钱包扫描发现 DeFi 候选对象',
      condition: `${walletScan.defiCandidates} 个候选对象需要协议特定复核。`,
      trigger: '当钱包扫描中出现不支持的 DeFi 对象时，触发人工复核。',
      severity: 'medium',
      recommendedAction: {
        kind: 'review',
        label: '复核钱包对象扫描',
        description: '该规则仅用于复核：不支持或未定价对象会记录为审计证据，不能创建替代交易。',
      },
      enabled: true,
    });
  }

  if (deepbookMarketStatus !== 'ready') {
    rules.push({
      id: buildRuleId(recommendation, 'deepbook-market-unavailable'),
      label: 'DeepBook 市场快照不可用',
      condition: `DeepBook 市场状态为 ${deepbookMarketStatus}。`,
      trigger: deepbookMarketError ?? '如果准备包时市场证据不可用，则触发审计备注。',
      severity: deepbookMarketStatus === 'error' ? 'high' : 'info',
      recommendedAction: buildAuditAction(
        '记录市场证据缺口',
        '保持包为仅 Prepare，并把缺失的市场快照作为审计上下文归档。',
      ),
      enabled: true,
    });
  }

  if (walletReviewOnly && rules.length === 0) {
    rules.push({
      id: buildRuleId(recommendation, 'wallet-review'),
      label: '已连接钱包保持仅复核',
      condition: '没有可用的已定价可执行风险信号。',
      trigger: '如果出现新的已定价 DeFi 仓位或受支持风险信号，则触发人工复核。',
      severity: 'info',
      recommendedAction: buildAuditAction(
        '保持仅审计复核',
        'wallet_review 不准备交易；RiskPilot 只记录观察上下文和钱包观测。',
      ),
      enabled: true,
    });
  }

  return rules;
}
