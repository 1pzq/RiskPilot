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
  const pct = topAsset.usdValue / portfolio.totalUsdValue;

  if (pct <= 0.5) {
    return null;
  }

  const numericScore = Math.min(30, round(12 + pct * 10));

  return {
    id: 'concentration-top-asset',
    title: `${topAsset.symbol} concentration risk`,
    level: pct >= 0.65 ? 'critical' : 'high',
    category: 'concentration',
    summary: `${topAsset.symbol} makes up ${round(pct * 100)}% of the tracked portfolio.`,
    evidence: [
      `Top asset: ${topAsset.symbol}`,
      `Tracked share: ${round(pct * 100)}%`,
      `Tracked value: $${round(topAsset.usdValue)}`,
    ],
    numericScore,
  };
}

function scoreSuiDownside(portfolio: PortfolioSnapshot): RiskSignal | null {
  const directSui = portfolio.assets.find((asset) => asset.symbol === 'SUI')?.usdValue ?? 0;
  const exposure = getSuiExposure(portfolio);
  const pct = exposure / portfolio.totalUsdValue;

  if (pct <= 0.5) {
    return null;
  }

  return {
    id: 'sui-downside',
    title: 'SUI downside exposure',
    level: pct >= 0.65 ? 'critical' : 'high',
    category: 'price',
    summary: `SUI-linked exposure is ${round(pct * 100)}% of the portfolio, so a drawdown would hit hard.`,
    evidence: [
      `Direct SUI value: $${round(directSui)}`,
      `LP-linked SUI exposure: $${round(exposure - directSui)}`,
      `Total SUI exposure: $${round(exposure)}`,
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
    title: `${stable.symbol} stablecoin concentration`,
    level: 'medium',
    category: 'stablecoin',
    summary: `${stable.symbol} represents ${round(share * 100)}% of the stablecoin sleeve.`,
    evidence: [
      `Stablecoin sleeve value: $${round(stable.total)}`,
      `Largest stablecoin: ${stable.symbol}`,
      `Largest share: ${round(share * 100)}%`,
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
    title: `${weakest.protocol} liquidation risk`,
    level,
    category: 'liquidation',
    summary: `The lending position is close enough to liquidation to matter in a modest drawdown.`,
    evidence: [
      `Collateral: $${round(weakest.collateralUsd)} ${weakest.collateralSymbol}`,
      `Debt: $${round(weakest.debtUsd)} ${weakest.debtSymbol}`,
      `Health factor: ${weakest.healthFactor.toFixed(2)}`,
    ],
    numericScore: weakest.healthFactor < 1.3 ? 20 : 16,
  };
}

function scoreLiquidityRisk(portfolio: PortfolioSnapshot): RiskSignal | null {
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
    title: `${highest.protocol} LP impermanent loss risk`,
    level,
    category: 'lp',
    summary: `The ${highest.pair} position is large enough that impermanent loss could dent the book.`,
    evidence: [
      `LP value: $${round(highest.usdValue)}`,
      `Portfolio share: ${round(share * 100)}%`,
      `Risk tag: ${highest.estimatedImpermanentLossRisk}`,
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
      estimatedLossPct: round((getSuiExposure(portfolio) * 0.1 / portfolio.totalUsdValue) * 100),
    },
    {
      scenario: 'SUI -20%',
      estimatedLossUsd: round(getSuiExposure(portfolio) * 0.2),
      estimatedLossPct: round((getSuiExposure(portfolio) * 0.2 / portfolio.totalUsdValue) * 100),
    },
    {
      scenario: 'Stablecoin depeg -5%',
      estimatedLossUsd: round(getStableExposure(portfolio).total * 0.05),
      estimatedLossPct: round((getStableExposure(portfolio).total * 0.05 / portfolio.totalUsdValue) * 100),
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
