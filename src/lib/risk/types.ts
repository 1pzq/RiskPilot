export type AssetBalance = {
  symbol: string;
  coinType: string;
  amount: number;
  usdPrice: number;
  usdValue: number;
};

export type WalletObjectKind =
  | 'coin'
  | 'walrus_blob'
  | 'riskpilot_receipt'
  | 'defi_candidate'
  | 'package_cap'
  | 'other';

export type WalletObjectSummary = {
  objectId: string;
  type: string;
  label: string;
  kind: WalletObjectKind;
  protocol: string;
  role: string;
  facts: {
    label: string;
    value: string;
  }[];
  packageId?: string;
  module?: string;
  version?: string;
  previousTransaction?: string;
  storageRebateMist?: string;
};

export type WalletScanSummary = {
  owner: string;
  scannedAt: string;
  totalObjects: number;
  coinObjects: number;
  walrusBlobs: number;
  receiptObjects: number;
  defiCandidates: number;
  packageCaps: number;
  protocolHints: {
    protocol: string;
    count: number;
    roles: string[];
  }[];
  sampleObjects: WalletObjectSummary[];
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
  walletScan?: WalletScanSummary;
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
