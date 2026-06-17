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
    label: 'SUI 回撤 -8%',
    shortLabel: 'SUI -8%',
    category: 'price',
    summary: '在中等回撤后，重新定价直接 SUI、SUI 相关 LP 腿和 SUI 抵押品。',
    intensityLabel: '中等冲击',
  },
  {
    id: 'sui_drawdown_15',
    label: 'SUI 回撤 -15%',
    shortLabel: 'SUI -15%',
    category: 'price',
    summary: '在更剧烈回撤后，压力测试直接 SUI、SUI 相关 LP 腿和 SUI 抵押品。',
    intensityLabel: '严重冲击',
  },
  {
    id: 'deepbook_liquidity_thin',
    label: 'DeepBook 流动性变薄',
    shortLabel: '流动性变薄',
    category: 'liquidity',
    summary: '保持钱包资产不变，但标记 DeepBook 路线流动性变薄、执行就绪度降低。',
    intensityLabel: '路线观察',
  },
  {
    id: 'unknown_asset_inflow',
    label: '未知资产流入',
    shortLabel: '未知资产',
    category: 'wallet',
    summary: '加入一个未定价钱包资产，用于测试已连接钱包复核中的不虚构交易行为。',
    intensityLabel: '对象风险',
  },
  {
    id: 'lending_health_slip',
    label: '借贷健康度下滑',
    shortLabel: 'HF 下滑',
    category: 'lending',
    summary: '降低借贷抵押品价值和健康因子，以模拟清算压力。',
    intensityLabel: '清算观察',
  },
  {
    id: 'policy_budget_cut',
    label: 'Policy 预算削减',
    shortLabel: '预算削减',
    category: 'policy',
    summary: '收紧 Policy 预算上限，以测试计划动作是否会被阻断。',
    intensityLabel: 'Policy 冲击',
  },
  {
    id: 'deepbook_unavailable',
    label: 'DeepBook 不可用',
    shortLabel: '市场不可用',
    category: 'market',
    summary: '强制 DeepBook 市场证据不可用，同时保持核心风险分析确定性。',
    intensityLabel: '市场中断',
  },
];

export const DEFAULT_WHAT_IF_SCENARIO_ID: WhatIfScenarioId = 'sui_drawdown_8';

export function getWhatIfScenario(id: WhatIfScenarioId): WhatIfScenario {
  return WHAT_IF_SCENARIOS.find((scenario) => scenario.id === id) ?? WHAT_IF_SCENARIOS[0];
}
