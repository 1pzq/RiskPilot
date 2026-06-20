'use client';

import { AlertTriangle, BadgeCheck, Ban, ScanSearch } from 'lucide-react';

import type { AssetBalance, RiskReport, WalletScanSummary } from '@/lib/risk/types';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { formatAddress, formatRiskLevel, formatUsd } from '@/lib/utils/format';

type WalletHealthSummaryProps = {
  address: string;
  assets: AssetBalance[];
  walletScan: WalletScanSummary | null;
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
};

const levelClass: Record<RiskReport['overallLevel'], string> = {
  low: 'pillSuccess',
  medium: 'pillWarn',
  high: 'pillWarn',
  critical: 'pillDanger',
};

export function WalletHealthSummary({
  address,
  assets,
  walletScan,
  riskReport,
  recommendation,
}: WalletHealthSummaryProps) {
  const topSignals = riskReport.signals.slice(0, 3);
  const unpricedAssets = assets.filter((asset) => asset.usdPrice <= 0 || asset.usdValue <= 0);
  const knownObjectCount = walletScan
    ? walletScan.coinObjects +
      walletScan.deepbookObjects +
      walletScan.walrusBlobs +
      walletScan.receiptObjects +
      walletScan.defiCandidates +
      walletScan.packageCaps
    : 0;
  const unsupportedObjectCount = walletScan ? Math.max(0, walletScan.totalObjects - knownObjectCount) : 0;
  const hasActionableRoute =
    recommendation.deepbookAction.amountUsd > 0 && recommendation.deepbookAction.market !== 'No trade';
  const actionLabel = hasActionableRoute ? 'Executable route' : 'Not executable';
  const strongestConcern = topSignals[0];
  const unpricedSymbols = unpricedAssets
    .slice(0, 3)
    .map((asset) => asset.symbol)
    .join(', ');

  return (
    <section className="panel walletHealthPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Wallet health</p>
          <h2 className="panelTitle">Trusted summary for {formatAddress(address)}</h2>
        </div>
        <span className={`pill ${levelClass[riskReport.overallLevel]}`}>
          {riskReport.overallScore}/100 · {formatRiskLevel(riskReport.overallLevel)}
        </span>
      </div>

      <div className="walletHealthGrid" aria-label="Wallet health summary">
        <article className="walletHealthCard walletHealthCardBlue">
          <AlertTriangle size={16} />
          <span>Top concern</span>
          <strong>{strongestConcern ? strongestConcern.title : 'No priced risk signal'}</strong>
          <small>
            {strongestConcern
              ? strongestConcern.summary
              : 'RiskPilot found no priced, routable risk that should generate a DeepBook trade.'}
          </small>
        </article>
        <article className="walletHealthCard walletHealthCardMint">
          <BadgeCheck size={16} />
          <span>Executability</span>
          <strong>{actionLabel}</strong>
          <small>
            {hasActionableRoute
              ? `${recommendation.deepbookAction.market} · ${formatUsd(recommendation.deepbookAction.amountUsd)} prepared for Policy review.`
              : 'Wallet review remains audit-only and does not invent a substitute market.'}
          </small>
        </article>
        <article className="walletHealthCard walletHealthCardYellow">
          <ScanSearch size={16} />
          <span>Unknown exposure</span>
          <strong>
            {unpricedAssets.length} unpriced · {unsupportedObjectCount} unsupported
          </strong>
          <small>
            {unpricedAssets.length > 0
              ? `${unpricedSymbols || 'Unpriced assets'} are visible but excluded from USD valuation.`
              : 'Unsupported objects are recorded as evidence, not traded as assumptions.'}
          </small>
        </article>
      </div>

      <div className="walletHealthRows" aria-label="Risk categories">
        {topSignals.length > 0 ? (
          topSignals.map((signal) => (
            <div className="walletHealthRow" key={signal.id}>
              <div>
                <strong>{signal.title}</strong>
                <span>{signal.category} · {signal.evidence[0]}</span>
              </div>
              <span className={`pill ${levelClass[signal.level]}`}>{formatRiskLevel(signal.level)}</span>
            </div>
          ))
        ) : (
          <div className="walletHealthRow">
            <div>
              <strong>No executable priced risk</strong>
              <span>Connected-wallet mode only uses real balances and owned objects.</span>
            </div>
            <span className="pill pillSuccess">Clear</span>
          </div>
        )}
      </div>

      <div className="walletHealthBoundary" role="note">
        <Ban size={16} />
          <span>
          After wallet connection, RiskPilot will not fabricate lending, LP, or DeepBook trades from unsupported or unpriced data.
        </span>
      </div>
    </section>
  );
}
