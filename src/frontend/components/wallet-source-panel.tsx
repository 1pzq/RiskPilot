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

  return (
    <section className="panel walletSourcePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Wallet source</p>
          <h2 className="panelTitle">Mainnet wallet context</h2>
        </div>
        <span className="pill pillSuccess">real data</span>
      </div>

      <div className="walletSourceGrid">
        <div className="walletSourceTile walletSourceTileBlue">
          <WalletCards size={16} />
          <span>Address</span>
          <strong>{formatAddress(address)}</strong>
        </div>
        <div className="walletSourceTile walletSourceTileMint">
          <CircleDollarSign size={16} />
          <span>Priced value</span>
          <strong>{formatUsd(pricedValue)}</strong>
        </div>
        <div className="walletSourceTile walletSourceTileYellow">
          <Boxes size={16} />
          <span>Objects</span>
          <strong>{walletScan ? walletScan.totalObjects : 'Scanning'}</strong>
        </div>
        <div className="walletSourceTile walletSourceTilePurple">
          <ShieldCheck size={16} />
          <span>Unpriced coins</span>
          <strong>{unpricedAssets.length}</strong>
        </div>
      </div>

      <div className="walletSourceList" aria-label="Wallet data rules">
        <div>
          <strong>Coin balances</strong>
          <span>{assets.length > 0 ? `${assets.length} live balance rows from Sui mainnet.` : 'Waiting for mainnet balances.'}</span>
        </div>
        <div>
          <strong>Object scan</strong>
          <span>
            {walletScan
              ? `${walletScan.deepbookObjects} DeepBook, ${walletScan.walrusBlobs} Walrus, ${walletScan.receiptObjects} receipt, ${walletScan.defiCandidates} DeFi candidate, and ${walletScan.packageCaps} package-cap objects detected.`
              : 'Waiting for owned-object scan results.'}
          </span>
        </div>
        <div>
          <strong>Unknown tokens</strong>
          <span>
            {unpricedAssets.length > 0
              ? `${unpricedAssets.map((asset) => `${formatCompact(asset.amount)} ${asset.symbol}`).join(', ')} shown without USD value.`
              : 'Every displayed coin has a known local price.'}
          </span>
        </div>
        <div>
          <strong>Position policy</strong>
          <span>No synthetic lending or LP positions are inserted after wallet connection.</span>
        </div>
      </div>
    </section>
  );
}
