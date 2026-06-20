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
    return 'the current portfolio is low risk under deterministic rules';
  }
  return `the main concerns are ${names.join(', ')}`;
}

export function buildMockExplanation(
  portfolio: PortfolioSnapshot,
  riskReport: RiskReport,
  recommendation: StrategyRecommendation,
  policy: ExecutionPolicy,
): string {
  const text = [
    `RiskPilot sees ${buildSignalPhrase(riskReport)} with $${portfolio.totalUsdValue.toFixed(2)} tracked value.`,
    `The current recommendation is ${recommendation.title.toLowerCase()} with a $${recommendation.estimatedCostUsd.toFixed(2)} budget cap.`,
    `This is a prepare-only mainnet plan for ${recommendation.deepbookAction.market}, so funds are not submitted by default.`,
    `Your Policy constrains this action to allowed assets, allowed markets, and an expiry window ending ${new Date(policy.expiresAt).toLocaleString('en-US')}.`,
    'This is not investment advice and does not guarantee returns or protection.',
  ].join(' ');

  return limitWords(text, 180);
}
