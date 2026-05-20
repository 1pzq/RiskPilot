import type { AssetBalance, PortfolioSnapshot } from '../risk/types';
import { DEMO_SUI_PRICE_USD } from '../risk/fixtures';
import { SUI_COIN_TYPE, createMainnetSuiClient } from './client';

type CoinBalanceLike = {
  coinType: string;
  totalBalance: string;
};

type CoinMetadataLike = {
  decimals?: number | null;
  name?: string | null;
  symbol?: string | null;
};

export type MainnetPortfolioClient = {
  getAllBalances(input: { owner: string }): Promise<CoinBalanceLike[]>;
  getBalance(input: { owner: string; coinType?: string }): Promise<CoinBalanceLike>;
  getCoinMetadata(input: { coinType: string }): Promise<CoinMetadataLike | null>;
};

const PRICE_MAP: Record<string, number> = {
  SUI: DEMO_SUI_PRICE_USD,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  WAL: 0.75,
  CETUS: 0.2,
};

const KNOWN_COIN_TYPES: Record<string, { symbol: string; decimals: number }> = {
  [SUI_COIN_TYPE]: { symbol: 'SUI', decimals: 9 },
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC': {
    symbol: 'USDC',
    decimals: 6,
  },
};

export function priceForSymbol(symbol: string): number {
  return PRICE_MAP[symbol.toUpperCase()] ?? 1;
}

function fallbackSymbolFromCoinType(coinType: string): string {
  const known = KNOWN_COIN_TYPES[coinType];

  if (known) {
    return known.symbol;
  }

  const maybeSymbol = coinType.split('::').at(-1);

  if (maybeSymbol && maybeSymbol.length <= 12 && /^[A-Z0-9_]+$/u.test(maybeSymbol)) {
    return maybeSymbol;
  }

  return 'Unknown Token';
}

function decimalsForCoin(coinType: string, metadata?: CoinMetadataLike | null): number {
  const metadataDecimals = metadata?.decimals;

  if (typeof metadataDecimals === 'number' && metadataDecimals >= 0 && metadataDecimals <= 18) {
    return metadataDecimals;
  }

  return KNOWN_COIN_TYPES[coinType]?.decimals ?? 9;
}

function amountFromAtomicBalance(totalBalance: string, decimals: number): number {
  const parsed = Number(totalBalance);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed / 10 ** decimals;
}

export function recalcAssetValue(asset: AssetBalance): AssetBalance {
  const usdPrice = priceForSymbol(asset.symbol);
  return {
    ...asset,
    usdPrice,
    usdValue: asset.amount * usdPrice,
  };
}

export function coinBalanceToAsset(
  balance: CoinBalanceLike,
  metadata?: CoinMetadataLike | null,
): AssetBalance {
  const known = KNOWN_COIN_TYPES[balance.coinType];
  const symbol = metadata?.symbol?.trim() || known?.symbol || fallbackSymbolFromCoinType(balance.coinType);
  const decimals = decimalsForCoin(balance.coinType, metadata);
  const amount = amountFromAtomicBalance(balance.totalBalance, decimals);
  const usdPrice = priceForSymbol(symbol);

  return {
    symbol,
    coinType: balance.coinType,
    amount,
    usdPrice,
    usdValue: amount * usdPrice,
  };
}

function shouldMergeAssets(base: AssetBalance, walletAsset: AssetBalance): boolean {
  return base.coinType === walletAsset.coinType || base.symbol === walletAsset.symbol;
}

export function mergeWalletAssetsWithDemoPortfolio(
  portfolio: PortfolioSnapshot,
  walletAssets: AssetBalance[] | null,
): PortfolioSnapshot {
  if (!walletAssets || walletAssets.length === 0) {
    return portfolio;
  }

  const unusedWalletAssets = new Set(walletAssets.map((asset) => asset.coinType));

  const assets = portfolio.assets.map((asset) => {
    const walletAsset = walletAssets.find((candidate) => shouldMergeAssets(asset, candidate));

    if (!walletAsset) {
      return asset;
    }

    unusedWalletAssets.delete(walletAsset.coinType);
    const amount = asset.amount + walletAsset.amount;
    const usdPrice = walletAsset.usdPrice || asset.usdPrice;
    return {
      ...asset,
      coinType: walletAsset.coinType === SUI_COIN_TYPE ? asset.coinType : walletAsset.coinType,
      amount,
      usdPrice,
      usdValue: amount * usdPrice,
    };
  });

  for (const walletAsset of walletAssets) {
    if (unusedWalletAssets.has(walletAsset.coinType) && walletAsset.amount > 0) {
      assets.push(walletAsset);
    }
  }

  return {
    ...portfolio,
    assets,
    totalUsdValue: assets.reduce((sum, asset) => sum + asset.usdValue, 0),
  };
}

export function mergeWalletSuiBalance(portfolio: PortfolioSnapshot, walletSuiBalance: number | null): PortfolioSnapshot {
  if (walletSuiBalance == null) {
    return portfolio;
  }

  return mergeWalletAssetsWithDemoPortfolio(portfolio, [
    {
      symbol: 'SUI',
      coinType: SUI_COIN_TYPE,
      amount: walletSuiBalance,
      usdPrice: DEMO_SUI_PRICE_USD,
      usdValue: walletSuiBalance * DEMO_SUI_PRICE_USD,
    },
  ]);
}

export async function readMainnetWalletAssets(
  owner: string,
  client: MainnetPortfolioClient = createMainnetSuiClient(),
): Promise<AssetBalance[]> {
  const balances = await client.getAllBalances({ owner });

  return Promise.all(
    balances
      .filter((balance) => Number(balance.totalBalance) > 0)
      .map(async (balance) => {
        const metadata = await client.getCoinMetadata({ coinType: balance.coinType }).catch(() => null);
        return coinBalanceToAsset(balance, metadata);
      }),
  );
}

export async function readMainnetSuiBalance(owner: string): Promise<number> {
  const client = createMainnetSuiClient();
  const balance = await client.getBalance({ owner, coinType: SUI_COIN_TYPE });

  return Number(balance.totalBalance) / 1_000_000_000;
}

export function describePortfolioSource(walletAddress: string): 'demo' | 'wallet-merged' {
  return walletAddress === '0xDEMO' ? 'demo' : 'wallet-merged';
}
