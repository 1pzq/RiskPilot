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
  'RiskPilot 默认将计划保持在 prepare_mainnet 模式：它只准备可复核的 mainnet 条款，不会在没有明确钱包批准的情况下提交资金、签名交易或调用 Predict 合约。';

const COMMON_CONSTRAINTS = [
  '仅限 Sui mainnet。',
  '默认执行模式保持为 prepare_mainnet。',
  '任何 Live 交易都必须通过 Policy 检查并获得明确的钱包确认。',
];

function presentSignals(signals: (RiskSignal | undefined)[]): RiskSignal[] {
  return signals.filter((signal): signal is RiskSignal => Boolean(signal));
}

function describeSignals(signals: RiskSignal[]): string {
  if (signals.length === 0) {
    return '没有已定价的可执行风险信号';
  }

  return signals.map((signal) => `${signal.id}（${signal.level}）`).join(', ');
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
      { label: '风险信号', value: describeSignals(input.signals) },
      { label: '默认执行', value: 'prepare_mainnet' },
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
      const condition = `保护条件：到期时 SUI 下跌 ${Math.abs(predictSettings.thresholdPct)}% 或更多。`;

      return {
        id: `strategy-${report.portfolioId}-deepbook-predict-${Math.abs(predictSettings.thresholdPct)}-${predictSettings.expiryDays}d`,
        type: 'deepbook_predict_downside_binary',
        title: 'DeepBook Predict 风格下行保护',
        summary:
          `为 ${thresholdLabel} 的 SUI 下行情景准备有边界的 mainnet-ready DeepBook Predict 条款。`,
        targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
        ...buildStrategyMetadata({
          signals,
          rationale:
            '该 Portfolio 有较高的 SUI 下行敞口，任何集中度信号都会放大回撤冲击。有边界的二元保护可以表达这个具体下行观点，同时不会把 Live 执行设为默认。',
          applicability:
            '适用于钱包存在 SUI 相关敞口，且用户希望在任何资金移动前先复核条款的已定价 SUI 下行和集中度风险信号。',
          fallback:
            '如果 DeepBook Predict 准备不可用，RiskPilot 会把推荐保持为仅复核并记录无交易审计路径；单独的 Spot 减仓只能在人工批准后准备。',
          constraints: [
            '该 demo 没有实现真实的 DeepBook Predict 合约调用。',
            `在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`,
          ],
          riskTradeoffs: [
            '如果 SUI 没有跌破所选阈值，二元保护可能到期归零。',
            '保护规模按预算上限设置，不是完整 Portfolio 对冲。',
            '未知或未定价币种会从交易决策中排除。',
          ],
          displayFacts: [
            { label: '已准备市场', value: buildPredictMarket(predictSettings.thresholdPct, predictSettings.expiryDays) },
            { label: '预算上限', value: displayUsd(budgetCapUsd) },
            { label: '到期时间', value: `${predictSettings.expiryDays}D` },
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
            `Mainnet-ready DeepBook Predict 风格二元计划。${condition}这里只准备条款，不提交资金。`,
        },
        parameters: {
          deepbookPredict: {
            thresholdPct: predictSettings.thresholdPct,
            expiryDays: predictSettings.expiryDays,
            expiryAt,
            condition,
            budgetUsd,
            fallback: '如果 DeepBook Predict mainnet 准备不可用，RiskPilot 会把相同条款记录为仅复核证据，不创建执行结果。',
          },
        },
      };
    }

    return {
      id: `strategy-${report.portfolioId}-sui-protection`,
      type: 'sui_downside_protection',
      title: 'SUI 下行保护',
      summary:
        '准备有边界的 mainnet SUI/USDC 保护交易，以降低下行敞口，同时不自动提交资金。',
      targetRiskSignalIds: [suiSignal.id, concentrationSignal?.id].filter(Boolean) as string[],
      ...buildStrategyMetadata({
        signals,
        rationale:
          '该 Portfolio 对 SUI 回撤敏感，因此减少少量 SUI 敞口可以降低最直接的已定价风险。',
        applicability:
          '适用于 DeepBook Predict 条款被关闭或不可用时的 SUI 下行和集中度风险信号。',
        fallback:
          '如果无法准备 SUI/USDC 路线，RiskPilot 会把推荐保持为仅复核并记录无交易审计路径，而不是虚构另一个市场。',
        constraints: [`在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`],
        riskTradeoffs: [
          '如果市场恢复，卖出 SUI 可能减少上行收益。',
          'Spot 减仓不等同于下行保险。',
          '未知或未定价币种会从交易决策中排除。',
        ],
        displayFacts: [
          { label: '已准备市场', value: 'SUI/USDC' },
          { label: '预算上限', value: displayUsd(budgetCapUsd) },
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
          'Mainnet DeepBook / DeepBook Predict 风格下行保护计划。仅在明确钱包确认后执行。',
      },
    };
  }

  if (lendingSignal) {
    const signals = presentSignals([lendingSignal]);

    return {
      id: `strategy-${report.portfolioId}-lending-deleverage`,
      type: 'lending_deleverage',
      title: '借贷降杠杆',
      summary:
        '准备一个小规模 mainnet SUI/USDC 动作，用于人工复核后辅助降低债务压力。',
      targetRiskSignalIds: [lendingSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          '借贷健康信号显示存在清算风险，因此策略会准备可在用户复核协议仓位后用于降低债务压力的流动性。',
        applicability:
          '适用于来自已定价借贷仓位的清算和低健康因子风险信号；不会仅凭未定价对象提示触发。',
        fallback:
          '如果无法准备 DeepBook Spot 腿，RiskPilot 会退回到协议原生还款或补充抵押清单，并记录无交易。',
        constraints: [
          `在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`,
          '债务偿还或抵押品移动必须在借贷协议中完成，不属于这个仅 DeepBook 的 demo 路径。',
        ],
        riskTradeoffs: [
          '卖出抵押品可能减少上行收益，且单独操作未必足以恢复健康度。',
          '协议特定的还款步骤仍需人工钱包复核。',
          '未知或未定价的类借贷对象不会触发虚假交易。',
        ],
        displayFacts: [
          { label: '已准备市场', value: 'SUI/USDC' },
          { label: '协议步骤', value: '人工还款或抵押品复核' },
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
          '用于借贷健康因子风险的 mainnet DeepBook 降杠杆计划。仅在明确钱包确认后执行。',
      },
    };
  }

  if (lpSignal) {
    const signals = presentSignals([lpSignal]);

    return {
      id: `strategy-${report.portfolioId}-lp-risk-reduction`,
      type: 'lp_risk_reduction',
      title: 'LP 风险降低',
      summary:
        '准备有边界的 mainnet SUI/USDC 动作，以降低 LP 相关下行和无常损失敞口。',
      targetRiskSignalIds: [lpSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'LP 信号显示存在有意义的无常损失敞口，因此计划聚焦在风险 LP 部分主导账本前降低该敞口。',
        applicability:
          '适用于来自已定价流动性仓位的 LP 风险信号，尤其是中高无常损失风险的 SUI/USDC 敞口。',
        fallback:
          '如果当前 adapter 无法表达 LP 撤出，RiskPilot 会记录 LP 退出清单，并将 DeepBook 动作保持为仅 Prepare/不提交。',
        constraints: [
          `在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`,
          'LP 提取和区间管理具有协议特异性，本 demo 不执行。',
        ],
        riskTradeoffs: [
          '降低 LP 敞口可能放弃未来手续费。',
          '部分退出仍可能留下价格和区间残余风险。',
          '未定价的类 LP 对象会被复核，但不会触发虚假 swap。',
        ],
        displayFacts: [
          { label: '已准备市场', value: 'SUI/USDC' },
          { label: '兜底路径', value: 'LP 撤出清单' },
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
          'Mainnet DeepBook LP 风险降低计划。仅在明确钱包确认和 LP 撤出复核后执行。',
      },
    };
  }

  if (stablecoinSignal) {
    const signals = presentSignals([stablecoinSignal]);

    return {
      id: `strategy-${report.portfolioId}-stablecoin-split`,
      type: 'stablecoin_split',
      title: 'Stablecoin 仓位拆分',
      summary: '为单一 stablecoin 脱锚风险准备 DAO 金库拆分复核，不提交资金。',
      targetRiskSignalIds: [stablecoinSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          'Stablecoin 信号显示某个 stablecoin 主导金库仓位，因此推荐会为 DAO 风格脱锚复核准备有边界的分散化步骤。',
        applicability:
          '适用于已定价金库资产中的 stablecoin 集中度和脱锚风险信号；不会作用于未知或未定价币种。',
        fallback:
          '如果没有可支持的 stable-to-stable 场所，RiskPilot 会保持不提交的金库复核，并记录目标拆分 Policy，而不是强制交易。',
        constraints: [
          `在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`,
          '该 demo 只准备 DeepBook 腿；最终 stablecoin 分散化需要获批的支持场所。',
        ],
        riskTradeoffs: [
          '从单一 stablecoin 分散出去，可能因目标资产引入桥、流动性或波动风险。',
          '小规模预备拆分不能完全移除脱锚敞口。',
          '金库运营者仍需批准最终场所和资产列表。',
        ],
        displayFacts: [
          { label: '已准备市场', value: 'USDC/SUI' },
          { label: '金库姿态', value: 'DAO 脱锚复核' },
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
        description: 'Mainnet DeepBook stablecoin 仓位调整。仅在明确钱包确认后执行。',
      },
    };
  }

  if (concentrationSignal) {
    const signals = presentSignals([concentrationSignal]);

    return {
      id: `strategy-${report.portfolioId}-rebalance`,
      type: 'rebalance_concentration',
      title: '集中度降低',
      summary:
        '在任何 Live 执行前，把最大持仓在 mainnet 上再平衡到 USDC，以降低集中度风险。',
      targetRiskSignalIds: [concentrationSignal.id],
      ...buildStrategyMetadata({
        signals,
        rationale:
          '最大已定价持仓超过集中度阈值，因此小规模再平衡可以降低单资产依赖。',
        applicability:
          '适用于存在可映射到已批准 mainnet 路线的已定价资产时的头寸集中度信号。',
        fallback:
          '如果最大资产无法安全路由，RiskPilot 会返回复核路径，而不是替换为无关的 SUI/USDC 交易。',
        constraints: [
          `在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`,
          '只有已定价且可路由资产才是预备再平衡候选。',
        ],
        riskTradeoffs: [
          '再平衡可能减少集中资产的上行收益。',
          '小规模再平衡会降低但不会消除集中度风险。',
          '未知或未定价资产会从交易决策中排除。',
        ],
        displayFacts: [
          { label: '已准备市场', value: 'SUI/USDC' },
          { label: '目标姿态', value: '降低最大资产占比' },
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
        description: 'Mainnet DeepBook 再平衡计划。仅在明确钱包确认后执行。',
      },
    };
  }

  if (portfolio.walletAddress !== '0xDEMO') {
    return {
      id: `strategy-${report.portfolioId}-wallet-review`,
      type: 'wallet_review',
      title: '仅钱包复核',
      summary:
        '已连接 mainnet 钱包没有检测到可执行的已定价 DeFi 风险，因此 RiskPilot 只准备审计记录，不虚构交易。',
      targetRiskSignalIds: [],
      ...buildStrategyMetadata({
        signals: [],
        rationale:
          '已连接钱包没有产生已定价的可执行风险信号，因此创建 SUI/USDC 交易会造成误导。',
        applicability:
          '适用于没有已定价可执行 DeFi 风险的已连接钱包扫描，包括只暴露未知、不支持或未定价对象的钱包。',
        prepareOnlyReason:
          'RiskPilot 准备仅审计的钱包复核。默认没有 DeepBook 订单、没有 Predict 调用，也没有待提交交易。',
        fallback:
          '兜底就是钱包复核本身：记录观察到的对象、定价缺口和不支持仓位，供人工分析，不准备交易。',
        constraints: [
          'amountUsd 必须保持为 0。',
          'market 必须保持为 No trade。',
          '未知或未定价币种不能创建替代 SUI/USDC 交易。',
        ],
        riskTradeoffs: [
          '当协议或资产无法定价时，风险可能被低估。',
          '用户在未来采取任何行动前，可能需要协议特定分析。',
        ],
        displayFacts: [
          { label: '已准备市场', value: 'No trade' },
          { label: '已准备规模', value: displayUsd(0) },
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
          '仅已连接钱包复核。由于钱包没有暴露可执行的已定价风险，不会创建 Live 或已准备的 DeepBook 交易。',
      },
    };
  }

  return {
    id: `strategy-${report.portfolioId}-stablecoin-split`,
    type: 'stablecoin_split',
    title: 'Stablecoin 仓位拆分',
    summary: '为单一 stablecoin 脱锚风险准备 DAO 金库拆分复核，不提交资金。',
    targetRiskSignalIds: report.signals.filter((signal) => signal.category === 'stablecoin').map((signal) => signal.id),
    ...buildStrategyMetadata({
      signals: report.signals.filter((signal) => signal.category === 'stablecoin'),
      rationale:
        'Demo 兜底假设剩余可执行风险是 stablecoin 集中度，因此准备小规模仓位拆分供复核。',
      applicability:
        '仅适用于 demo 模式 Portfolio，且没有选中更高优先级的 SUI、借贷、LP 或集中度信号。',
      fallback:
        '如果没有受支持的 stable-to-stable 路线，RiskPilot 会记录无交易审计路径，不提交交易。',
      constraints: [
        `在当前 Policy 上限下，预算不能超过 ${displayUsd(budgetCapUsd)}。`,
        '该分支仅用于 demo，并保持为 prepare_mainnet。',
      ],
      riskTradeoffs: [
        '分散化可能引入新的资产或路线风险。',
        '小规模拆分不能完全移除脱锚敞口。',
      ],
      displayFacts: [
        { label: '已准备市场', value: 'SUI/USDC' },
        { label: 'Demo 兜底', value: 'Stablecoin 复核' },
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
    description: 'Mainnet DeepBook stablecoin 仓位调整。仅在明确钱包确认后执行。',
  },
};
}
