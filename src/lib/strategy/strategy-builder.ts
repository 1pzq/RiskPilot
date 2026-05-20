import type { PortfolioSnapshot, RiskReport, RiskSignal } from '@/lib/risk/types';
import type { ExecutionPolicy } from './policy';

export type StrategyType =
  | 'deepbook_predict_downside_binary'
  | 'sui_downside_protection'
  | 'rebalance_concentration'
  | 'stablecoin_split'
  | 'lending_deleverage'
  | 'lp_risk_reduction';

export type DeepBookPredictSettings = {
  thresholdPct: -10 | -15 | -20;
  expiryDays: 1 | 7 | 14;
  budgetUsd: number;
};

export type StrategyRecommendation = {
  id: string;
  type: StrategyType;
  title: string;
  summary: string;
  targetRiskSignalIds: string[];
  estimatedCostUsd: number;
  expectedRiskReduction: number;
  deepbookAction: {
    mode: 'simulate' | 'prepare_mainnet' | 'mainnet';
    kind: 'spot' | 'predict_binary';
    market: string;
    side: 'buy' | 'sell';
    assetIn: string;
    assetOut: string;
    amountUsd: number;
    description: string;
  };
  parameters?: {
    deepbookPredict?: {
      thresholdPct: number;
      expiryDays: number;
      expiryAt: string;
      condition: string;
      budgetUsd: number;
      fallback: string;
    };
  };
};

