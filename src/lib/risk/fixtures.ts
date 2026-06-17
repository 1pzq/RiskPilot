import type { PortfolioSnapshot } from './types';

export const DEMO_SUI_PRICE_USD = 3.25;
export const DEMO_TOTAL_USD = 80;

export type DemoScenarioId =
  | 'conservative_sui_holder'
  | 'leveraged_lending_user'
  | 'lp_impermanent_loss'
  | 'dao_stablecoin_treasury';

export type DemoScenario = {
  id: DemoScenarioId;
  label: string;
  summary: string;
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'conservative_sui_holder',
    label: '保守型 SUI 持有者',
    summary: 'SUI 占比较高的钱包，带有少量 LP 和借贷上下文。',
  },
  {
    id: 'leveraged_lending_user',
    label: '杠杆借贷用户',
    summary: '用 SUI 抵押借入 USDC，健康因子偏紧。',
  },
  {
    id: 'lp_impermanent_loss',
    label: '存在无常损失风险的 LP',
    summary: '较大的 SUI/USDC LP 仓位，带有较高无常损失风险。',
  },
  {
    id: 'dao_stablecoin_treasury',
    label: 'DAO 金库',
    summary: '金库账本集中在单一 stablecoin 仓位。',
  },
];

type ScenarioFixture = Pick<PortfolioSnapshot, 'assets' | 'lendingPositions' | 'liquidityPositions'>;

const scenarioFixtures: Record<DemoScenarioId, ScenarioFixture> = {
  conservative_sui_holder: {
    assets: [
      {
        symbol: 'SUI',
        coinType: '0x2::sui::SUI',
        amount: 16,
        usdPrice: DEMO_SUI_PRICE_USD,
        usdValue: 16 * DEMO_SUI_PRICE_USD,
      },
      {
        symbol: 'USDC',
        coinType: '0x2::usd_coin::USDC',
        amount: 16,
        usdPrice: 1,
        usdValue: 16,
      },
      {
        symbol: 'SUI/USDC LP',
        coinType: '0x0::lp::SUI_USDC',
        amount: 1,
        usdPrice: 8,
        usdValue: 8,
      },
      {
        symbol: 'WAL',
        coinType: '0x0::other::WAL',
        amount: 4,
        usdPrice: 1,
        usdValue: 4,
      },
    ],
    lendingPositions: [
      {
        protocol: 'Scallop',
        collateralSymbol: 'SUI',
        collateralUsd: 30,
        debtSymbol: 'USDC',
        debtUsd: 20.7,
        healthFactor: 1.45,
      },
    ],
    liquidityPositions: [
      {
        protocol: 'Cetus',
        pair: 'SUI/USDC',
        usdValue: 8,
        tokenAExposureUsd: 4,
        tokenBExposureUsd: 4,
        estimatedImpermanentLossRisk: 'high',
      },
    ],
  },
  leveraged_lending_user: {
    assets: [
      {
        symbol: 'SUI',
        coinType: '0x2::sui::SUI',
        amount: 8,
        usdPrice: DEMO_SUI_PRICE_USD,
        usdValue: 26,
      },
      {
        symbol: 'USDC',
        coinType: '0x2::usd_coin::USDC',
        amount: 34,
        usdPrice: 1,
        usdValue: 34,
      },
      {
        symbol: 'WAL',
        coinType: '0x0::other::WAL',
        amount: 20,
        usdPrice: 1,
        usdValue: 20,
      },
    ],
    lendingPositions: [
      {
        protocol: 'Scallop',
        collateralSymbol: 'SUI',
        collateralUsd: 58,
        debtSymbol: 'USDC',
        debtUsd: 47.5,
        healthFactor: 1.22,
      },
    ],
    liquidityPositions: [],
  },
  lp_impermanent_loss: {
    assets: [
      {
        symbol: 'SUI',
        coinType: '0x2::sui::SUI',
        amount: 6,
        usdPrice: DEMO_SUI_PRICE_USD,
        usdValue: 19.5,
      },
      {
        symbol: 'USDC',
        coinType: '0x2::usd_coin::USDC',
        amount: 20.5,
        usdPrice: 1,
        usdValue: 20.5,
      },
      {
        symbol: 'SUI/USDC LP',
        coinType: '0x0::lp::SUI_USDC',
        amount: 1,
        usdPrice: 40,
        usdValue: 40,
      },
    ],
    lendingPositions: [],
    liquidityPositions: [
      {
        protocol: 'Cetus',
        pair: 'SUI/USDC',
        usdValue: 40,
        tokenAExposureUsd: 20,
        tokenBExposureUsd: 20,
        estimatedImpermanentLossRisk: 'high',
      },
    ],
  },
  dao_stablecoin_treasury: {
    assets: [
      {
        symbol: 'USDC',
        coinType: '0x2::usd_coin::USDC',
        amount: 68,
        usdPrice: 1,
        usdValue: 68,
      },
      {
        symbol: 'SUI',
        coinType: '0x2::sui::SUI',
        amount: 2.46,
        usdPrice: DEMO_SUI_PRICE_USD,
        usdValue: 8,
      },
      {
        symbol: 'WAL',
        coinType: '0x0::other::WAL',
        amount: 4,
        usdPrice: 1,
        usdValue: 4,
      },
    ],
    lendingPositions: [],
    liquidityPositions: [],
  },
};

export const DEFAULT_DEMO_SCENARIO_ID: DemoScenarioId = 'conservative_sui_holder';

export function createDemoPortfolio(
  walletAddress: string,
  options?: {
    scenarioId?: DemoScenarioId;
    timestamp?: string;
    walletSuiBalance?: number | null;
  },
): PortfolioSnapshot {
  const timestamp = options?.timestamp ?? new Date().toISOString();
  const scenario = scenarioFixtures[options?.scenarioId ?? DEFAULT_DEMO_SCENARIO_ID];
  const walletSuiBalance = options?.walletSuiBalance ?? null;
  const walletSuiUsd = walletSuiBalance == null ? 0 : walletSuiBalance * DEMO_SUI_PRICE_USD;

  const assets = scenario.assets.map((asset) => {
    if (asset.symbol !== 'SUI') {
      return { ...asset };
    }

    const amount = asset.amount + (walletSuiBalance ?? 0);
    const usdValue = asset.usdValue + walletSuiUsd;

    return {
      ...asset,
      amount,
      usdValue,
    };
  });

  const totalUsdValue = assets.reduce((sum, asset) => sum + asset.usdValue, 0);

  return {
    walletAddress,
    timestamp,
    assets,
    lendingPositions: scenario.lendingPositions.map((position) => ({ ...position })),
    liquidityPositions: scenario.liquidityPositions.map((position) => ({ ...position })),
    totalUsdValue,
  };
}
