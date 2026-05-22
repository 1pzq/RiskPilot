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
  'RiskPilot keeps the plan in prepare_mainnet mode by default: it prepares reviewable mainnet terms, but it does not submit funds, sign a transaction, or call a Predict contract without explicit wallet approval.';

const COMMON_CONSTRAINTS = [
  'Sui mainnet only.',
  'Default execution mode remains prepare_mainnet.',
  'Any live transaction must pass policy checks and explicit wallet confirmation.',
];

function presentSignals(signals: (RiskSignal | undefined)[]): RiskSignal[] {
  return signals.filter((signal): signal is RiskSignal => Boolean(signal));
}

function describeSignals(signals: RiskSignal[]): string {
  if (signals.length === 0) {
    return 'No priced actionable risk signal';
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
      { label: 'Execution default', value: 'prepare_mainnet' },
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
      const condition = `Protection condition: SUI is down ${Math.abs(predictSettings.thresholdPct)}% or more by expiry.`;

      return {
        id: `strategy-${report.portfolioId}-deepbook-predict-${Math.abs(predictSettings.thresholdPct)}-${predictSettings.expiryDays}d`,
        type: 'deepbook_predict_downside_binary',
        title: 'DeepBook Predict-style downside cover',
        summary:
          `Prepare bounded mainnet-ready DeepBook Predict terms for a ${thresholdLabel} SUI downside move.`,
        targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
        ...buildStrategyMetadata({
          signals,
          rationale:
            'The portfolio has high SUI downside exposure, and any concentration signal makes a drawdown more painful. A bounded binary cover expresses that specific downside view without making live execution the default.',
          applicability:
            'Targets priced SUI downside and concentration risk signals when the wallet has SUI-linked exposure and the user wants terms prepared for review before any funds move.',
          fallback:
            'If DeepBook Predict preparation is unavailable, RiskPilot records the same threshold, expiry, and budget as a local simulation; a separate spot reduction can be prepared only after manual approval.',
          constraints: [
            'No real DeepBook Predict contract call is implemented in this demo.',
            `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`,
          ],
          riskTradeoffs: [
            'Binary cover may expire without value if SUI does not breach the selected threshold.',
            'The cover is sized as a capped budget, not a full portfolio hedge.',
            'Unknown or unpriced coins are excluded from the trade decision.',
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
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The portfolio is sensitive to a SUI drawdown, so reducing a small amount of SUI exposure can lower the most direct priced risk.',
        applicability:
          'Targets SUI downside and concentration risk signals when DeepBook Predict terms are disabled or unavailable.',
        fallback:
          'If a SUI/USDC route cannot be prepared, RiskPilot keeps the recommendation as review-only and records a no-trade audit path instead of inventing another market.',
        constraints: [`Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`],
        riskTradeoffs: [
          'Selling SUI can reduce upside if the market recovers.',
          'A spot reduction is not the same as downside insurance.',
          'Unknown or unpriced coins are excluded from the trade decision.',
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
          'Mainnet DeepBook / DeepBook Predict-style downside protection plan. Execute only after explicit wallet confirmation.',
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
        'Prepare a small mainnet SUI/USDC action that can help reduce debt pressure after manual review.',
      targetRiskSignalIds: [lendingSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The lending health signal indicates liquidation risk, so the strategy prepares liquidity that could be used to reduce debt pressure after the user reviews the protocol position.',
        applicability:
          'Targets liquidation and weak health-factor risk signals from priced lending positions; it is not used for unpriced object hints alone.',
        fallback:
          'If the DeepBook spot leg cannot be prepared, RiskPilot falls back to a protocol-native repay or add-collateral checklist and records no trade.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`,
          'Debt repayment or collateral movement must happen in the lending protocol, outside this DeepBook-only demo path.',
        ],
        riskTradeoffs: [
          'Selling collateral can reduce upside and may not be enough to restore health by itself.',
          'Protocol-specific repay steps still need manual wallet review.',
          'Unknown or unpriced lending-like objects do not trigger a fake trade.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Protocol step', value: 'Manual repay or collateral review' },
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
          'Mainnet DeepBook deleveraging plan for a lending health-factor risk. Execute only after explicit wallet confirmation.',
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
        'Prepare a bounded mainnet SUI/USDC action to reduce LP-linked downside and impermanent loss exposure.',
      targetRiskSignalIds: [lpSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The LP signal shows meaningful impermanent-loss exposure, so the plan focuses on reducing the risky LP sleeve before it dominates the book.',
        applicability:
          'Targets LP risk signals from priced liquidity positions, especially SUI/USDC exposure with medium or high impermanent-loss risk.',
        fallback:
          'If the LP unwind cannot be represented by the current adapter, RiskPilot records an LP exit checklist and keeps the DeepBook action at prepare-only/no-submit.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`,
          'LP withdrawal and range management are protocol-specific and are not executed by this demo.',
        ],
        riskTradeoffs: [
          'Reducing LP exposure can give up future fees.',
          'Partial exits may leave residual price and range risk.',
          'Unpriced LP-like objects are reviewed but do not trigger a fake swap.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Fallback path', value: 'LP unwind checklist' },
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
          'Mainnet DeepBook LP risk-reduction plan. Execute only after explicit wallet confirmation and LP unwind review.',
      },
    };
  }

  if (stablecoinSignal) {
    const signals = presentSignals([stablecoinSignal]);

    return {
      id: `strategy-${report.portfolioId}-stablecoin-split`,
      type: 'stablecoin_split',
      title: 'Stablecoin sleeve split',
      summary: 'Prepare a DAO treasury split review for single-stablecoin depeg risk without submitting funds.',
      targetRiskSignalIds: [stablecoinSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The stablecoin signal shows one stablecoin dominating the treasury sleeve, so the recommendation prepares a bounded diversification step for DAO-style depeg review.',
        applicability:
          'Targets stablecoin concentration and depeg risk signals for priced treasury assets; it does not act on unknown or unpriced coins.',
        fallback:
          'If a supported stable-to-stable venue is unavailable, RiskPilot keeps a no-submit treasury review and records the intended split policy instead of forcing a trade.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`,
          'The demo only prepares the DeepBook leg; final stablecoin diversification requires an approved supported venue.',
        ],
        riskTradeoffs: [
          'Diversifying out of one stablecoin may introduce bridge, liquidity, or volatility risk depending on the destination asset.',
          'A small prepared split does not fully remove depeg exposure.',
          'Treasury operators still need to approve the final venue and asset list.',
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
        description: 'Mainnet DeepBook stablecoin sleeve adjustment. Execute only after explicit wallet confirmation.',
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
        'Rebalance the largest holding into USDC on mainnet to lower concentration risk before any live execution.',
      targetRiskSignalIds: [concentrationSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'The largest priced holding is above the concentration threshold, so a small rebalance can lower single-asset dependency.',
        applicability:
          'Targets top-asset concentration signals when there is a priced asset that maps to an approved mainnet route.',
        fallback:
          'If the top asset cannot be routed safely, RiskPilot returns a review path and does not substitute an unrelated SUI/USDC trade.',
        constraints: [
          `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`,
          'Only priced and routeable assets are candidates for a prepared rebalance.',
        ],
        riskTradeoffs: [
          'Rebalancing may reduce upside in the concentrated asset.',
          'A small rebalance reduces but does not eliminate concentration risk.',
          'Unknown or unpriced assets are excluded from the trade decision.',
        ],
        displayFacts: [
          { label: 'Prepared market', value: 'SUI/USDC' },
          { label: 'Target posture', value: 'Lower top-asset share' },
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
        description: 'Mainnet DeepBook rebalancing plan. Execute only after explicit wallet confirmation.',
      },
    };
  }

  if (portfolio.walletAddress !== '0xDEMO') {
    return {
      id: `strategy-${report.portfolioId}-wallet-review`,
      type: 'wallet_review',
      title: 'Wallet review only',
      summary:
        'No actionable priced DeFi risk was detected from the connected mainnet wallet, so RiskPilot prepares an audit record without inventing a trade.',
      targetRiskSignalIds: [],
      ...buildStrategyMetadata({
        signals: [],
        rationale:
          'The connected wallet did not produce a priced actionable risk signal, so creating a SUI/USDC trade would be misleading.',
        applicability:
          'Applies to connected-wallet scans with no priced actionable DeFi risk, including wallets that only expose unknown, unsupported, or unpriced objects.',
        prepareOnlyReason:
          'RiskPilot prepares an audit-only wallet review. There is no DeepBook order, no Predict call, and no transaction to submit by default.',
        fallback:
          'Fallback is the wallet review itself: record observed objects, pricing gaps, and unsupported positions for manual analysis without preparing a trade.',
        constraints: [
          'amountUsd must remain 0.',
          'market must remain No trade.',
          'Unknown or unpriced coins cannot create a substitute SUI/USDC trade.',
        ],
        riskTradeoffs: [
          'Risk can be understated when protocols or assets cannot be priced.',
          'The user may need protocol-specific analysis before any future action.',
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
          'Connected-wallet review only. No live or prepared DeepBook trade is created because the wallet did not expose an actionable priced risk.',
      },
    };
  }

  return {
    id: `strategy-${report.portfolioId}-stablecoin-split`,
    type: 'stablecoin_split',
    title: 'Stablecoin sleeve split',
    summary: 'Prepare a DAO treasury split review for single-stablecoin depeg risk without submitting funds.',
    targetRiskSignalIds: report.signals.filter((signal) => signal.category === 'stablecoin').map((signal) => signal.id),
    ...buildStrategyMetadata({
      signals: report.signals.filter((signal) => signal.category === 'stablecoin'),
      rationale:
        'The demo fallback assumes the remaining actionable risk is stablecoin concentration, so it prepares a small sleeve split for review.',
      applicability:
        'Applies only to demo-mode portfolios when no higher-priority SUI, lending, LP, or concentration signal is selected.',
      fallback:
        'If a supported stable-to-stable route is unavailable, RiskPilot records the split policy as a simulation and does not submit a trade.',
      constraints: [
        `Budget cannot exceed ${displayUsd(budgetCapUsd)} under the active policy cap.`,
        'This branch is demo-only and remains prepare_mainnet.',
      ],
      riskTradeoffs: [
        'Diversification may introduce new asset or route risk.',
        'A small split does not fully remove depeg exposure.',
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
      description: 'Mainnet DeepBook stablecoin sleeve adjustment. Execute only after explicit wallet confirmation.',
    },
  };
}
