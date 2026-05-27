import { calculateRiskReport } from './risk-engine';
import type { AssetBalance, LendingPosition, LiquidityPosition, PortfolioSnapshot } from './types';
import {
  DEFAULT_WHAT_IF_SCENARIO_ID,
  getWhatIfScenario,
  type WhatIfMarketOverride,
  type WhatIfPolicyOverride,
  type WhatIfScenarioId,
  type WhatIfSimulation,
} from './what-if-scenarios';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clonePortfolio(portfolio: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...portfolio,
    assets: portfolio.assets.map((asset) => ({ ...asset })),
    lendingPositions: portfolio.lendingPositions.map((position) => ({ ...position })),
    liquidityPositions: portfolio.liquidityPositions.map((position) => ({ ...position })),
    walletScan: portfolio.walletScan
      ? {
          ...portfolio.walletScan,
          protocolHints: portfolio.walletScan.protocolHints.map((hint) => ({
            ...hint,
            roles: [...hint.roles],
          })),
          sampleObjects: portfolio.walletScan.sampleObjects.map((object) => ({
            ...object,
            facts: object.facts.map((fact) => ({ ...fact })),
          })),
        }
      : undefined,
  };
}

function recalculateTotal(portfolio: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...portfolio,
    totalUsdValue: round(portfolio.assets.reduce((sum, asset) => sum + asset.usdValue, 0)),
  };
}

function isSuiLinked(symbol: string): boolean {
  return symbol.toUpperCase().includes('SUI');
}

function repriceSuiAsset(asset: AssetBalance, drawdownPct: number): AssetBalance {
  if (!isSuiLinked(asset.symbol)) {
    return asset;
  }

  const nextPrice = asset.symbol === 'SUI' ? round(asset.usdPrice * (1 - drawdownPct / 100)) : asset.usdPrice;
  const nextValue = round(asset.usdValue * (1 - drawdownPct / 100));

  return {
    ...asset,
    usdPrice: nextPrice,
    usdValue: nextValue,
  };
}

function stressLiquidityPosition(position: LiquidityPosition, drawdownPct: number): LiquidityPosition {
  if (!isSuiLinked(position.pair)) {
    return position;
  }

  const stressedSuiLeg = round(position.tokenAExposureUsd * (1 - drawdownPct / 100));
  const usdValue = round(stressedSuiLeg + position.tokenBExposureUsd);

  return {
    ...position,
    tokenAExposureUsd: stressedSuiLeg,
    usdValue,
    estimatedImpermanentLossRisk: drawdownPct >= 12 ? 'high' : position.estimatedImpermanentLossRisk,
  };
}

function stressLendingPosition(position: LendingPosition, drawdownPct: number): LendingPosition {
  if (!isSuiLinked(position.collateralSymbol)) {
    return position;
  }

  const collateralUsd = round(position.collateralUsd * (1 - drawdownPct / 100));
  const healthFactor = position.debtUsd > 0 ? round((collateralUsd / position.debtUsd) * 1.0) : position.healthFactor;

  return {
    ...position,
    collateralUsd,
    healthFactor: Math.min(position.healthFactor, healthFactor),
  };
}

function applySuiDrawdown(portfolio: PortfolioSnapshot, drawdownPct: number): PortfolioSnapshot {
  return recalculateTotal({
    ...portfolio,
    timestamp: new Date().toISOString(),
    assets: portfolio.assets.map((asset) => repriceSuiAsset(asset, drawdownPct)),
    liquidityPositions: portfolio.liquidityPositions.map((position) => stressLiquidityPosition(position, drawdownPct)),
    lendingPositions: portfolio.lendingPositions.map((position) => stressLendingPosition(position, drawdownPct)),
  });
}

function applyUnknownAssetInflow(portfolio: PortfolioSnapshot): PortfolioSnapshot {
  const unknownAsset: AssetBalance = {
    symbol: 'UNKNOWN',
    coinType: '0xwhatif::unknown::UNKNOWN',
    amount: 128,
    usdPrice: 0,
    usdValue: 0,
  };

  return recalculateTotal({
    ...portfolio,
    timestamp: new Date().toISOString(),
    assets: [...portfolio.assets, unknownAsset],
  });
}

