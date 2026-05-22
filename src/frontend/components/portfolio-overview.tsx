'use client';

import { Boxes, Landmark, Layers3, PieChart, WalletCards } from 'lucide-react';

import type { PortfolioSnapshot, WalletObjectKind } from '@/lib/risk/types';
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

const objectKindLabel: Record<WalletObjectKind, string> = {
  coin: 'Coin',
  walrus_blob: 'Walrus',
  riskpilot_receipt: 'Receipt',
  defi_candidate: 'DeFi',
  package_cap: 'Package',
  other: 'Object',
};

const objectKindBadge: Record<WalletObjectKind, string> = {
  coin: 'CN',
  walrus_blob: 'WAL',
  riskpilot_receipt: 'RC',
  defi_candidate: 'DFI',
  package_cap: 'CAP',
  other: 'OBJ',
};

export function PortfolioOverview({ portfolio, sourceLabel, walletStatus }: PortfolioOverviewProps) {
  const walletScan = portfolio.walletScan;

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

      <div className="metricGrid metricGridPortfolio">
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
        <div className="metricCard">
          <div className="metricLabel">
            <Boxes size={14} />
            Objects
          </div>
          <div className="metricValue">{walletScan ? walletScan.totalObjects : '—'}</div>
        </div>
      </div>

      <div className="stack">
        {portfolio.assets.map((asset) => {
          const isPriced = asset.usdPrice > 0 && asset.usdValue > 0;
          const share = portfolio.totalUsdValue > 0 ? asset.usdValue / portfolio.totalUsdValue : 0;

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
                  <strong className={isPriced ? undefined : 'assetUnpriced'}>
                    {isPriced ? formatUsd(asset.usdValue) : 'Unpriced'}
                  </strong>
                  <span>{isPriced ? formatPercent(share * 100) : 'not valued'}</span>
                </div>
              </div>
              <div className="barTrack" aria-hidden="true">
                <div
                  className="barFill"
                  style={{
                    width: isPriced ? `${Math.max(3, share * 100)}%` : '0%',
                    backgroundColor: assetAccent[asset.symbol] ?? 'var(--text-muted)',
                  }}
                />
              </div>
              <div className="assetMetaRow">
                <span>{formatCompact(asset.amount)} {asset.symbol}</span>
                <span>{isPriced ? `@ ${formatUsd(asset.usdPrice)}` : 'price unavailable'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {walletScan ? (
        <div className="walletScanPanel">
          <div className="walletScanHeader">
            <div>
              <div className="subPanelHeader">
                <Boxes size={14} />
                Mainnet object scan
              </div>
              <p>Owned Sui objects are scanned directly from mainnet and attached to the audit package.</p>
            </div>
            <span className="pill pillSuccess">real scan</span>
          </div>

          <div className="walletScanChips" aria-label="Wallet object counters">
            <span>{walletScan.coinObjects} coin objects</span>
            <span>{walletScan.walrusBlobs} Walrus blobs</span>
            <span>{walletScan.receiptObjects} receipts</span>
            <span>{walletScan.defiCandidates} DeFi candidates</span>
          </div>

          {walletScan.protocolHints.length > 0 ? (
            <div className="walletProtocolHints" aria-label="Protocol hints">
              {walletScan.protocolHints.map((hint) => (
                <span key={hint.protocol}>
                  <strong>{hint.protocol}</strong>
                  {hint.count} · {hint.roles.join(', ')}
                </span>
              ))}
            </div>
          ) : null}

          <div className="walletObjectList">
            {walletScan.sampleObjects.map((object) => (
              <div className={`walletObjectRow walletObjectRow-${object.kind}`} key={object.objectId}>
                <span className="walletObjectBadge">{objectKindBadge[object.kind]}</span>
                <div className="walletObjectMain">
                  <strong>{object.label}</strong>
                  <small>
                    {object.protocol} · {object.role} · {object.module ? `${object.module} · ` : ''}
                    {formatAddress(object.objectId)}
                  </small>
                  {object.facts.length > 0 ? (
                    <div className="walletObjectFacts">
                      {object.facts.map((fact) => (
                        <span key={`${object.objectId}:${fact.label}`}>
                          {fact.label}: <strong>{fact.value}</strong>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="pill pillNeutral">{objectKindLabel[object.kind]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="twoUp">
        <div className="subPanel">
          <div className="subPanelHeader">
            <Layers3 size={14} />
            Lending position
          </div>
          {portfolio.lendingPositions.length > 0 ? (
            portfolio.lendingPositions.map((position) => (
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
            ))
          ) : (
            <div className="positionEmpty">No decoded lending position in this wallet.</div>
          )}
        </div>

        <div className="subPanel">
          <div className="subPanelHeader">
            <Layers3 size={14} />
            LP position
          </div>
          {portfolio.liquidityPositions.length > 0 ? (
            portfolio.liquidityPositions.map((position) => (
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
            ))
          ) : (
            <div className="positionEmpty">No decoded LP position in this wallet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
