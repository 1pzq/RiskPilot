import type {
  LendingPosition,
  LiquidityPosition,
  PortfolioSnapshot,
  RiskLevel,
  RiskReport,
  RiskSignal,
} from './types';

function levelFromScore(score: number): RiskLevel {
  if (score >= 75) {
    return 'critical';
  }

  if (score >= 50) {
    return 'high';
  }

  if (score >= 25) {
    return 'medium';
  }

  return 'low';
}

function pushSignal(signals: RiskSignal[], signal: RiskSignal | null) {
  if (signal) {
    signals.push(signal);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isStableSymbol(symbol: string): boolean {
  return ['USDC', 'USDT', 'USDS', 'DAI', 'BUIDL'].includes(symbol.toUpperCase());
}

function getSuiExposure(portfolio: PortfolioSnapshot): number {
  const directSui = portfolio.assets.find((asset) => asset.symbol === 'SUI')?.usdValue ?? 0;
  const lpSuiExposure = portfolio.liquidityPositions.reduce((sum, position) => {
    if (!position.pair.toUpperCase().includes('SUI')) {
      return sum;
    }

    return sum + position.tokenAExposureUsd;
  }, 0);

  return directSui + lpSuiExposure;
}

function getStableExposure(portfolio: PortfolioSnapshot): { total: number; largest: number; symbol: string } {
  const stableAssets = portfolio.assets.filter((asset) => isStableSymbol(asset.symbol));

  const total = stableAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
  const sorted = stableAssets.slice().sort((left, right) => right.usdValue - left.usdValue);
  const largest = sorted[0];

  return {
    total,
    largest: largest?.usdValue ?? 0,
    symbol: largest?.symbol ?? 'USDC',
  };
}

function scoreConcentration(portfolio: PortfolioSnapshot, topAsset: { symbol: string; usdValue: number }): RiskSignal | null {
  if (portfolio.totalUsdValue <= 0) {
    return null;
  }

  const pct = topAsset.usdValue / portfolio.totalUsdValue;

  if (pct <= 0.5) {
    return null;
  }

  const numericScore = Math.min(30, round(12 + pct * 10));

  return {
    id: 'concentration-top-asset',
    title: `${topAsset.symbol} 集中度风险`,
    level: pct >= 0.65 ? 'critical' : 'high',
    category: 'concentration',
    summary: `${topAsset.symbol} 占已跟踪 Portfolio 的 ${round(pct * 100)}%。`,
    evidence: [
      `最大资产：${topAsset.symbol}`,
      `已跟踪占比：${round(pct * 100)}%`,
      `已跟踪价值：$${round(topAsset.usdValue)}`,
    ],
    numericScore,
  };
}

function scoreSuiDownside(portfolio: PortfolioSnapshot): RiskSignal | null {
  if (portfolio.totalUsdValue <= 0) {
    return null;
  }

  const directSui = portfolio.assets.find((asset) => asset.symbol === 'SUI')?.usdValue ?? 0;
  const exposure = getSuiExposure(portfolio);
  const pct = exposure / portfolio.totalUsdValue;

  if (pct <= 0.5) {
    return null;
  }

  return {
    id: 'sui-downside',
    title: 'SUI 下行敞口',
    level: pct >= 0.65 ? 'critical' : 'high',
    category: 'price',
    summary: `SUI 相关敞口占 Portfolio 的 ${round(pct * 100)}%，回撤会造成明显冲击。`,
    evidence: [
      `直接 SUI 价值：$${round(directSui)}`,
      `LP 相关 SUI 敞口：$${round(exposure - directSui)}`,
      `总 SUI 敞口：$${round(exposure)}`,
    ],
    numericScore: Math.min(30, round(14 + pct * 10)),
  };
}

function scoreStablecoinConcentration(portfolio: PortfolioSnapshot): RiskSignal | null {
  const stable = getStableExposure(portfolio);

  if (stable.total <= 0) {
    return null;
  }

  const share = stable.largest / stable.total;

  if (share <= 0.8) {
    return null;
  }

  return {
    id: 'stablecoin-concentration',
    title: `${stable.symbol} stablecoin 集中度`,
    level: 'medium',
    category: 'stablecoin',
    summary: `${stable.symbol} 占 stablecoin 仓位的 ${round(share * 100)}%。`,
    evidence: [
      `Stablecoin 仓位价值：$${round(stable.total)}`,
      `最大 stablecoin：${stable.symbol}`,
      `最大占比：${round(share * 100)}%`,
    ],
    numericScore: 10,
  };
}

function scoreLendingRisk(portfolio: PortfolioSnapshot): RiskSignal | null {
  const weakest = portfolio.lendingPositions.reduce<LendingPosition | null>((lowest, position) => {
    if (!lowest || position.healthFactor < lowest.healthFactor) {
      return position;
    }

    return lowest;
  }, null);

  if (!weakest) {
    return null;
  }

  if (weakest.healthFactor >= 1.6) {
    return null;
  }

  const level: RiskLevel = weakest.healthFactor < 1.3 ? 'critical' : 'high';

  return {
    id: 'lending-health',
    title: `${weakest.protocol} 清算风险`,
    level,
    category: 'liquidation',
    summary: '该借贷仓位已经接近清算区间，中等回撤也值得关注。',
    evidence: [
      `抵押品：$${round(weakest.collateralUsd)} ${weakest.collateralSymbol}`,
      `债务：$${round(weakest.debtUsd)} ${weakest.debtSymbol}`,
      `健康因子：${weakest.healthFactor.toFixed(2)}`,
    ],
    numericScore: weakest.healthFactor < 1.3 ? 20 : 16,
  };
}

function scoreLiquidityRisk(portfolio: PortfolioSnapshot): RiskSignal | null {
  if (portfolio.totalUsdValue <= 0) {
    return null;
  }

  const highest = portfolio.liquidityPositions.reduce<LiquidityPosition | null>((best, position) => {
    if (!best || position.usdValue > best.usdValue) {
      return position;
    }

    return best;
  }, null);

  if (!highest || highest.estimatedImpermanentLossRisk === 'low') {
    return null;
  }

  const share = highest.usdValue / portfolio.totalUsdValue;
  const level: RiskLevel = highest.estimatedImpermanentLossRisk === 'high' && share >= 0.08 ? 'high' : 'medium';

  return {
    id: 'lp-impermanent-loss',
    title: `${highest.protocol} LP 无常损失风险`,
    level,
    category: 'lp',
    summary: `${highest.pair} 仓位规模已经足够大，无常损失可能影响账本。`,
    evidence: [
      `LP 价值：$${round(highest.usdValue)}`,
      `Portfolio 占比：${round(share * 100)}%`,
      `风险标签：${highest.estimatedImpermanentLossRisk}`,
    ],
    numericScore: highest.estimatedImpermanentLossRisk === 'high' && share >= 0.08 ? 10 : 6,
  };
}

function overallScoreFromSignals(signals: RiskSignal[]): number {
  const score = signals.reduce((sum, signal) => sum + signal.numericScore, 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRiskReport(portfolio: PortfolioSnapshot): RiskReport {
  const signals: RiskSignal[] = [];
  const topAsset = portfolio.assets.slice().sort((left, right) => right.usdValue - left.usdValue)[0];

  if (topAsset) {
    pushSignal(signals, scoreConcentration(portfolio, topAsset));
  }

  pushSignal(signals, scoreSuiDownside(portfolio));
  pushSignal(signals, scoreStablecoinConcentration(portfolio));
  pushSignal(signals, scoreLendingRisk(portfolio));
  pushSignal(signals, scoreLiquidityRisk(portfolio));

  const overallScore = overallScoreFromSignals(signals);

  const scenarioResults = [
    {
      scenario: 'SUI -10%',
      estimatedLossUsd: round(getSuiExposure(portfolio) * 0.1),
      estimatedLossPct: portfolio.totalUsdValue > 0 ? round((getSuiExposure(portfolio) * 0.1 / portfolio.totalUsdValue) * 100) : 0,
    },
    {
      scenario: 'SUI -20%',
      estimatedLossUsd: round(getSuiExposure(portfolio) * 0.2),
      estimatedLossPct: portfolio.totalUsdValue > 0 ? round((getSuiExposure(portfolio) * 0.2 / portfolio.totalUsdValue) * 100) : 0,
    },
    {
      scenario: 'Stablecoin 脱锚 -5%',
      estimatedLossUsd: round(getStableExposure(portfolio).total * 0.05),
      estimatedLossPct: portfolio.totalUsdValue > 0 ? round((getStableExposure(portfolio).total * 0.05 / portfolio.totalUsdValue) * 100) : 0,
    },
  ];

  return {
    portfolioId: portfolio.walletAddress,
    overallScore,
    overallLevel: levelFromScore(overallScore),
    signals,
    scenarioResults,
  };
}

export function estimatePostStrategyRisk(report: RiskReport, reductionPercent: number): RiskReport {
  const reduction = Math.max(0, Math.min(100, reductionPercent)) / 100;
  const signals = report.signals.map((signal) => ({
    ...signal,
    numericScore: signal.id === 'sui-downside' || signal.category === 'concentration' ? Math.max(0, Math.round(signal.numericScore * (1 - reduction))) : signal.numericScore,
  }));

  const overallScore = overallScoreFromSignals(signals);

  return {
    ...report,
    overallScore,
    overallLevel: levelFromScore(overallScore),
    signals,
    estimated: true,
  };
}
