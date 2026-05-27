'use client';

import { Boxes, Landmark, Layers3, PieChart, WalletCards } from 'lucide-react';

import type { PortfolioSnapshot, WalletObjectKind, WalletObjectSummary } from '@/lib/risk/types';
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
  deepbook_object: 'DeepBook',
  walrus_blob: 'Walrus',
  riskpilot_receipt: 'Receipt',
  defi_candidate: 'DeFi',
  package_cap: 'Package',
  other: 'Object',
};

const objectKindBadge: Record<WalletObjectKind, string> = {
  coin: 'CN',
  deepbook_object: 'DB',
  walrus_blob: 'WAL',
  riskpilot_receipt: 'RC',
  defi_candidate: 'DFI',
  package_cap: 'CAP',
  other: 'OBJ',
};

const objectPreviewLimit: Record<WalletObjectKind, number> = {
  coin: 4,
  deepbook_object: 6,
  walrus_blob: 6,
  riskpilot_receipt: 6,
  defi_candidate: 6,
  package_cap: 5,
  other: 5,
};

export function PortfolioOverview({ portfolio, sourceLabel, walletStatus }: PortfolioOverviewProps) {
  const walletScan = portfolio.walletScan;
  const isMainnetWallet = sourceLabel === 'mainnet wallet';
  const sampleObjectCount = walletScan?.sampleObjects.length ?? 0;
  const visibleProtocolHints = walletScan?.protocolHints.slice(0, 6) ?? [];
  const hiddenProtocolHintCount = (walletScan?.protocolHints.length ?? 0) - visibleProtocolHints.length;
  const groupedObjects = walletScan
    ? walletScan.sampleObjects.reduce<Partial<Record<WalletObjectKind, typeof walletScan.sampleObjects>>>(
        (groups, object) => {
          const group = groups[object.kind] ?? [];
          group.push(object);
          groups[object.kind] = group;
          return groups;
        },
        {},
      )
    : {};

  const objectGroupOrder: WalletObjectKind[] = [
    'deepbook_object',
    'walrus_blob',
    'riskpilot_receipt',
    'defi_candidate',
    'package_cap',
    'coin',
    'other',
  ];
  const objectKindTotal: Record<WalletObjectKind, number> = {
    coin: walletScan?.coinObjects ?? 0,
    deepbook_object: walletScan?.deepbookObjects ?? 0,
    walrus_blob: walletScan?.walrusBlobs ?? 0,
    riskpilot_receipt: walletScan?.receiptObjects ?? 0,
    defi_candidate: walletScan?.defiCandidates ?? 0,
    package_cap: walletScan?.packageCaps ?? 0,
    other: Math.max(
      0,
      (walletScan?.totalObjects ?? 0) -
        ((walletScan?.coinObjects ?? 0) +
          (walletScan?.deepbookObjects ?? 0) +
          (walletScan?.walrusBlobs ?? 0) +
          (walletScan?.receiptObjects ?? 0) +
          (walletScan?.defiCandidates ?? 0) +
          (walletScan?.packageCaps ?? 0)),
    ),
  };

  function renderObjectFacts(object: WalletObjectSummary) {
    const visibleFacts = object.facts.slice(0, 2);
    const hiddenFacts = object.facts.length - visibleFacts.length;

    return (
      <div className="walletObjectFacts">
        {visibleFacts.map((fact) => (
          <span key={`${object.objectId}:${fact.label}`}>
            {fact.label}: <strong>{fact.value}</strong>
          </span>
        ))}
        {hiddenFacts > 0 ? <span className="walletObjectFactsMore">+{hiddenFacts} more</span> : null}
      </div>
    );
  }

  return (
    <section className={isMainnetWallet ? 'panel portfolioPanel portfolioPanelWallet' : 'panel portfolioPanel'}>
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

      <div className="portfolioAssetGrid" aria-label="Wallet holdings">
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
                    <div className="assetMeta assetCoinType" title={asset.coinType}>
                      {asset.coinType}
                    </div>
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
              <p className="walletScanPreviewNote">
                Scrollable preview showing {sampleObjectCount} of {walletScan.totalObjects} scanned objects. Key category counts stay visible above.
              </p>
            </div>
            <span className="pill pillSuccess">real scan</span>
          </div>

          <div className="walletScanChips" aria-label="Wallet object counters">
            <span>{walletScan.coinObjects} coin objects</span>
            <span>{walletScan.deepbookObjects} DeepBook objects</span>
            <span>{walletScan.walrusBlobs} Walrus blobs</span>
            <span>{walletScan.receiptObjects} receipts</span>
            <span>{walletScan.defiCandidates} DeFi candidates</span>
            <span>{walletScan.packageCaps} package caps</span>
          </div>

          {walletScan.protocolHints.length > 0 ? (
            <div className="walletProtocolHints" aria-label="Protocol hints">
              {visibleProtocolHints.map((hint) => {
                const visibleRoles = hint.roles.slice(0, 3);
                const hiddenRoles = hint.roles.length - visibleRoles.length;

                return (
                  <span key={hint.protocol}>
                    <strong>{hint.protocol}</strong>
                    {hint.count} · {visibleRoles.join(', ')}
                    {hiddenRoles > 0 ? `, +${hiddenRoles}` : ''}
                  </span>
                );
              })}
              {hiddenProtocolHintCount > 0 ? <span className="walletProtocolHintsMore">+{hiddenProtocolHintCount} protocols</span> : null}
            </div>
          ) : null}

          <div className="walletObjectListViewport" aria-label="Mainnet object preview">
            {sampleObjectCount > 0 ? (
              <div className="walletObjectList">
                {objectGroupOrder.map((kind) => {
                  const objects = groupedObjects[kind] ?? [];

                  if (objects.length === 0) {
                    return null;
                  }

                  const previewObjects = objects.slice(0, objectPreviewLimit[kind]);
                  const groupTotal = objectKindTotal[kind];
                  const hiddenPreviewCount = Math.max(0, groupTotal - previewObjects.length);

                  return (
                    <div className="walletObjectGroup" key={kind}>
                      <div className="walletObjectGroupHeader">
                        <span>{objectKindLabel[kind]}</span>
                        <strong>{groupTotal}</strong>
                      </div>
                      <div className="walletObjectGroupItems">
                        {previewObjects.map((object) => (
                          <div className={`walletObjectRow walletObjectRow-${object.kind}`} key={object.objectId}>
                            <span className="walletObjectBadge">{objectKindBadge[object.kind]}</span>
                            <div className="walletObjectMain">
                              <strong>{object.label}</strong>
                              <small>
                                {object.protocol} · {object.role}
                                {object.module ? ` · ${object.module}` : ''}
                                {' · '}
                                {formatAddress(object.objectId)}
                              </small>
                              {object.facts.length > 0 ? renderObjectFacts(object) : null}
                            </div>
                            <span className="pill pillNeutral">{objectKindLabel[object.kind]}</span>
                          </div>
                        ))}
                      </div>
                      {hiddenPreviewCount > 0 ? (
                        <div className="walletObjectGroupFooter">
                          Showing {previewObjects.length} of {groupTotal} {objectKindLabel[kind].toLowerCase()} objects in preview.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="walletObjectEmpty">No previewable owned objects returned in this scan.</div>
            )}
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
