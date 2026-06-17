'use client';

import { Boxes, CircleDollarSign, ShieldCheck, WalletCards } from 'lucide-react';

import type { AssetBalance, WalletScanSummary } from '@/lib/risk/types';
import { formatAddress, formatCompact, formatUsd } from '@/lib/utils/format';

type WalletSourcePanelProps = {
  address: string;
  assets: AssetBalance[];
  walletScan: WalletScanSummary | null;
};

export function WalletSourcePanel({ address, assets, walletScan }: WalletSourcePanelProps) {
  const pricedValue = assets.reduce((sum, asset) => sum + asset.usdValue, 0);
  const unpricedAssets = assets.filter((asset) => asset.usdPrice <= 0 || asset.usdValue <= 0);
  const visibleUnpricedAssets = unpricedAssets.slice(0, 5);
  const hiddenUnpricedCount = unpricedAssets.length - visibleUnpricedAssets.length;
  const unpricedAssetSummary =
    unpricedAssets.length > 0
      ? `${visibleUnpricedAssets.map((asset) => `${formatCompact(asset.amount)} ${asset.symbol}`).join(', ')}${
          hiddenUnpricedCount > 0 ? `，另有 ${hiddenUnpricedCount} 项` : ''
        }，显示时不含 USD 估值。`
      : '每个显示出来的 coin 都有已知的本地价格。';

  return (
    <section className="panel walletSourcePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">钱包来源</p>
          <h2 className="panelTitle">Mainnet 钱包上下文</h2>
        </div>
        <span className="pill pillSuccess">真实数据</span>
      </div>

      <div className="walletSourceGrid">
        <div className="walletSourceTile walletSourceTileBlue">
          <WalletCards size={16} />
          <span>地址</span>
          <strong>{formatAddress(address)}</strong>
        </div>
        <div className="walletSourceTile walletSourceTileMint">
          <CircleDollarSign size={16} />
          <span>已定价价值</span>
          <strong>{formatUsd(pricedValue)}</strong>
        </div>
        <div className="walletSourceTile walletSourceTileYellow">
          <Boxes size={16} />
          <span>对象</span>
          <strong>{walletScan ? walletScan.totalObjects : '扫描中'}</strong>
        </div>
        <div className="walletSourceTile walletSourceTilePurple">
          <ShieldCheck size={16} />
          <span>未定价 coin</span>
          <strong>{unpricedAssets.length}</strong>
        </div>
      </div>

      <div className="walletSourceList" aria-label="钱包数据规则">
        <div>
        <strong>Coin 余额</strong>
        <span>{assets.length > 0 ? `${assets.length} 行来自 Sui mainnet 的实时余额。` : '等待 mainnet 余额。'}</span>
        </div>
        <div>
          <strong>对象扫描</strong>
          <span>
            {walletScan
              ? `检测到 ${walletScan.deepbookObjects} 个 DeepBook、${walletScan.walrusBlobs} 个 Walrus、${walletScan.receiptObjects} 个 receipt、${walletScan.defiCandidates} 个 DeFi 候选和 ${walletScan.packageCaps} 个 package-cap 对象。`
              : '等待已拥有对象的扫描结果。'}
          </span>
        </div>
        <div>
          <strong>未知代币</strong>
          <span>{unpricedAssetSummary}</span>
        </div>
        <div>
          <strong>仓位策略</strong>
          <span>连接钱包后不会插入任何虚构的借贷或 LP 仓位。</span>
        </div>
      </div>
    </section>
  );
}