export type StrategyBuilderOptions = {
  defaultBudgetUsd?: number;
  allowDeepBookPredict?: boolean;
  predictSettings?: DeepBookPredictSettings;
  now?: Date;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pickSignal(signals: RiskSignal[], predicate: (signal: RiskSignal) => boolean): RiskSignal | undefined {
  return signals.find(predicate);
}

function buildBaseCost(totalUsdValue: number, budgetCapUsd: number): number {
  const proposed = Math.ceil(totalUsdValue * 0.0625);
  return Math.max(1, Math.min(budgetCapUsd, proposed));
}

function clampPredictBudget(settings: DeepBookPredictSettings, fallbackCost: number, budgetCapUsd: number): number {
  const requested = Number.isFinite(settings.budgetUsd) ? settings.budgetUsd : fallbackCost;
  return round(Math.max(1, Math.min(budgetCapUsd, requested)));
}

function buildPredictMarket(thresholdPct: number, expiryDays: number): string {
  return `SUI downside ${thresholdPct}% / ${expiryDays}D`;
}

export function buildStrategyRecommendation(
  report: RiskReport,
  portfolio: PortfolioSnapshot,
  policy: Pick<ExecutionPolicy, 'maxBudgetUsd'> | { maxBudgetUsd: number },
  options?: StrategyBuilderOptions,
): StrategyRecommendation {
  const budgetCapUsd = options?.defaultBudgetUsd ?? policy.maxBudgetUsd;
  const cost = buildBaseCost(portfolio.totalUsdValue, budgetCapUsd);
  const allowDeepBookPredict = options?.allowDeepBookPredict ?? true;
  const predictSettings = options?.predictSettings ?? {
    thresholdPct: -10,
    expiryDays: 7,
    budgetUsd: cost,
  };

  const suiSignal = pickSignal(
    report.signals,
    (signal) =>
      signal.id === 'sui-downside' && (signal.level === 'high' || signal.level === 'critical'),
  );

  const concentrationSignal = pickSignal(
    report.signals,
    (signal) => signal.category === 'concentration' && (signal.level === 'high' || signal.level === 'critical'),
  );

  const lendingSignal = pickSignal(
    report.signals,
    (signal) => signal.category === 'liquidation' && (signal.level === 'high' || signal.level === 'critical'),
  );

  const lpSignal = pickSignal(
    report.signals,
    (signal) => signal.category === 'lp' && (signal.level === 'medium' || signal.level === 'high'),
  );

  const stablecoinSignal = pickSignal(report.signals, (signal) => signal.category === 'stablecoin');

  if (suiSignal) {
    if (allowDeepBookPredict) {
      const budgetUsd = clampPredictBudget(predictSettings, cost, budgetCapUsd);
      const now = options?.now ?? new Date();
      const expiryAt = new Date(now.getTime() + predictSettings.expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const thresholdLabel = `${predictSettings.thresholdPct}%`;
      const condition = `Protection condition: SUI is down ${Math.abs(predictSettings.thresholdPct)}% or more by expiry.`;

      return {
        id: `strategy-${report.portfolioId}-deepbook-predict-${Math.abs(predictSettings.thresholdPct)}-${predictSettings.expiryDays}d`,
        type: 'deepbook_predict_downside_binary',
        title: 'DeepBook Predict-style downside cover',
        summary:
          `Prepare bounded mainnet-ready DeepBook Predict terms for a ${thresholdLabel} SUI downside move.`,
        targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
        estimatedCostUsd: budgetUsd,
        expectedRiskReduction: predictSettings.thresholdPct === -20 ? 24 : predictSettings.thresholdPct === -15 ? 30 : 35,
        deepbookAction: {
          mode: 'prepare_mainnet',
          kind: 'predict_binary',
          market: buildPredictMarket(predictSettings.thresholdPct, predictSettings.expiryDays),
          side: 'buy',
          assetIn: 'USDC',
          assetOut: 'SUI downside cover',
          amountUsd: budgetUsd,
          description:
            `Mainnet-ready DeepBook Predict-style binary plan. ${condition} This prepares terms only and does not submit funds.`,
        },
        parameters: {
          deepbookPredict: {
            thresholdPct: predictSettings.thresholdPct,
            expiryDays: predictSettings.expiryDays,
            expiryAt,
            condition,
            budgetUsd,
            fallback: 'If DeepBook Predict mainnet preparation is unavailable, RiskPilot records the same terms as a local simulation equivalent.',
          },
        },
      };
    }

    return {
      id: `strategy-${report.portfolioId}-sui-protection`,
      type: 'sui_downside_protection',
      title: 'SUI downside protection',
      summary:
        'Prepare a bounded mainnet SUI/USDC protection trade to reduce downside exposure without auto-submitting funds.',
      targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
      estimatedCostUsd: round(cost),
      expectedRiskReduction: 35,
      deepbookAction: {
        mode: 'prepare_mainnet',
        kind: 'spot',
        market: 'SUI/USDC',
        side: 'sell',
        assetIn: 'SUI',
        assetOut: 'USDC',
        amountUsd: round(cost),
        description:
          'Mainnet DeepBook / DeepBook Predict-style downside protection plan. Execute only after explicit wallet confirmation.',
      },
    };
  }

  if (lendingSignal) {
    return {
      id: `strategy-${report.portfolioId}-lending-deleverage`,
      type: 'lending_deleverage',
      title: 'Lending deleverage',
      summary:
        'Prepare a small mainnet SUI/USDC action that can help reduce debt pressure after manual review.',
      targetRiskSignalIds: [lendingSignal.id],
      estimatedCostUsd: round(cost),
      expectedRiskReduction: 32,
      deepbookAction: {
        mode: 'prepare_mainnet',
        kind: 'spot',
        market: 'SUI/USDC',
        side: 'sell',
        assetIn: 'SUI',
        assetOut: 'USDC',
        amountUsd: round(cost),
        description:
          'Mainnet DeepBook deleveraging plan for a lending health-factor risk. Execute only after explicit wallet confirmation.',
      },
    };
  }

  if (lpSignal) {
    return {
      id: `strategy-${report.portfolioId}-lp-risk-reduction`,
      type: 'lp_risk_reduction',
      title: 'LP risk reduction',
      summary:
        'Prepare a bounded mainnet SUI/USDC action to reduce LP-linked downside and impermanent loss exposure.',
      targetRiskSignalIds: [lpSignal.id],
      estimatedCostUsd: round(cost),
      expectedRiskReduction: 26,
      deepbookAction: {
        mode: 'prepare_mainnet',
        kind: 'spot',
        market: 'SUI/USDC',
        side: 'sell',
        assetIn: 'SUI/USDC LP',
        assetOut: 'USDC',
        amountUsd: round(cost),
        description:
          'Mainnet DeepBook LP risk-reduction plan. Execute only after explicit wallet confirmation and LP unwind review.',
      },
    };
  }

  if (stablecoinSignal) {
    return {
      id: `strategy-${report.portfolioId}-stablecoin-split`,
      type: 'stablecoin_split',
      title: 'Stablecoin sleeve split',
      summary: 'Reduce single-stablecoin concentration with a small mainnet rotation into a second stablecoin.',
      targetRiskSignalIds: [stablecoinSignal.id],
      estimatedCostUsd: round(cost),
      expectedRiskReduction: 18,
      deepbookAction: {
        mode: 'prepare_mainnet',
        kind: 'spot',
        market: 'USDC/SUI',
        side: 'sell',
        assetIn: 'USDC',
        assetOut: 'SUI',
        amountUsd: round(cost),
        description: 'Mainnet DeepBook stablecoin sleeve adjustment. Execute only after explicit wallet confirmation.',
      },
    };
  }

  if (concentrationSignal) {
    return {
      id: `strategy-${report.portfolioId}-rebalance`,
      type: 'rebalance_concentration',
      title: 'Concentration reduction',
      summary:
        'Rebalance the largest holding into USDC on mainnet to lower concentration risk before any live execution.',
      targetRiskSignalIds: [concentrationSignal.id],
      estimatedCostUsd: round(cost),
      expectedRiskReduction: 22,
      deepbookAction: {
        mode: 'prepare_mainnet',
        kind: 'spot',
        market: 'SUI/USDC',
        side: 'sell',
        assetIn: 'SUI',
        assetOut: 'USDC',
        amountUsd: round(cost),
        description: 'Mainnet DeepBook rebalancing plan. Execute only after explicit wallet confirmation.',
      },
    };
  }

  return {
    id: `strategy-${report.portfolioId}-stablecoin-split`,
    type: 'stablecoin_split',
    title: 'Stablecoin sleeve split',
    summary: 'Reduce single-stablecoin concentration with a small mainnet rotation into a second stablecoin.',
    targetRiskSignalIds: report.signals.filter((signal) => signal.category === 'stablecoin').map((signal) => signal.id),
    estimatedCostUsd: round(cost),
    expectedRiskReduction: 18,
    deepbookAction: {
      mode: 'prepare_mainnet',
      kind: 'spot',
      market: 'SUI/USDC',
      side: 'sell',
      assetIn: 'USDC',
      assetOut: 'SUI',
      amountUsd: round(cost),
      description: 'Mainnet DeepBook stablecoin sleeve adjustment. Execute only after explicit wallet confirmation.',
    },
  };
}
