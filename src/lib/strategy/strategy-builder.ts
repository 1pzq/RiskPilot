import type { PortfolioSnapshot, RiskReport, RiskSignal } from '@/lib/risk/types';
import type { ExecutionPolicy } from './policy';

export type StrategyType =
  | 'wallet_review'
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

export type StrategyDisplayFact = {
  label: string;
  value: string;
};

export type StrategyRecommendation = {
  id: string;
  type: StrategyType;
  title: string;
  summary: string;
  targetRiskSignalIds: string[];
  rationale: string;
  applicability: string;
  prepareOnlyReason: string;
  fallback: string;
  constraints: string[];
  riskTradeoffs: string[];
  displayFacts: StrategyDisplayFact[];
  estimatedCostUsd: number;
  expectedRiskReduction: number;
  deepbookAction: {
    mode: 'prepare_mainnet' | 'mainnet';
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
  if (totalUsdValue <= 0) {
    return 0;
  }

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

const PREPARE_ONLY_REASON =
  'RiskPilot keeps the plan in prepare_mainnet mode by default: it prepares reviewable mainnet terms without submitting funds, signing transactions, or calling Predict contracts without explicit wallet approval.';

const COMMON_CONSTRAINTS = [
  'Sui mainnet only.',
  'Default execution mode remains prepare_mainnet.',
  'Any live transaction must pass Policy checks and receive explicit wallet confirmation.',
];

function presentSignals(signals: (RiskSignal | undefined)[]): RiskSignal[] {
  return signals.filter((signal): signal is RiskSignal => Boolean(signal));
}

function describeSignals(signals: RiskSignal[]): string {
  if (signals.length === 0) {
    return 'No priced executable risk signals';
  }

  return signals.map((signal) => `${signal.id} (${signal.level})`).join(', ');
}

function displayUsd(value: number): string {
  return `$${round(value).toFixed(2)}`;
}

function buildStrategyMetadata(input: {
  signals: RiskSignal[];
  rationale: string;
  applicability: string;
  fallback: string;
  constraints?: string[];
  riskTradeoffs: string[];
  displayFacts?: StrategyDisplayFact[];
  prepareOnlyReason?: string;
}): Pick<
  StrategyRecommendation,
  | 'rationale'
  | 'applicability'
  | 'prepareOnlyReason'
  | 'fallback'
  | 'constraints'
  | 'riskTradeoffs'
  | 'displayFacts'
> {
  return {
    rationale: input.rationale,
    applicability: input.applicability,
    prepareOnlyReason: input.prepareOnlyReason ?? PREPARE_ONLY_REASON,
    fallback: input.fallback,
    constraints: [...COMMON_CONSTRAINTS, ...(input.constraints ?? [])],
    riskTradeoffs: input.riskTradeoffs,
    displayFacts: [
      { label: 'Risk signals', value: describeSignals(input.signals) },
      { label: 'Default execution', value: 'prepare_mainnet' },
      ...(input.displayFacts ?? []),
    ],
  };
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
    const signals = presentSignals([suiSignal, concentrationSignal]);

    if (allowDeepBookPredict) {
      const budgetUsd = clampPredictBudget(predictSettings, cost, budgetCapUsd);
      const now = options?.now ?? new Date();
      const expiryAt = new Date(now.getTime() + predictSettings.expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const thresholdLabel = `${predictSettings.thresholdPct}%`;
      const condition = `Protection condition: SUI is down ${Math.abs(predictSettings.thresholdPct)}% or more at expiry.`;

      return {
        id: `strategy-${report.portfolioId}-deepbook-predict-${Math.abs(predictSettings.thresholdPct)}-${predictSettings.expiryDays}d`,
        type: 'deepbook_predict_downside_binary',
        title: 'DeepBook Predict-style downside cover',
        summary:
          `Prepare bounded mainnet-ready DeepBook Predict terms for a ${thresholdLabel} SUI downside scenario.`,
        targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
        ...buildStrategyMetadata({
          signals,
          rationale:
            'The portfolio has elevated SUI downside exposure, and concentration signals can amplify drawdown impact. Bounded binary cover expresses that downside view without making live execution the default.',
          applicability:
            'Applies to priced SUI downside and concentration risks when the wallet has SUI exposure and the user wants to review terms before any funds move.',
          fallback:
            'If DeepBook Predict preparation is unavailable, RiskPilot keeps the recommendation review-only and records a no-trade audit path. A separate spot reduction can only be prepared after manual approval.',
          constraints: [
            'This demo does not execute a live DeepBook Predict contract call.',
            `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`,
          ],
          riskTradeoffs: [
            'If SUI does not break the selected threshold, binary cover may expire worthless.',
            'Cover size is capped by budget and is not a full portfolio hedge.',
            'Unknown or unpriced coins are excluded from trading decisions.',
          ],
          displayFacts: [
            { label: 'Prepared market', value: buildPredictMarket(predictSettings.thresholdPct, predictSettings.expiryDays) },
            { label: 'Budget cap', value: displayUsd(budgetCapUsd) },
            { label: 'Expiry', value: `${predictSettings.expiryDays}D` },
          ],
        }),
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
            `Mainnet-ready DeepBook Predict-style binary plan. ${condition} Terms are prepared only; no funds are submitted.`,
        },
        parameters: {
          deepbookPredict: {
            thresholdPct: predictSettings.thresholdPct,
            expiryDays: predictSettings.expiryDays,
            expiryAt,
            condition,
            budgetUsd,
            fallback: 'If DeepBook Predict mainnet preparation is unavailable, RiskPilot records the same terms as review-only evidence without creating an execution result.',
          },
        },
      };
    }

    return {
      id: `strategy-${report.portfolioId}-sui-protection`,
      type: 'sui_downside_protection',
      title: 'SUI downside protection',
      summary:
        'Prepare a bounded mainnet SUI/USDC protective action to reduce downside exposure without auto-submitting funds.',
      targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The portfolio is sensitive to SUI drawdowns, so reducing a small amount of SUI exposure lowers the most direct priced risk.',
        applicability:
          'Applies to SUI downside and concentration signals when DeepBook Predict terms are disabled or unavailable.',
        fallback:
          'If the SUI/USDC route cannot be prepared, RiskPilot keeps the recommendation review-only and records a no-trade audit path instead of inventing another market.',
        constraints: [`Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`],
        riskTradeoffs: [
          'If the market recovers, selling SUI can reduce upside.',
          'Spot reduction is not the same as downside insurance.',
          'Unknown or unpriced coins are excluded from trading decisions.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Budget cap', value: displayUsd(budgetCapUsd) },
        ],
      }),
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
          'Mainnet DeepBook / DeepBook Predict-style downside protection plan. Execution requires explicit wallet confirmation.',
      },
    };
  }

  if (lendingSignal) {
    const signals = presentSignals([lendingSignal]);

    return {
      id: `strategy-${report.portfolioId}-lending-deleverage`,
      type: 'lending_deleverage',
      title: 'Lending deleverage',
      summary:
        'Prepare a small mainnet SUI/USDC action to support debt-pressure reduction after human review.',
      targetRiskSignalIds: [lendingSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'Lending health signals indicate liquidation risk, so the strategy prepares liquidity that can help reduce debt pressure after the user reviews protocol positions.',
        applicability:
          'Applies to liquidation and low-health-factor signals from priced lending positions. Unpriced object hints alone do not trigger it.',
        fallback:
          'If the DeepBook spot leg cannot be prepared, RiskPilot falls back to a protocol-native repayment or collateral checklist and records no trade.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`,
          'Debt repayment or collateral movement must happen inside the lending protocol and is outside this DeepBook-only demo path.',
        ],
        riskTradeoffs: [
          'Selling collateral can reduce upside and may not restore health on its own.',
          'Protocol-specific repayment steps still require human wallet review.',
          'Unknown or unpriced lending-like objects do not trigger synthetic trades.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Protocol step', value: 'Manual repayment or collateral review' },
        ],
      }),
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
          'Mainnet DeepBook deleverage plan for lending health-factor risk. Execution requires explicit wallet confirmation.',
      },
    };
  }

  if (lpSignal) {
    const signals = presentSignals([lpSignal]);

    return {
      id: `strategy-${report.portfolioId}-lp-risk-reduction`,
      type: 'lp_risk_reduction',
      title: 'LP risk reduction',
      summary:
        'Prepare a bounded mainnet SUI/USDC action to reduce LP-related downside and impermanent-loss exposure.',
      targetRiskSignalIds: [lpSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'LP signals show meaningful impermanent-loss exposure, so the plan focuses on reducing that exposure before the risky LP position dominates the ledger.',
        applicability:
          'Applies to LP risk signals from priced liquidity positions, especially medium-to-high impermanent-loss risk on SUI/USDC exposure.',
        fallback:
          'If the current adapter cannot express LP withdrawal, RiskPilot records an LP exit checklist and keeps the DeepBook action prepared-only and not submitted.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`,
          'LP withdrawal and range management are protocol-specific and are not executed in this demo.',
        ],
        riskTradeoffs: [
          'Reducing LP exposure can forgo future fees.',
          'A partial exit can leave residual price and range risk.',
          'Unpriced LP-like objects are reviewed but do not trigger synthetic swaps.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Fallback path', value: 'LP exit checklist' },
        ],
      }),
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
          'Mainnet DeepBook LP risk-reduction plan. Execution requires explicit wallet confirmation and LP exit review.',
      },
    };
  }

  if (stablecoinSignal) {
    const signals = presentSignals([stablecoinSignal]);

    return {
      id: `strategy-${report.portfolioId}-stablecoin-split`,
      type: 'stablecoin_split',
      title: 'Stablecoin position split',
      summary: 'Prepare a DAO treasury split review for single-stablecoin depeg risk without submitting funds.',
      targetRiskSignalIds: [stablecoinSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'Stablecoin signals show one stablecoin dominating the treasury, so the recommendation prepares bounded diversification steps for a DAO-style depeg review.',
        applicability:
          'Applies to stablecoin concentration and depeg signals in priced treasury assets. Unknown or unpriced coins are not acted on.',
        fallback:
          'If no supported stable-to-stable venue exists, RiskPilot keeps an unsubmitted treasury review and records the target split Policy instead of forcing a trade.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`,
          'This demo only prepares the DeepBook leg. Final stablecoin diversification requires an approved supported venue.',
        ],
        riskTradeoffs: [
          'Diversifying away from one stablecoin can introduce bridge, liquidity, or volatility risk through target assets.',
          'A small prepared split cannot fully remove depeg exposure.',
          'Treasury operators still need to approve the final venues and asset list.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'USDC/SUI' },
          { label: 'Treasury posture', value: 'DAO depeg review' },
        ],
      }),
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
        description: 'Mainnet DeepBook stablecoin position adjustment. Execution requires explicit wallet confirmation.',
      },
    };
  }

  if (concentrationSignal) {
    const signals = presentSignals([concentrationSignal]);

    return {
      id: `strategy-${report.portfolioId}-rebalance`,
      type: 'rebalance_concentration',
      title: 'Concentration reduction',
      summary:
        'Rebalance the largest holding toward USDC on mainnet to reduce concentration risk before any live execution.',
      targetRiskSignalIds: [concentrationSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The largest priced holding exceeds the concentration threshold, so a small rebalance can reduce single-asset dependency.',
        applicability:
          'Applies to position concentration signals when priced assets can map to an approved mainnet route.',
        fallback:
          'If the largest asset cannot be routed safely, RiskPilot returns a review path instead of substituting an unrelated SUI/USDC trade.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`,
          'Only priced and routable assets are prepared rebalance candidates.',
        ],
        riskTradeoffs: [
          'Rebalancing can reduce upside from the concentrated asset.',
          'A small rebalance reduces but does not eliminate concentration risk.',
          'Unknown or unpriced assets are excluded from trading decisions.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Target posture', value: 'Reduce largest-asset share' },
        ],
      }),
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
        description: 'Mainnet DeepBook rebalance plan. Execution requires explicit wallet confirmation.',
      },
    };
  }

  if (portfolio.walletAddress !== '0xDEMO') {
    return {
      id: `strategy-${report.portfolioId}-wallet-review`,
      type: 'wallet_review',
      title: 'Wallet review only',
      summary:
        'The connected mainnet wallet has no executable priced DeFi risk, so RiskPilot prepares an audit record without inventing a trade.',
      targetRiskSignalIds: [],
      ...buildStrategyMetadata({
        signals: [],
        rationale:
          'The connected wallet did not produce priced executable risk signals, so creating a SUI/USDC trade would be misleading.',
        applicability:
          'Applies to connected wallet scans with no priced executable DeFi risk, including wallets that only expose unknown, unsupported, or unpriced objects.',
        prepareOnlyReason:
          'RiskPilot prepares an audit-only wallet review. By default there is no DeepBook order, no Predict call, and no transaction to submit.',
        fallback:
          'The fallback is the wallet review itself: record observed objects, pricing gaps, and unsupported positions for human analysis without preparing a trade.',
        constraints: [
          'amountUsd must remain 0.',
          'market must remain No trade.',
          'Unknown or unpriced coins cannot create substitute SUI/USDC trades.',
        ],
        riskTradeoffs: [
          'Risk may be understated when protocols or assets cannot be priced.',
          'Users may need protocol-specific analysis before taking any future action.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'No trade' },
          { label: 'Prepared size', value: displayUsd(0) },
        ],
      }),
      estimatedCostUsd: 0,
      expectedRiskReduction: 0,
      deepbookAction: {
        mode: 'prepare_mainnet',
        kind: 'spot',
        market: 'No trade',
        side: 'sell',
        assetIn: 'N/A',
        assetOut: 'N/A',
        amountUsd: 0,
        description:
          'Connected wallet review only. Because the wallet exposes no executable priced risk, no live or prepared DeepBook transaction is created.',
      },
    };
  }

  return {
    id: `strategy-${report.portfolioId}-stablecoin-split`,
    type: 'stablecoin_split',
    title: 'Stablecoin position split',
    summary: 'Prepare a DAO treasury split review for single-stablecoin depeg risk without submitting funds.',
    targetRiskSignalIds: report.signals.filter((signal) => signal.category === 'stablecoin').map((signal) => signal.id),
    ...buildStrategyMetadata({
      signals: report.signals.filter((signal) => signal.category === 'stablecoin'),
      rationale:
        'Demo fallback assumes the remaining executable risk is stablecoin concentration, so it prepares a small position split for review.',
      applicability:
        'Only applies to the demo portfolio when no higher-priority SUI, lending, LP, or concentration signal is selected.',
      fallback:
        'If no supported stable-to-stable route exists, RiskPilot records a no-trade audit path and submits nothing.',
      constraints: [
        `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the current Policy limit.`,
        'This branch is demo-only and remains prepare_mainnet.',
      ],
      riskTradeoffs: [
        'Diversification can introduce new asset or route risk.',
        'A small split cannot fully remove depeg exposure.',
      ],
      displayFacts: [
        { label: 'Prepared market', value: 'SUI/USDC' },
        { label: 'Demo fallback', value: 'Stablecoin review' },
      ],
    }),
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
    description: 'Mainnet DeepBook stablecoin position adjustment. Execution requires explicit wallet confirmation.',
  },
};
}
