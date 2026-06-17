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
  const actionLabel = hasActionableRoute ? '可执行路线' : '不可执行';
  const strongestConcern = topSignals[0];
  const unpricedSymbols = unpricedAssets
    .slice(0, 3)
    .map((asset) => asset.symbol)
    .join(', ');

  return (
    <section className="panel walletHealthPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">钱包健康</p>
          <h2 className="panelTitle">{formatAddress(address)} 的可信摘要</h2>
        </div>
        <span className={`pill ${levelClass[riskReport.overallLevel]}`}>
          {riskReport.overallScore}/100 · {formatRiskLevel(riskReport.overallLevel)}
        </span>
      </div>

      <div className="walletHealthGrid" aria-label="钱包健康摘要">
        <article className="walletHealthCard walletHealthCardBlue">
          <AlertTriangle size={16} />
          <span>首要关注</span>
          <strong>{strongestConcern ? strongestConcern.title : '没有已定价风险信号'}</strong>
          <small>
            {strongestConcern
              ? strongestConcern.summary
              : 'RiskPilot 没有发现应生成 DeepBook 交易的已定价、可路由风险。'}
          </small>
        </article>
        <article className="walletHealthCard walletHealthCardMint">
          <BadgeCheck size={16} />
          <span>可执行性</span>
          <strong>{actionLabel}</strong>
          <small>
            {hasActionableRoute
              ? `${recommendation.deepbookAction.market} · ${formatUsd(recommendation.deepbookAction.amountUsd)} 已准备供 Policy 审查。`
              : '钱包审查保持仅审计，不会虚构替代市场。'}
          </small>
        </article>
        <article className="walletHealthCard walletHealthCardYellow">
          <ScanSearch size={16} />
          <span>未知敞口</span>
          <strong>
            {unpricedAssets.length} 未定价 · {unsupportedObjectCount} 不支持
          </strong>
          <small>
            {unpricedAssets.length > 0
              ? `${unpricedSymbols || '未定价资产'} 可见，但会被排除在 USD 估值之外。`
              : '不受支持的对象会作为证据记录，而不是当作假设去交易。'}
          </small>
        </article>
      </div>

      <div className="walletHealthRows" aria-label="风险分类">
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
              <strong>没有可执行的已定价风险</strong>
              <span>已连接钱包模式只使用真实余额和已拥有对象。</span>
            </div>
            <span className="pill pillSuccess">清晰</span>
          </div>
        )}
      </div>

      <div className="walletHealthBoundary" role="note">
        <Ban size={16} />
          <span>
          钱包连接后，RiskPilot 不会从不受支持或未定价的数据里拼出借贷、LP 或 DeepBook 交易。
        </span>
      </div>
    </section>
  );
}
