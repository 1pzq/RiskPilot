import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import type { ExecutionPolicy } from '@/lib/strategy/policy';

function limitWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(' ')}.`;
}

function buildSignalPhrase(report: RiskReport): string {
  const names = report.signals.slice(0, 3).map((signal) => signal.title.toLowerCase());
  if (names.length === 0) {
    return '根据确定性规则，当前 Portfolio 风险较低';
  }
  return `主要关注点是 ${names.join(', ')}`;
}

export function buildMockExplanation(
  portfolio: PortfolioSnapshot,
  riskReport: RiskReport,
  recommendation: StrategyRecommendation,
  policy: ExecutionPolicy,
): string {
  const text = [
    `RiskPilot 看到 ${buildSignalPhrase(riskReport)}，跟踪价值为 $${portfolio.totalUsdValue.toFixed(2)}。`,
    `当前推荐是 ${recommendation.title.toLowerCase()}，预算上限为 $${recommendation.estimatedCostUsd.toFixed(2)}。`,
    `这是一个针对 ${recommendation.deepbookAction.market} 的仅 Prepare mainnet 计划，因此默认不会提交资金。`,
    `你的 Policy 将此交易限制在允许资产、允许市场以及截至 ${new Date(policy.expiresAt).toLocaleString('zh-CN')} 的过期窗口内。`,
    '这不是投资建议，也不保证收益或保护。',
  ].join(' ');

  return limitWords(text, 180);
}