function applyLendingHealthSlip(portfolio: PortfolioSnapshot): PortfolioSnapshot {
  return recalculateTotal({
    ...portfolio,
    timestamp: new Date().toISOString(),
    lendingPositions: portfolio.lendingPositions.length > 0
      ? portfolio.lendingPositions.map((position, index) =>
          index === 0
            ? {
                ...position,
                collateralUsd: round(position.collateralUsd * 0.88),
                healthFactor: round(Math.max(1.05, position.healthFactor - 0.28)),
              }
            : position,
        )
      : [
          {
            protocol: 'What-if lending desk',
            collateralSymbol: 'SUI',
            collateralUsd: 28,
            debtSymbol: 'USDC',
            debtUsd: 24,
            healthFactor: 1.16,
          },
        ],
  });
}

function buildDelta(base: PortfolioSnapshot, simulated: PortfolioSnapshot) {
  const baseRiskReport = calculateRiskReport(base);
  const simulatedRiskReport = calculateRiskReport(simulated);
  const baseSignalIds = new Set(baseRiskReport.signals.map((signal) => signal.id));
  const topNewSignal = simulatedRiskReport.signals.find((signal) => !baseSignalIds.has(signal.id));

  return {
    baseRiskReport,
    simulatedRiskReport,
    delta: {
      scoreDelta: simulatedRiskReport.overallScore - baseRiskReport.overallScore,
      totalValueDeltaUsd: round(simulated.totalUsdValue - base.totalUsdValue),
      activeSignalDelta: simulatedRiskReport.signals.length - baseRiskReport.signals.length,
      topNewSignal: topNewSignal?.title,
    },
  };
}

export function buildWhatIfSimulation(
  portfolio: PortfolioSnapshot,
  scenarioId: WhatIfScenarioId = DEFAULT_WHAT_IF_SCENARIO_ID,
): WhatIfSimulation {
  const scenario = getWhatIfScenario(scenarioId);
  const basePortfolio = clonePortfolio(portfolio);
  let simulatedPortfolio = clonePortfolio(portfolio);
  let marketOverride: WhatIfMarketOverride | undefined;
  let policyOverride: WhatIfPolicyOverride | undefined;

  if (scenario.id === 'sui_drawdown_8') {
    simulatedPortfolio = applySuiDrawdown(simulatedPortfolio, 8);
  } else if (scenario.id === 'sui_drawdown_15') {
    simulatedPortfolio = applySuiDrawdown(simulatedPortfolio, 15);
  } else if (scenario.id === 'deepbook_liquidity_thin') {
    marketOverride = {
      deepbookStatus: 'ready',
      routeStatus: 'ready',
      liquidityHaircutPct: 55,
      fallbackReason: 'What-if preview: DeepBook liquidity is thinner, so execution stays prepare-only.',
    };
  } else if (scenario.id === 'unknown_asset_inflow') {
    simulatedPortfolio = applyUnknownAssetInflow(simulatedPortfolio);
  } else if (scenario.id === 'lending_health_slip') {
    simulatedPortfolio = applyLendingHealthSlip(simulatedPortfolio);
  } else if (scenario.id === 'policy_budget_cut') {
    policyOverride = {
      maxBudgetMultiplier: 0.5,
      maxSingleTradeMultiplier: 0.5,
    };
  } else if (scenario.id === 'deepbook_unavailable') {
    marketOverride = {
      deepbookStatus: 'unavailable',
      routeStatus: 'error',
      fallbackReason: 'What-if preview: DeepBook market evidence is unavailable.',
    };
  }

  const { baseRiskReport, simulatedRiskReport, delta } = buildDelta(basePortfolio, simulatedPortfolio);
  const previewRiskReport = {
    ...simulatedRiskReport,
    estimated: true,
  };

  return {
    scenario,
    basePortfolio,
    simulatedPortfolio,
    baseRiskReport,
    simulatedRiskReport: previewRiskReport,
    delta: {
      ...delta,
      policyNote: policyOverride ? 'Policy caps are tightened by 50% for this preview.' : undefined,
      marketNote: marketOverride?.fallbackReason,
    },
    marketOverride,
    policyOverride,
    previewOnly: true,
  };
}
