'use client';

import { Landmark, Layers3, PieChart, WalletCards } from 'lucide-react';

import type { PortfolioSnapshot } from '@/lib/risk/types';
import { formatAddress, formatCompact, formatPercent, formatUsd } from '@/lib/utils/format';

type PortfolioOverviewProps = {
  portfolio: PortfolioSnapshot;
  sourceLabel: string;
  walletStatus: string;
};

const assetAccent: Record<string, string> = {
  SUI: 'var(--sui)',
  USDC: 'var(--usdc)',
  'SUI/USDC LP': 'var(--lp)',
  WAL: 'var(--other)',
};

export function PortfolioOverview({ portfolio, sourceLabel, walletStatus }: PortfolioOverviewProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2 className="panelTitle">Tracked value {formatUsd(portfolio.totalUsdValue)}</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className="pill pillMuted">{sourceLabel}</span>
          <span className="pill pillNeutral">{walletStatus}</span>
        </div>
      </div>

      <div className="metricGrid">
        <div className="metricCard">
          <div className="metricLabel">
            <WalletCards size={14} />
            Wallet
          </div>
          <div className="metricValue">{formatAddress(portfolio.walletAddress)}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <PieChart size={14} />
            Holdings
          </div>
          <div className="metricValue">{portfolio.assets.length}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <Landmark size={14} />
            Lending
          </div>
          <div className="metricValue">{portfolio.lendingPositions.length}</div>
        </div>
      </div>

      <div className="stack">
        {portfolio.assets.map((asset) => {
          const share = asset.usdValue / portfolio.totalUsdValue;

          return (
            <div className="assetRow" key={`${asset.coinType}:${asset.symbol}`}>
              <div className="assetRowHeader">
                <div className="assetLabel">
                  <span className="swatch" style={{ backgroundColor: assetAccent[asset.symbol] ?? 'var(--text-muted)' }} />
                  <div>
                    <div className="assetName">{asset.symbol}</div>
                    <div className="assetMeta">{asset.coinType}</div>
                  </div>
                </div>
                <div className="assetNumbers">
                  <strong>{formatUsd(asset.usdValue)}</strong>
                  <span>{formatPercent(share * 100)}</span>
                </div>
              </div>
              <div className="barTrack" aria-hidden="true">
                <div
                  className="barFill"
                  style={{
                    width: `${Math.max(3, share * 100)}%`,
                    backgroundColor: assetAccent[asset.symbol] ?? 'var(--text-muted)',
                  }}
                />
              </div>
              <div className="assetMetaRow">
                <span>{formatCompact(asset.amount)} {asset.symbol}</span>
                <span>@ {formatUsd(asset.usdPrice)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="twoUp">
        <div className="subPanel">
          <div className="subPanelHeader">
            <Layers3 size={14} />
            Lending position
          </div>
          {portfolio.lendingPositions.map((position) => (
            <div className="positionBlock" key={position.protocol}>
              <div className="positionLine">
                <span>{position.protocol}</span>
                <span className={position.healthFactor < 1.3 ? 'danger' : 'warn'}>
                  HF {position.healthFactor.toFixed(2)}
                </span>
              </div>
              <div className="positionLine subtle">
                <span>{position.collateralSymbol} collateral</span>
                <span>{formatUsd(position.collateralUsd)}</span>
              </div>
              <div className="positionLine subtle">
                <span>{position.debtSymbol} debt</span>
                <span>{formatUsd(position.debtUsd)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="subPanel">
          <div className="subPanelHeader">
            <Layers3 size={14} />
            LP position
          </div>
          {portfolio.liquidityPositions.map((position) => (
            <div className="positionBlock" key={position.protocol}>
              <div className="positionLine">
                <span>{position.protocol}</span>
                <span className="pill pillNeutral">{position.estimatedImpermanentLossRisk}</span>
              </div>
              <div className="positionLine subtle">
                <span>{position.pair}</span>
                <span>{formatUsd(position.usdValue)}</span>
              </div>
              <div className="positionLine subtle">
                <span>SUI leg</span>
                <span>{formatUsd(position.tokenAExposureUsd)}</span>
              </div>
              <div className="positionLine subtle">
                <span>USDC leg</span>
                <span>{formatUsd(position.tokenBExposureUsd)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
