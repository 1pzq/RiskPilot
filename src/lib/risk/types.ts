export type AssetBalance = {
  symbol: string;
  coinType: string;
  amount: number;
  usdPrice: number;
  usdValue: number;
};

export type LendingPosition = {
  protocol: string;
  collateralSymbol: string;
  collateralUsd: number;
  debtSymbol: string;
  debtUsd: number;
  healthFactor: number;
};

export type LiquidityPosition = {
  protocol: string;
  pair: string;
  usdValue: number;
  tokenAExposureUsd: number;
  tokenBExposureUsd: number;
  estimatedImpermanentLossRisk: 'low' | 'medium' | 'high';
};

export type PortfolioSnapshot = {
  walletAddress: string;
  timestamp: string;
  assets: AssetBalance[];
  lendingPositions: LendingPosition[];
  liquidityPositions: LiquidityPosition[];
  totalUsdValue: number;
};

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskSignal = {
  id: string;
  title: string;
  level: RiskLevel;
  category: 'concentration' | 'price' | 'liquidation' | 'liquidity' | 'stablecoin' | 'lp';
  summary: string;
  evidence: string[];
  numericScore: number;
};

export type RiskReport = {
  portfolioId: string;
  overallScore: number;
  overallLevel: RiskLevel;
  signals: RiskSignal[];
  scenarioResults: {
    scenario: string;
    estimatedLossUsd: number;
    estimatedLossPct: number;
  }[];
  estimated?: boolean;
};

