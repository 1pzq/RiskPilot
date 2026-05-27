import type { PortfolioSnapshot, RiskReport } from './types';

export type WhatIfScenarioId =
  | 'sui_drawdown_8'
  | 'sui_drawdown_15'
  | 'deepbook_liquidity_thin'
  | 'unknown_asset_inflow'
  | 'lending_health_slip'
  | 'policy_budget_cut'
  | 'deepbook_unavailable';

export type WhatIfScenarioCategory = 'price' | 'liquidity' | 'wallet' | 'lending' | 'policy' | 'market';

export type WhatIfScenario = {
  id: WhatIfScenarioId;
  label: string;
  shortLabel: string;
  category: WhatIfScenarioCategory;
  summary: string;
  intensityLabel: string;
};

export type WhatIfMarketOverride = {
  deepbookStatus?: 'ready' | 'unavailable';
  routeStatus?: 'idle' | 'loading' | 'ready' | 'error';
  fallbackReason?: string;
  liquidityHaircutPct?: number;
};

export type WhatIfPolicyOverride = {
  maxBudgetMultiplier?: number;
  maxSingleTradeMultiplier?: number;
};

export type WhatIfDelta = {
  scoreDelta: number;
  totalValueDeltaUsd: number;
  activeSignalDelta: number;
  topNewSignal?: string;
  policyNote?: string;
  marketNote?: string;
};

export type WhatIfSimulation = {
  scenario: WhatIfScenario;
  basePortfolio: PortfolioSnapshot;
  simulatedPortfolio: PortfolioSnapshot;
  baseRiskReport: RiskReport;
  simulatedRiskReport: RiskReport;
  delta: WhatIfDelta;
  marketOverride?: WhatIfMarketOverride;
  policyOverride?: WhatIfPolicyOverride;
  previewOnly: true;
};

export const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: 'sui_drawdown_8',
    label: 'SUI drawdown -8%',
    shortLabel: 'SUI -8%',
    category: 'price',
    summary: 'Reprice direct SUI, SUI-linked LP legs, and SUI collateral after a moderate drawdown.',
    intensityLabel: 'Moderate shock',
  },
  {
    id: 'sui_drawdown_15',
    label: 'SUI drawdown -15%',
    shortLabel: 'SUI -15%',
    category: 'price',
    summary: 'Stress direct SUI, SUI-linked LP legs, and SUI collateral after a sharper drawdown.',
    intensityLabel: 'Severe shock',
  },
  {
    id: 'deepbook_liquidity_thin',
    label: 'DeepBook liquidity thins',
    shortLabel: 'Thin liquidity',
    category: 'liquidity',
    summary: 'Keep wallet assets unchanged but mark the DeepBook route as thinner and less execution-ready.',
    intensityLabel: 'Route watch',
  },
  {
    id: 'unknown_asset_inflow',
    label: 'Unknown asset inflow',
    shortLabel: 'Unknown asset',
    category: 'wallet',
    summary: 'Add an unpriced wallet asset to test no-fake-trade behavior in connected-style review.',
    intensityLabel: 'Object risk',
  },
  {
    id: 'lending_health_slip',
    label: 'Lending health slips',
    shortLabel: 'HF slips',
    category: 'lending',
    summary: 'Reduce lending collateral value and health factor to simulate liquidation pressure.',
    intensityLabel: 'Liquidation watch',
  },
  {
    id: 'policy_budget_cut',
    label: 'Policy budget cut',
    shortLabel: 'Budget cut',
    category: 'policy',
    summary: 'Shrink policy budget caps to test whether the planned action becomes blocked.',
    intensityLabel: 'Policy shock',
  },
  {
    id: 'deepbook_unavailable',
    label: 'DeepBook unavailable',
    shortLabel: 'Market down',
    category: 'market',
    summary: 'Force DeepBook market evidence unavailable while keeping core risk analysis deterministic.',
    intensityLabel: 'Market outage',
  },
];

export const DEFAULT_WHAT_IF_SCENARIO_ID: WhatIfScenarioId = 'sui_drawdown_8';

export function getWhatIfScenario(id: WhatIfScenarioId): WhatIfScenario {
  return WHAT_IF_SCENARIOS.find((scenario) => scenario.id === id) ?? WHAT_IF_SCENARIOS[0];
}
