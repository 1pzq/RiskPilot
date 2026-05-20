import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '../lib/risk/fixtures';
import {
  coinBalanceToAsset,
  mergeWalletAssetsWithDemoPortfolio,
  readMainnetWalletAssets,
  type MainnetPortfolioClient,
} from '../lib/sui/portfolio';

describe('mainnet portfolio helpers', () => {
  it('maps known balances into priced assets', () => {
    const asset = coinBalanceToAsset(
      {
        coinType: '0x2::sui::SUI',
        totalBalance: '2500000000',
      },
      null,
    );

    expect(asset.symbol).toBe('SUI');
    expect(asset.amount).toBe(2.5);
    expect(asset.usdValue).toBeGreaterThan(0);
  });

  it('falls back to Unknown Token when metadata is unavailable', () => {
    const asset = coinBalanceToAsset(
      {
        coinType: '0x123::odd::coin',
        totalBalance: '1000000000',
      },
      null,
    );

    expect(asset.symbol).toBe('Unknown Token');
    expect(asset.usdPrice).toBe(1);
  });

  it('merges wallet assets into the demo portfolio without dropping mock positions', () => {
    const portfolio = createDemoPortfolio('0xREAL', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const merged = mergeWalletAssetsWithDemoPortfolio(portfolio, [
      {
        symbol: 'SUI',
        coinType: '0x2::sui::SUI',
        amount: 2,
        usdPrice: 3.25,
        usdValue: 6.5,
      },
      {
        symbol: 'Unknown Token',
        coinType: '0x123::odd::coin',
        amount: 1,
        usdPrice: 1,
        usdValue: 1,
      },
    ]);

    expect(merged.assets.find((asset) => asset.symbol === 'SUI')?.amount).toBe(18);
    expect(merged.assets.find((asset) => asset.coinType === '0x123::odd::coin')).toBeDefined();
    expect(merged.lendingPositions).toHaveLength(1);
    expect(merged.liquidityPositions).toHaveLength(1);
  });

  it('reads all wallet balances through the provided mainnet client', async () => {
    const client: MainnetPortfolioClient = {
      getBalance: async () => ({ coinType: '0x2::sui::SUI', totalBalance: '0' }),
      getAllBalances: async () => [
        {
          coinType: '0x2::sui::SUI',
          totalBalance: '1000000000',
        },
      ],
      getCoinMetadata: async () => ({
        decimals: 9,
        name: 'Sui',
        symbol: 'SUI',
      }),
    };

    await expect(readMainnetWalletAssets('0xREAL', client)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'SUI',
          amount: 1,
        }),
      ]),
    );
  });
});
