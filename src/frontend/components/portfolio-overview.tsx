'use client';

import { Boxes, Landmark, Layers3, PieChart, WalletCards } from 'lucide-react';

import type { PortfolioSnapshot, WalletObjectKind, WalletObjectSummary } from '@/lib/risk/types';
import { formatAddress, formatCompact, formatPercent, formatUsd } from '@/lib/utils/format';
import { zhDisplayText, zhSourceLabel } from '@/frontend/utils/zh';

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
  other: '对象',
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
        {hiddenFacts > 0 ? <span className="walletObjectFactsMore">另有 {hiddenFacts} 项</span> : null}
      </div>
    );
  }

  return (
    <section className={isMainnetWallet ? 'panel portfolioPanel portfolioPanelWallet' : 'panel portfolioPanel'}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">投资组合</p>
          <h2 className="panelTitle">已追踪价值 {formatUsd(portfolio.totalUsdValue)}</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className="pill pillMuted">{zhSourceLabel(sourceLabel)}</span>
          <span className="pill pillNeutral">{zhDisplayText(walletStatus)}</span>
        </div>
      </div>

      <div className="metricGrid metricGridPortfolio">
        <div className="metricCard">
          <div className="metricLabel">
            <WalletCards size={14} />
            钱包
          </div>
          <div className="metricValue">{formatAddress(portfolio.walletAddress)}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <PieChart size={14} />
            持仓
          </div>
          <div className="metricValue">{portfolio.assets.length}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <Landmark size={14} />
            借贷
          </div>
          <div className="metricValue">{portfolio.lendingPositions.length}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <Boxes size={14} />
            对象
          </div>
          <div className="metricValue">{walletScan ? walletScan.totalObjects : '—'}</div>
        </div>
      </div>

      <div className="portfolioAssetGrid" aria-label="钱包持仓">
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
                    {isPriced ? formatUsd(asset.usdValue) : '未定价'}
                  </strong>
                  <span>{isPriced ? formatPercent(share * 100) : '未计入估值'}</span>
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
                <span>{isPriced ? `@ ${formatUsd(asset.usdPrice)}` : '价格不可用'}</span>
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
                Mainnet 对象扫描
              </div>
            </div>
            <span className="pill pillSuccess">真实扫描</span>
          </div>

          <div className="walletScanChips" aria-label="钱包对象计数">
            <span>{walletScan.coinObjects} 个 Coin 对象</span>
            <span>{walletScan.deepbookObjects} DeepBook objects</span>
            <span>{walletScan.walrusBlobs} Walrus blobs</span>
            <span>{walletScan.receiptObjects} 个 Receipt</span>
            <span>{walletScan.defiCandidates} 个 DeFi 候选</span>
            <span>{walletScan.packageCaps} 个 Package 权限</span>
          </div>

          {walletScan.protocolHints.length > 0 ? (
            <div className="walletProtocolHints" aria-label="协议线索">
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
              {hiddenProtocolHintCount > 0 ? <span className="walletProtocolHintsMore">另有 {hiddenProtocolHintCount} 个协议</span> : null}
            </div>
          ) : null}

          <div className="walletObjectListViewport" aria-label="Mainnet 对象预览">
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
                          预览中显示 {groupTotal} 个{objectKindLabel[kind]}对象里的 {previewObjects.length} 个。
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="walletObjectEmpty">本次扫描没有返回可预览的已拥有对象。</div>
            )}
          </div>
        </div>
      ) : null}

      <div className="twoUp">
        <div className="subPanel">
          <div className="subPanelHeader">
            <Layers3 size={14} />
            借贷仓位
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
                  <span>{position.collateralSymbol} 抵押品</span>
                  <span>{formatUsd(position.collateralUsd)}</span>
                </div>
                <div className="positionLine subtle">
                  <span>{position.debtSymbol} 债务</span>
                  <span>{formatUsd(position.debtUsd)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="positionEmpty">这个钱包里没有已解析的借贷仓位。</div>
          )}
        </div>

        <div className="subPanel">
          <div className="subPanelHeader">
            <Layers3 size={14} />
            LP 仓位
          </div>
          {portfolio.liquidityPositions.length > 0 ? (
            portfolio.liquidityPositions.map((position) => (
              <div className="positionBlock" key={position.protocol}>
                <div className="positionLine">
                  <span>{position.protocol}</span>
                  <span className="pill pillNeutral">{zhDisplayText(position.estimatedImpermanentLossRisk)}</span>
                </div>
                <div className="positionLine subtle">
                  <span>{position.pair}</span>
                  <span>{formatUsd(position.usdValue)}</span>
                </div>
                <div className="positionLine subtle">
                  <span>SUI 侧</span>
                  <span>{formatUsd(position.tokenAExposureUsd)}</span>
                </div>
                <div className="positionLine subtle">
                  <span>USDC 侧</span>
                  <span>{formatUsd(position.tokenBExposureUsd)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="positionEmpty">这个钱包里没有已解析的 LP 仓位。</div>
          )}
        </div>
      </div>
    </section>
  );
}
