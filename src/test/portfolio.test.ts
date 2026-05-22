import { describe, expect, it } from 'vitest';

import { createDemoPortfolio } from '../lib/risk/fixtures';
import {
  buildWalletAssetsPortfolio,
  coinBalanceToAsset,
  mergeWalletAssetsWithDemoPortfolio,
  readMainnetWalletAssets,
  readMainnetWalletScan,
  summarizeOwnedObject,
  type MainnetWalletObjectClient,
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
    expect(asset.usdPrice).toBe(0);
    expect(asset.usdValue).toBe(0);
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
        usdPrice: 0,
        usdValue: 0,
      },
    ]);

    expect(merged.assets.find((asset) => asset.symbol === 'SUI')?.amount).toBe(18);
    expect(merged.assets.find((asset) => asset.coinType === '0x123::odd::coin')).toBeDefined();
    expect(merged.lendingPositions).toHaveLength(1);
    expect(merged.liquidityPositions).toHaveLength(1);
  });

  it('builds a wallet-first portfolio without copying demo assets into the visible wallet balance', () => {
    const portfolio = createDemoPortfolio('0xREAL', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const walletPortfolio = buildWalletAssetsPortfolio(portfolio, [
      {
        symbol: 'SUI',
        coinType: '0x2::sui::SUI',
        amount: 2,
        usdPrice: 3.25,
        usdValue: 6.5,
      },
      {
        symbol: 'SPAM',
        coinType: '0x123::spam::SPAM',
        amount: 1500,
        usdPrice: 0,
        usdValue: 0,
      },
    ]);

    expect(walletPortfolio.assets.map((asset) => asset.symbol)).toEqual(['SUI', 'SPAM']);
    expect(walletPortfolio.totalUsdValue).toBe(6.5);
    expect(walletPortfolio.lendingPositions).toHaveLength(0);
    expect(walletPortfolio.liquidityPositions).toHaveLength(0);
  });

  it('keeps unpriced connected-wallet coins from creating synthetic strategy exposure', () => {
    const portfolio = createDemoPortfolio('0xREAL', {
      timestamp: '2026-05-20T00:00:00.000Z',
    });

    const walletPortfolio = buildWalletAssetsPortfolio(portfolio, [
      {
        symbol: 'SPAM',
        coinType: '0x123::spam::SPAM',
        amount: 1500,
        usdPrice: 0,
        usdValue: 0,
      },
    ]);

    expect(walletPortfolio.assets).toEqual([
      expect.objectContaining({
        symbol: 'SPAM',
        usdPrice: 0,
        usdValue: 0,
      }),
    ]);
    expect(walletPortfolio.totalUsdValue).toBe(0);
    expect(walletPortfolio.lendingPositions).toHaveLength(0);
    expect(walletPortfolio.liquidityPositions).toHaveLength(0);
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

  it('classifies owned mainnet objects for the wallet scan', () => {
    const summary = summarizeOwnedObject({
      data: {
        objectId: '0xblob',
        type: '0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob',
        content: {
          dataType: 'moveObject',
          fields: {
            size: '125',
            registered_epoch: 31,
            certified_epoch: 31,
            storage: {
              start_epoch: 31,
              end_epoch: 32,
            },
          },
        },
        version: '1',
        digest: 'digest',
        previousTransaction: 'tx',
        storageRebate: '1000',
      },
    });

    expect(summary).toMatchObject({
      objectId: '0xblob',
      kind: 'walrus_blob',
      label: 'Walrus Blob',
      protocol: 'Walrus',
      role: 'Audit storage',
      module: 'blob',
    });
    expect(summary?.facts).toEqual(
      expect.arrayContaining([
        { label: 'Size', value: '125 bytes' },
        { label: 'Certified', value: 'epoch 31' },
      ]),
    );
  });

  it('extracts coin object facts without assigning a fake USD value', () => {
    const summary = summarizeOwnedObject({
      data: {
        objectId: '0xcoin',
        type: '0x2::coin::Coin<0x123::spam::SPAM>',
        content: {
          dataType: 'moveObject',
          fields: {
            balance: '999999',
          },
        },
        version: '1',
        digest: 'coin_digest',
      },
    });

    expect(summary).toMatchObject({
      kind: 'coin',
      label: 'SPAM coin object',
      protocol: 'Sui',
      role: 'Coin balance',
      facts: expect.arrayContaining([
        { label: 'Coin type', value: '0x123::spam::SPAM' },
        { label: 'Atomic balance', value: '999999' },
      ]),
    });
  });

  it('classifies DeepBook balance manager objects with useful facts', () => {
    const summary = summarizeOwnedObject({
      data: {
        objectId: '0xdeepbook',
        type: '0xdee9::balance_manager::BalanceManager',
        content: {
          dataType: 'moveObject',
          fields: {
            id: {
              id: '0xdeepbook',
            },
            owner: '0xowner',
            open_orders: ['0xorder1', '0xorder2'],
          },
        },
        version: '7',
        digest: 'deepbook_digest',
      },
    });

    expect(summary).toMatchObject({
      kind: 'deepbook_object',
      label: 'DeepBook Balance Manager',
      protocol: 'DeepBook',
      role: 'DeepBook balance manager',
      module: 'balance_manager',
      facts: expect.arrayContaining([
        { label: 'Module', value: 'balance_manager' },
        { label: 'Struct', value: 'BalanceManager' },
        { label: 'Manager', value: '0xdeepbook' },
        { label: 'Owner', value: '0xowner' },
        { label: 'Orders', value: '0xorder1, 0xorder2' },
      ]),
    });
  });

  it('extracts package cap facts for publisher and upgrade authority objects', () => {
    const summary = summarizeOwnedObject({
      data: {
        objectId: '0xcap',
        type: '0x2::package::UpgradeCap',
        content: {
          dataType: 'moveObject',
          fields: {
            package: '0xpackage',
            version: 4,
            policy: 0,
          },
        },
        version: '9',
        digest: 'cap_digest',
      },
    });

    expect(summary).toMatchObject({
      kind: 'package_cap',
      label: 'Move package cap',
      protocol: 'Sui',
      role: 'Package authority',
      facts: expect.arrayContaining([
        { label: 'Cap type', value: 'UpgradeCap' },
        { label: 'Package', value: '0xpackage' },
        { label: 'Policy', value: '0' },
        { label: 'Cap version', value: '4' },
      ]),
    });
  });

  it('extracts receipt facts from parsed Move object content', () => {
    const summary = summarizeOwnedObject({
      data: {
        objectId: '0xreceipt',
        type: '0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19::strategy_receipt::StrategyReceipt',
        content: {
          dataType: 'moveObject',
          fields: {
            strategy_id: 'sui-downside-cover',
            audit_blob_id: '7-Mx9Cdx-cwMRawVWi5pZsYS22uN-SObq6nDotJ8xRM',
            execution_digest: 'prepare-mainnet-check',
          },
        },
        version: '1',
        digest: 'digest',
      },
    });

    expect(summary).toMatchObject({
      kind: 'riskpilot_receipt',
      label: 'RiskPilot receipt',
      protocol: 'RiskPilot',
      role: 'Audit receipt',
      facts: expect.arrayContaining([
        { label: 'Strategy', value: 'sui-downside-cover' },
        { label: 'Execution', value: 'prepare-mainnet-check' },
      ]),
    });
  });

  it('adds protocol and position facts for DeFi candidates', () => {
    const summary = summarizeOwnedObject({
      data: {
        objectId: '0xposition',
        type: '0xabc::clmm_pool::Position',
        content: {
          dataType: 'moveObject',
          fields: {
            liquidity: '1000000',
            tick_lower_index: '-100',
            tick_upper_index: '100',
          },
        },
        version: '1',
        digest: 'position_digest',
      },
    });

    expect(summary).toMatchObject({
      kind: 'defi_candidate',
      protocol: 'Cetus',
      role: 'Liquidity position',
      facts: expect.arrayContaining([
        { label: 'Liquidity', value: '1000000' },
        { label: 'Ticks', value: '-100 → 100' },
      ]),
    });
  });

  it('builds a paginated wallet object scan summary', async () => {
    const client: MainnetWalletObjectClient = {
      getOwnedObjects: async () => ({
        hasNextPage: false,
        data: [
          {
            data: {
              objectId: '0xdeepbook',
              type: '0xdee9::balance_manager::BalanceManager',
              version: '1',
              digest: 'deepbook_digest',
            },
          },
          {
            data: {
              objectId: '0xcoin',
              type: '0x2::coin::Coin<0x2::sui::SUI>',
              version: '1',
              digest: 'coin_digest',
            },
          },
          {
            data: {
              objectId: '0xreceipt',
              type: '0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19::strategy_receipt::StrategyReceipt',
              version: '1',
              digest: 'receipt_digest',
            },
          },
          {
            data: {
              objectId: '0xposition',
              type: '0xabc::clmm_pool::Position',
              version: '1',
              digest: 'position_digest',
            },
          },
        ],
      }),
    };

    const scan = await readMainnetWalletScan('0xREAL', client);

    expect(scan.totalObjects).toBe(4);
    expect(scan.coinObjects).toBe(1);
    expect(scan.deepbookObjects).toBe(1);
    expect(scan.receiptObjects).toBe(1);
    expect(scan.defiCandidates).toBe(1);
    expect(scan.protocolHints).toEqual(
      expect.arrayContaining([
        { protocol: 'DeepBook', count: 1, roles: ['DeepBook balance manager'] },
        { protocol: 'RiskPilot', count: 1, roles: ['Audit receipt'] },
        { protocol: 'Cetus', count: 1, roles: ['Liquidity position'] },
      ]),
    );
    expect(scan.sampleObjects[0]?.kind).toBe('deepbook_object');
  });
});
