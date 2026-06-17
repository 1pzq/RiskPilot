'use client';

import type { ReactNode } from 'react';
import {
  Archive,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  FileJson2,
  Landmark,
  Scale,
  ShieldCheck,
  Siren,
} from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import type { RiskReport } from '@/lib/risk/types';
import { formatAddress, formatDateTime, formatNumber, formatRiskLevel, formatUsd } from '@/lib/utils/format';
import { zhStatus, zhYesNo } from '@/frontend/utils/zh';

type ResultPanelProps = {
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  executionMode: string;
  executionStatus: string;
  riskBefore: RiskReport;
  riskAfter?: RiskReport;
  warning?: string;
};

function formatExecutionMode(mode: string): string {
  return mode.replace(/_/g, ' ');
}

function executionIdentifierLabel(mode: string): string {
  if (mode === 'prepare_mainnet') {
    return 'Prepared ID';
  }

  return 'Digest';
}

function resultTitle(mode: string): string {
  return mode === 'mainnet' ? 'Mainnet 交易已归档' : 'Prepared 动作已归档';
}

function formatOptionalNumber(value: number | undefined, fallback = '无'): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : fallback;
}

function formatOptionalUsd(value: number | undefined, fallback = '无'): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatUsd(value) : fallback;
}

function yesNo(value: boolean | undefined): string {
  if (typeof value !== 'boolean') {
    return '未知';
  }

  return zhYesNo(value);
}

function archivePaymentLabel(storageResult: AuditStorageResult): string {
  return storageResult.paymentLabel ?? '已连接钱包';
}

function archiveSignerLabel(storageResult: AuditStorageResult): string {
  return storageResult.signerLabel ?? '已连接钱包';
}

function statusPillClass(status: string | undefined): string {
  const normalized = status?.toLowerCase() ?? '';

  if (
    normalized.includes('blocked') ||
    normalized.includes('failed') ||
    normalized.includes('failure') ||
    normalized.includes('error') ||
    normalized.includes('critical') ||
    normalized.includes('unavailable')
  ) {
    return 'pillDanger';
  }

  if (
    normalized.includes('ready') ||
    normalized.includes('ok') ||
    normalized.includes('success') ||
    normalized.includes('confirmed') ||
    normalized.includes('complete') ||
    normalized.includes('walrus') ||
    normalized.includes('passed')
  ) {
    return 'pillSuccess';
  }

  if (
    normalized.includes('warn') ||
    normalized.includes('watch') ||
    normalized.includes('pending') ||
    normalized.includes('prepared') ||
    normalized.includes('local')
  ) {
    return 'pillWarn';
  }

  return 'pillNeutral';
}

function postureLabel(posture: string | undefined): string {
  if (!posture) {
    return '未记录';
  }

  return zhStatus(posture);
}

function executionIdentifier(auditPackage: AuditPackage): string {
  return (
    auditPackage.execution.digest ??
    auditPackage.execution.preparedTransactionSummary ??
    auditPackage.id
  );
}

function scoreDelta(before: RiskReport, after: RiskReport | undefined): string {
  if (!after) {
    return '无';
  }

  const delta = after.overallScore - before.overallScore;

  if (delta === 0) {
    return '0';
  }

  return delta > 0 ? `+${delta}` : `${delta}`;
}

function EvidenceCard({
  title,
  icon,
  badge,
  children,
  wide = false,
}: {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`evidenceCard ${wide ? 'evidenceCardWide' : ''}`}>
      <div className="evidenceCardHeader">
        <div>
          <span className="evidenceIcon">{icon}</span>
          <h3>{title}</h3>
        </div>
        {badge ? <div className="evidenceBadge">{badge}</div> : null}
      </div>
      {children}
    </article>
  );
}

function EvidenceRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="evidenceRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EvidenceList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="evidenceMuted">{empty}</p>;
  }

  return (
    <ul className="evidenceList">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RiskEvidenceSection({
  before,
  after,
}: {
  before: RiskReport;
  after?: RiskReport;
}) {
  const topSignals = before.signals.slice(0, 3);

  return (
    <EvidenceCard
      title="风险前后"
      icon={<ShieldCheck size={17} />}
      badge={<span className={`pill ${after ? statusPillClass(after.overallLevel) : 'pillWarn'}`}>变化 {scoreDelta(before, after)}</span>}
      wide
    >
      <div className="evidenceRiskGrid">
        <div className="evidenceScoreBlock">
          <span>之前</span>
          <strong>{before.overallScore}</strong>
          <small>{formatRiskLevel(before.overallLevel)}</small>
        </div>
        <div className="evidenceScoreBlock evidenceScoreAfter">
          <span>之后估算</span>
          <strong>{after ? after.overallScore : '无'}</strong>
          <small>{after ? formatRiskLevel(after.overallLevel) : '未归档'}</small>
        </div>
        <div className="evidenceScoreBlock evidenceScoreDelta">
          <span>评分变化</span>
          <strong>{scoreDelta(before, after)}</strong>
          <small>{after?.estimated ? '估算' : after ? '已记录' : '缺失'}</small>
        </div>
      </div>

      <div className="evidenceSignalStrip">
        {topSignals.length > 0 ? (
          topSignals.map((signal) => (
            <span className={`evidenceSignal evidenceSignal${formatRiskLevel(signal.level)}`} key={signal.id}>
              {signal.title}: {formatRiskLevel(signal.level)}
            </span>
          ))
        ) : (
          <span className="evidenceSignal">没有活跃的已定价信号</span>
        )}
      </div>
    </EvidenceCard>
  );
}

function PolicyEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const policyErrors = auditPackage.policyCheck.errors;

  return (
    <EvidenceCard
      title="Policy 闸门"
      icon={<Scale size={17} />}
      badge={
        <span className={`pill ${auditPackage.policyCheck.ok ? 'pillSuccess' : 'pillDanger'}`}>
          {auditPackage.policyCheck.ok ? '通过' : '已阻断'}
        </span>
      }
    >
      <div className="evidenceRows">
        <EvidenceRow label="预算上限" value={formatUsd(auditPackage.policy.maxBudgetUsd)} />
        <EvidenceRow label="单笔交易" value={formatUsd(auditPackage.policy.maxSingleTradeUsd)} />
        <EvidenceRow label="人工确认" value={auditPackage.policy.requireManualApproval ? '需要' : '不需要'} />
        <EvidenceRow label="过期时间" value={formatDateTime(auditPackage.policy.expiresAt)} />
        <EvidenceRow label="资产" value={auditPackage.policy.allowedAssets.join(', ') || '无'} />
        <EvidenceRow label="市场" value={auditPackage.policy.allowedMarkets.join(', ') || '无'} />
      </div>
      <EvidenceList items={policyErrors} empty="没有记录到 Policy 错误。" />
    </EvidenceCard>
  );
}

function IntentEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const intent = auditPackage.executionIntent;

  return (
    <EvidenceCard
      title="Execution Intent"
      icon={<FileCheck2 size={17} />}
      badge={<span className={`pill ${intent ? 'pillSuccess' : 'pillWarn'}`}>{intent ? '已锁定' : '未记录'}</span>}
    >
      {intent ? (
        <div className="evidenceRows">
          <EvidenceRow label="Intent ID" value={intent.executionIntentId} />
          <EvidenceRow label="来源" value={intent.intentSource === 'base_wallet' ? '已连接钱包' : '本地样例'} />
          <EvidenceRow label="创建时间" value={formatDateTime(intent.intentCreatedAt)} />
          <EvidenceRow label="过期时间" value={formatDateTime(intent.intentExpiresAt)} />
          <EvidenceRow label="Portfolio digest" value={intent.portfolioDigest.slice(0, 24)} />
          <EvidenceRow label="Risk digest" value={intent.riskReportDigest.slice(0, 24)} />
          <EvidenceRow label="Recommendation digest" value={intent.recommendationDigest.slice(0, 24)} />
          <EvidenceRow label="Policy digest" value={intent.policyDigest.slice(0, 24)} />
        </div>
      ) : (
        <p className="evidenceMuted">这个归档包早于 execution intent 绑定。</p>
      )}
    </EvidenceCard>
  );
}

function AgentCouncilEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const council = auditPackage.agentCouncil;

  return (
    <EvidenceCard
      title="Agent Council"
      icon={<BrainCircuit size={17} />}
      badge={<span className={`pill ${statusPillClass(council?.posture)}`}>{postureLabel(council?.posture)}</span>}
    >
      {council ? (
        <>
          <p className="evidenceLead">{council.managerSummary}</p>
          <div className="evidenceRows">
            <EvidenceRow
              label="模式"
              value={council.mode === 'openai' || council.mode === 'deepseek' ? council.model ?? council.mode : '规则兜底'}
            />
            <EvidenceRow label="决策 ID" value={council.id} />
          </div>
          {council.warning ? <div className="evidenceWarning">{council.warning}</div> : null}
          <div className="evidenceAgentList">
            {council.agents.slice(0, 5).map((agent) => (
              <div className="evidenceAgentRow" key={agent.id}>
                <span className={`pill ${statusPillClass(agent.status)}`}>{zhStatus(agent.status)}</span>
                <strong>{agent.name}</strong>
                <small>{agent.summary}</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="evidenceMuted">这个归档包里没有记录 Agent Council。</p>
      )}
    </EvidenceCard>
  );
}

function IncidentRoomEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const incidentRoom = auditPackage.incidentRoom;

  return (
    <EvidenceCard
      title="Incident Room"
      icon={<Siren size={17} />}
      badge={<span className={`pill ${statusPillClass(incidentRoom?.severity)}`}>{zhStatus(incidentRoom?.severity)}</span>}
    >
      {incidentRoom ? (
        <>
          <p className="evidenceLead">{incidentRoom.managerBriefing}</p>
          <div className="evidenceRows">
            <EvidenceRow label="最终指令" value={incidentRoom.finalCommand} />
            <EvidenceRow label="姿态" value={postureLabel(incidentRoom.posture)} />
            <EvidenceRow label="来源 Council" value={incidentRoom.sourceCouncilId} />
          </div>
          {incidentRoom.warning ? <div className="evidenceWarning">{incidentRoom.warning}</div> : null}
          <div className="evidenceConsensusList">
            {incidentRoom.consensus.slice(0, 4).map((item) => (
              <div className="evidenceConsensusRow" key={item.id}>
                <span className={`pill ${statusPillClass(item.status)}`}>{zhStatus(item.status)}</span>
                <strong>{item.label}</strong>
                <small>{item.evidenceRef}</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="evidenceMuted">这个归档包里没有记录 Incident Room。</p>
      )}
    </EvidenceCard>
  );
}

function DeepBookEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const evidence = auditPackage.deepbookMarketEvidence;

  return (
    <EvidenceCard
      title="DeepBook 证据"
      icon={<Landmark size={17} />}
      badge={<span className={`pill ${statusPillClass(evidence.status)}`}>{zhStatus(evidence.status)}</span>}
    >
      <div className="evidenceRows">
        <EvidenceRow label="Pool" value={evidence.poolKey} />
        <EvidenceRow label="路线" value={zhStatus(evidence.routeStatus)} />
        <EvidenceRow label="中间价" value={formatOptionalNumber(evidence.midPrice)} />
        <EvidenceRow label="Quote out" value={formatOptionalNumber(evidence.quoteOutForOneBase)} />
        <EvidenceRow label="池状态" value={evidence.poolStatus ? zhStatus(evidence.poolStatus) : yesNo(evidence.registeredPool)} />
        <EvidenceRow label="白名单" value={evidence.whitelistStatus ? zhStatus(evidence.whitelistStatus) : yesNo(evidence.whitelisted)} />
        <EvidenceRow label="获取时间" value={evidence.fetchedAt ? formatDateTime(evidence.fetchedAt) : '未记录'} />
        {evidence.poolAddress ? <EvidenceRow label="Pool address" value={formatAddress(evidence.poolAddress)} /> : null}
      </div>
      {evidence.vaultBalances ? (
        <div className="evidenceMiniGrid">
          <span>Base {formatNumber(evidence.vaultBalances.base)}</span>
          <span>Quote {formatNumber(evidence.vaultBalances.quote)}</span>
          <span>DEEP {formatNumber(evidence.vaultBalances.deep)}</span>
        </div>
      ) : null}
      {evidence.tradeParams ? (
        <div className="evidenceMiniGrid">
          <span>Taker {formatNumber(evidence.tradeParams.takerFee)}</span>
          <span>Maker {formatNumber(evidence.tradeParams.makerFee)}</span>
          <span>Stake {formatNumber(evidence.tradeParams.stakeRequired)}</span>
        </div>
      ) : null}
      {evidence.error || evidence.fallbackReason ? (
        <div className="evidenceWarning">{evidence.error ?? evidence.fallbackReason}</div>
      ) : null}
    </EvidenceCard>
  );
}

function ArchiveEvidenceSection({
  auditPackage,
  storageResult,
}: {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
}) {
  return (
    <EvidenceCard
      title="钱包支付的 Walrus 归档"
      icon={<Archive size={17} />}
      badge={<span className="pill pillSuccess">{storageResult.mode}</span>}
    >
      <div className="evidenceRows">
        <EvidenceRow label="Audit ID" value={auditPackage.id} />
        <EvidenceRow label="创建时间" value={formatDateTime(auditPackage.createdAt)} />
        <EvidenceRow label="主体钱包" value={formatAddress(auditPackage.walletAddress)} />
        <EvidenceRow label="提供方" value={storageResult.provider ?? '未知'} />
        <EvidenceRow label="归档支付方" value={archivePaymentLabel(storageResult)} />
        <EvidenceRow label="归档签名者" value={archiveSignerLabel(storageResult)} />
        <EvidenceRow label="钱包支付归档" value={storageResult.walletPaysArchive ? '是' : '否'} />
        <EvidenceRow label="Archive ID" value={storageResult.id} />
        <EvidenceRow label="Checksum" value={storageResult.checksum ? storageResult.checksum.slice(0, 24) : '未记录'} />
        <EvidenceRow label="大小" value={storageResult.sizeBytes ? `${formatNumber(storageResult.sizeBytes)} bytes` : '未记录'} />
        <EvidenceRow label="兜底" value={typeof storageResult.fallback === 'boolean' ? yesNo(storageResult.fallback) : '未记录'} />
        {storageResult.url ? <EvidenceRow label="URL" value={storageResult.url} /> : null}
      </div>
      {storageResult.warning || storageResult.error ? (
        <div className="evidenceWarning">{storageResult.warning ?? storageResult.error}</div>
      ) : null}
      {storageResult.custodyNote ? <div className="evidenceWarning">{storageResult.custodyNote}</div> : null}
    </EvidenceCard>
  );
}

function ReceiptEvidenceSection({
  auditPackage,
  storageResult,
}: {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
}) {
  const receiptProof = auditPackage.receiptProof;
  const receiptState = receiptProof ? '已 mint 证明' : '可 mint 字段';

  return (
    <EvidenceCard
      title="Receipt"
      icon={<FileCheck2 size={17} />}
      badge={<span className={`pill ${receiptProof ? 'pillSuccess' : 'pillWarn'}`}>{receiptState}</span>}
    >
      <div className="evidenceRows">
        <EvidenceRow label="Strategy ID" value={auditPackage.recommendation.id} />
        <EvidenceRow label="AgentPolicy object" value={auditPackage.policyObjectId ?? '未绑定'} />
        <EvidenceRow label="Prepared PTB" value={auditPackage.execution.preparedPtb?.status ?? '未构建'} />
        <EvidenceRow
          label="Signed PTB"
          value={auditPackage.execution.signedPreparedPtb ? 'signed, not submitted' : '未签名'}
        />
        <EvidenceRow label="Audit blob" value={storageResult.id} />
        <EvidenceRow label={executionIdentifierLabel(auditPackage.execution.mode)} value={executionIdentifier(auditPackage)} />
        {receiptProof ? (
          <>
            <EvidenceRow label="Receipt tx" value={receiptProof.receiptDigest} />
            <EvidenceRow label="Receipt object" value={receiptProof.receiptObjectId ?? '钱包响应中创建对象待定'} />
            <EvidenceRow label="Receipt policy" value={receiptProof.policyObjectId ?? '未绑定'} />
            <EvidenceRow label="Receipt 签名者" value={formatAddress(receiptProof.signer)} />
            <EvidenceRow label="Mint 时间" value={formatDateTime(receiptProof.mintedAt)} />
          </>
        ) : null}
        <EvidenceRow label="执行" value={`${zhStatus(auditPackage.execution.mode)} / ${zhStatus(auditPackage.execution.status)}`} />
        {auditPackage.execution.authority ? (
          <>
            <EvidenceRow label="Tx 签名者" value={auditPackage.execution.authority.signerLabel} />
            <EvidenceRow label="Tx 支付方" value={auditPackage.execution.authority.payerLabel} />
          </>
        ) : null}
        {auditPackage.execution.effectsStatus ? (
          <EvidenceRow
            label="Sui effects"
            value={`${zhStatus(auditPackage.execution.effectsStatus)}${auditPackage.execution.effectsError ? ` · ${auditPackage.execution.effectsError}` : ''}`}
          />
        ) : null}
        <EvidenceRow label="预估成本" value={formatOptionalUsd(auditPackage.recommendation.estimatedCostUsd)} />
      </div>
      {auditPackage.execution.warning || auditPackage.execution.error ? (
        <div className="evidenceWarning">{auditPackage.execution.warning ?? auditPackage.execution.error}</div>
      ) : null}
      {auditPackage.execution.authority?.note ? (
        <div className="evidenceWarning">{auditPackage.execution.authority.note}</div>
      ) : null}
      <div className="evidenceWarning">
        StrategyReceipt 是归档后证明，用来连接 strategy id、Walrus blob id 和 execution digest。它独立于交易执行，并且需要自己的钱包签名。
      </div>
    </EvidenceCard>
  );
}

function AuditEvidenceExplorer({
  auditPackage,
  storageResult,
}: {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
}) {
  return (
    <div className="evidenceExplorer" aria-label="审计包证据浏览器">
      <div className="evidenceExplorerHeader">
        <div>
          <p className="eyebrow">证据浏览器</p>
          <h3>已归档审计包</h3>
        </div>
        <div className="evidenceExplorerStamp">
          <span>{auditPackage.execution.mode}</span>
          <strong>{storageResult.provider ?? storageResult.mode}</strong>
        </div>
      </div>

      <div className="evidenceExplorerGrid">
        <RiskEvidenceSection before={auditPackage.riskReportBefore} after={auditPackage.riskReportAfter} />
        <IntentEvidenceSection auditPackage={auditPackage} />
        <PolicyEvidenceSection auditPackage={auditPackage} />
        <AgentCouncilEvidenceSection auditPackage={auditPackage} />
        <IncidentRoomEvidenceSection auditPackage={auditPackage} />
        <DeepBookEvidenceSection auditPackage={auditPackage} />
        <ArchiveEvidenceSection auditPackage={auditPackage} storageResult={storageResult} />
        <ReceiptEvidenceSection auditPackage={auditPackage} storageResult={storageResult} />
      </div>
    </div>
  );
}

function ResultProofStrip({ auditPackage, storageResult }: { auditPackage: AuditPackage; storageResult: AuditStorageResult }) {
  return (
    <div className="resultProofStrip" aria-label="核心归档证明">
      <div>
        <span>Walrus blob</span>
        <strong>{storageResult.id}</strong>
      </div>
      <div>
        <span>Register tx</span>
        <strong>{storageResult.registerDigest ?? '等待证据'}</strong>
      </div>
      <div>
        <span>Certify tx</span>
        <strong>{storageResult.certifyDigest ?? '等待证据'}</strong>
      </div>
      <div>
        <span>最终指令</span>
        <strong>{auditPackage.incidentRoom?.finalCommand ?? auditPackage.agentCouncil?.managerSummary ?? '未记录'}</strong>
      </div>
    </div>
  );
}

export function ResultPanel({
  auditPackage,
  storageResult,
  executionMode,
  executionStatus,
  riskBefore,
  riskAfter,
  warning,
}: ResultPanelProps) {
  if (!auditPackage || !storageResult) {
    return null;
  }

  const archivedRiskBefore = auditPackage.riskReportBefore ?? riskBefore;
  const archivedRiskAfter = auditPackage.riskReportAfter ?? riskAfter;

  return (
    <section className="panel resultPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">准备结果</p>
          <h2 className="panelTitle">{resultTitle(auditPackage.execution.mode)}</h2>
        </div>
        <span className="pill pillSuccess">
          {storageResult.provider ?? storageResult.mode}
        </span>
      </div>

      <div className="resultGrid">
        <div className="resultMetric">
          <div className="metricLabel">
            <ShieldCheck size={14} />
            执行
          </div>
          <div className="metricValue">{formatExecutionMode(executionMode)}</div>
          <div className="metricSub">{executionStatus}</div>
        </div>
        <div className="resultMetric">
          <div className="metricLabel">
            <CheckCircle2 size={14} />
            之前
          </div>
          <div className="metricValue">
            {archivedRiskBefore.overallScore}{' '}
            <span className="metricInline">({formatRiskLevel(archivedRiskBefore.overallLevel)})</span>
          </div>
        </div>
        <div className="resultMetric">
          <div className="metricLabel">
            <CheckCircle2 size={14} />
            之后估算
          </div>
          <div className="metricValue">
            {archivedRiskAfter ? archivedRiskAfter.overallScore : '—'}{' '}
            <span className="metricInline">{archivedRiskAfter ? `(${formatRiskLevel(archivedRiskAfter.overallLevel)})` : ''}</span>
          </div>
        </div>
      </div>

      <ResultProofStrip auditPackage={auditPackage} storageResult={storageResult} />

      {warning ? <div className="warningStrip inline">{warning}</div> : null}

      <details className="compactDetailsPanel evidenceDetailsPanel">
        <summary>
          <span>完整归档证据</span>
          <strong>打开浏览器</strong>
        </summary>
        <AuditEvidenceExplorer auditPackage={auditPackage} storageResult={storageResult} />
      </details>

      <div className="noteRow">
        <FileJson2 size={14} />
        <span>
          完整字段级证据和源 JSON 仍可在浏览器内查看，但默认视图会保持归档证明轨的聚焦。
        </span>
      </div>
    </section>
  );
}
