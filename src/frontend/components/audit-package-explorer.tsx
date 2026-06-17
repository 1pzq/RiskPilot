'use client';

import { useState } from 'react';
import { Archive, BrainCircuit, CheckCircle2, Copy, DatabaseZap, FileJson2, ShieldCheck } from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { formatAddress, formatRiskLevel, formatUsd } from '@/lib/utils/format';
import { JsonViewer } from './json-viewer';

type AuditPackageExplorerProps = {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
};

function storageLabel(storage: AuditStorageResult): string {
  return storage.provider ?? 'Walrus 归档';
}

function archivePaymentLabel(storage: AuditStorageResult): string {
  return storage.paymentLabel ?? '已连接钱包';
}

function archiveSignerLabel(storage: AuditStorageResult): string {
  return storage.signerLabel ?? '已连接钱包';
}

type EvidenceAuthority = 'deterministic' | 'ai_wording' | 'chain_proof';

type EvidenceMapRow = {
  group: string;
  label: string;
  value: string;
  evidenceRef: string;
  authority: EvidenceAuthority;
  copyable?: boolean;
};

function authorityLabel(authority: EvidenceAuthority): string {
  if (authority === 'ai_wording') {
    return 'AI 文案';
  }

  if (authority === 'chain_proof') {
    return '链上证明';
  }

  return '确定性规则';
}

function authorityClass(authority: EvidenceAuthority): string {
  if (authority === 'ai_wording') {
    return 'evidenceAuthorityAi';
  }

  if (authority === 'chain_proof') {
    return 'evidenceAuthorityChain';
  }

  return 'evidenceAuthorityDeterministic';
}

function optionalValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return '未记录';
  }

  return String(value);
}

function buildEvidenceMap(auditPackage: AuditPackage, storageResult: AuditStorageResult): EvidenceMapRow[] {
  const walletScan = auditPackage.portfolioSnapshot.walletScan;
  const marketEvidence = auditPackage.deepbookMarketEvidence;
  const agentCouncil = auditPackage.agentCouncil;
  const incidentRoom = auditPackage.incidentRoom;
  const intent = auditPackage.executionIntent;

  return [
    {
      group: '钱包证据',
      label: '主体钱包',
      value: auditPackage.walletAddress,
      evidenceRef: 'walletAddress',
      authority: 'deterministic',
      copyable: true,
    },
    {
      group: '钱包证据',
      label: '余额',
      value: `${auditPackage.portfolioSnapshot.assets.length} 个资产 · ${formatUsd(auditPackage.portfolioSnapshot.totalUsdValue)}`,
      evidenceRef: 'portfolioSnapshot.assets',
      authority: 'deterministic',
    },
    {
      group: '钱包证据',
      label: '已拥有对象扫描',
      value: walletScan
        ? `${walletScan.totalObjects} 个对象 · ${walletScan.defiCandidates} 个 DeFi 候选`
        : '本地样例或扫描未记录',
      evidenceRef: 'portfolioSnapshot.walletScan',
      authority: 'deterministic',
    },
    {
      group: '确定性风险',
      label: '风险评分',
      value: `${auditPackage.riskReportBefore.overallScore}/${auditPackage.riskReportBefore.overallLevel}`,
      evidenceRef: 'riskReportBefore.overallScore',
      authority: 'deterministic',
    },
    {
      group: '确定性风险',
      label: '信号',
      value: `${auditPackage.riskReportBefore.signals.length} signals`,
      evidenceRef: 'riskReportBefore.signals',
      authority: 'deterministic',
    },
    {
      group: '确定性风险',
      label: '场景',
      value: `${auditPackage.riskReportBefore.scenarioResults.length} scenario checks`,
      evidenceRef: 'riskReportBefore.scenarioResults',
      authority: 'deterministic',
    },
    {
      group: '策略证据',
      label: '推荐',
      value: `${auditPackage.recommendation.type} · ${auditPackage.recommendation.deepbookAction.mode}`,
      evidenceRef: 'recommendation',
      authority: 'deterministic',
    },
    {
      group: '策略证据',
      label: '动作边界',
      value: `${auditPackage.recommendation.deepbookAction.market} · ${formatUsd(auditPackage.recommendation.estimatedCostUsd)}`,
      evidenceRef: 'recommendation.deepbookAction',
      authority: 'deterministic',
    },
    {
      group: 'Policy 证据',
      label: 'Policy Gate',
      value: auditPackage.policyCheck.ok ? '通过' : `${auditPackage.policyCheck.errors.length} 个错误`,
      evidenceRef: 'policyCheck',
      authority: 'deterministic',
    },
    {
      group: 'Policy 证据',
      label: '意图摘要',
      value: intent?.executionIntentId ?? '未记录',
      evidenceRef: 'executionIntent',
      authority: 'deterministic',
      copyable: Boolean(intent?.executionIntentId),
    },
    {
      group: '市场证据',
      label: 'DeepBook 路线',
      value: `${marketEvidence.poolKey} · ${marketEvidence.routeStatus ?? 'unknown'} · ${marketEvidence.status}`,
      evidenceRef: 'deepbookMarketEvidence',
      authority: 'deterministic',
    },
    {
      group: '市场证据',
      label: '池证明',
      value: `${optionalValue(marketEvidence.poolAddress)} · 白名单 ${marketEvidence.whitelistStatus ?? '未知'}`,
      evidenceRef: 'deepbookMarketEvidence.poolAddress',
      authority: 'chain_proof',
      copyable: Boolean(marketEvidence.poolAddress),
    },
    {
      group: 'Agent 证据',
      label: 'Incident 指令',
      value: incidentRoom?.finalCommand ?? 'not recorded',
      evidenceRef: 'incidentRoom.finalCommand',
      authority: 'deterministic',
    },
    {
      group: 'Agent 证据',
      label: '交接',
      value: incidentRoom ? `${incidentRoom.handoffs.length} handoffs · locked ${incidentRoom.tasks.filter((task) => task.locked).length}/${incidentRoom.tasks.length}` : 'not recorded',
      evidenceRef: 'incidentRoom.handoffs',
      authority: 'deterministic',
    },
    {
      group: 'AI 文案',
      label: '解释',
      value: `${auditPackage.aiExplanation.slice(0, 96)}${auditPackage.aiExplanation.length > 96 ? '...' : ''}`,
      evidenceRef: 'aiExplanation',
      authority: 'ai_wording',
    },
    {
      group: 'AI 文案',
      label: 'Council 摘要',
      value: agentCouncil?.managerSummary ?? 'not recorded',
      evidenceRef: 'agentCouncil.managerSummary',
      authority: agentCouncil?.mode === 'openai' || agentCouncil?.mode === 'deepseek' ? 'ai_wording' : 'deterministic',
    },
    {
      group: '归档证据',
      label: 'Walrus blob',
      value: storageResult.id,
      evidenceRef: 'storage.id',
      authority: 'chain_proof',
      copyable: true,
    },
    {
      group: '归档证据',
      label: 'Blob object',
      value: storageResult.blobObjectId ?? 'pending',
      evidenceRef: 'storage.blobObjectId',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.blobObjectId),
    },
    {
      group: '归档证据',
      label: 'Register tx',
      value: storageResult.registerDigest ?? 'pending',
      evidenceRef: 'storage.registerDigest',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.registerDigest),
    },
    {
      group: '归档证据',
      label: 'Certify tx',
      value: storageResult.certifyDigest ?? 'pending',
      evidenceRef: 'storage.certifyDigest',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.certifyDigest),
    },
    {
      group: '归档证据',
      label: 'Checksum',
      value: storageResult.checksum ?? 'not recorded',
      evidenceRef: 'storage.checksum',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.checksum),
    },
    {
      group: '归档证据',
      label: 'Readback URL',
      value: storageResult.url ?? 'not recorded',
      evidenceRef: 'storage.url',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.url),
    },
  ];
}

function EvidenceMapCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="evidenceMapCopyButton"
      type="button"
      title="复制证据值"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function AuditPackageExplorer({ auditPackage, storageResult }: AuditPackageExplorerProps) {
  const before = auditPackage.riskReportBefore;
  const after = auditPackage.riskReportAfter;
  const marketEvidence = auditPackage.deepbookMarketEvidence;
  const incidentTasks = auditPackage.incidentRoom?.tasks.length ?? 0;
  const councilAgents = auditPackage.agentCouncil?.agents.length ?? 0;
  const evidenceMap = buildEvidenceMap(auditPackage, storageResult);

  return (
    <section className="panel auditPackageExplorerPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">审计包浏览器</p>
          <h2 className="panelTitle">可读的证据包</h2>
        </div>
        <span className="pill pillSuccess">
          <Archive size={14} />
          {storageLabel(storageResult)}
        </span>
      </div>

      <div className="packageExplorerGrid">
        <div className="packageExplorerCard packageExplorerCardBlue">
          <span>
            <ShieldCheck size={14} />
            风险前后
          </span>
          <strong>
            {before.overallScore} {after ? `→ ${after.overallScore}` : '→ 待定'}
          </strong>
          <small>
            {formatRiskLevel(before.overallLevel)}
            {after ? ` 到 ${formatRiskLevel(after.overallLevel)}` : ''}
          </small>
        </div>
        <div className="packageExplorerCard packageExplorerCardMint">
          <span>
            <CheckCircle2 size={14} />
            Policy Gate
          </span>
          <strong>{auditPackage.policyCheck.ok ? '通过' : '已阻断'}</strong>
          <small>{auditPackage.policy.requireManualApproval ? '需要人工确认' : '人工确认关闭'}</small>
        </div>
        <div className="packageExplorerCard packageExplorerCardYellow">
          <span>
            <BrainCircuit size={14} />
            Agent 证明
          </span>
          <strong>
            {incidentTasks} 个任务 · {councilAgents} 个 Agent
          </strong>
          <small>{auditPackage.incidentRoom?.finalCommand ?? auditPackage.agentCouncil?.managerSummary ?? '没有 Agent 载荷'}</small>
        </div>
        <div className="packageExplorerCard packageExplorerCardPurple">
          <span>
            <DatabaseZap size={14} />
            市场证据
          </span>
          <strong>{marketEvidence.status === 'ready' ? marketEvidence.poolKey : '不可用'}</strong>
          <small>
            {marketEvidence.status === 'ready'
              ? `mid ${marketEvidence.midPrice ?? 'n/a'}`
              : marketEvidence.error ?? marketEvidence.fallbackReason ?? '快照未就绪'}
          </small>
        </div>
      </div>

      <div className="ticketRows packageExplorerRows">
        <div className="ticketRow">
          <span>Audit id</span>
          <strong>{auditPackage.id}</strong>
        </div>
        <div className="ticketRow">
          <span>Storage id</span>
          <strong>{storageResult.id}</strong>
        </div>
        <div className="ticketRow">
          <span>执行</span>
          <strong>
            {auditPackage.execution.mode} · {auditPackage.execution.status}
          </strong>
        </div>
        <div className="ticketRow">
          <span>意图</span>
          <strong>{auditPackage.executionIntent?.executionIntentId ?? '未记录'}</strong>
        </div>
        <div className="ticketRow">
          <span>Policy digest</span>
          <strong>{auditPackage.executionIntent?.policyDigest.slice(0, 18) ?? '未记录'}</strong>
        </div>
        <div className="ticketRow">
          <span>推荐</span>
          <strong>
            {auditPackage.recommendation.title} · {formatUsd(auditPackage.recommendation.estimatedCostUsd)}
          </strong>
        </div>
        <div className="ticketRow">
          <span>主体钱包</span>
          <strong>{formatAddress(auditPackage.walletAddress)}</strong>
        </div>
        <div className="ticketRow">
          <span>归档支付方</span>
          <strong>{archivePaymentLabel(storageResult)}</strong>
        </div>
        <div className="ticketRow">
          <span>归档签名者</span>
          <strong>{archiveSignerLabel(storageResult)}</strong>
        </div>
        <div className="ticketRow">
          <span>Checksum</span>
          <strong>{storageResult.checksum ? storageResult.checksum.slice(0, 18) : '待处理'}</strong>
        </div>
      </div>

      <div className="packageExplorerBoundary">
        <FileJson2 size={15} />
        <span>
          Explorer 会读取主体钱包的已归档审计包。Walrus 归档支付和认证都来自已连接钱包；后端或本地钱包都不是默认支付方。
        </span>
      </div>

      <div className="evidenceMapPanel" aria-label="审计包证据映射">
        <div className="evidenceMapHeader">
          <div>
            <p className="eyebrow">证据映射</p>
            <h3>按字段展示权限</h3>
          </div>
          <span className="pill pillAccent">引用可见</span>
        </div>
        <div className="evidenceMapGrid">
          {evidenceMap.map((row) => (
            <article className={`evidenceMapRow ${authorityClass(row.authority)}`} key={`${row.group}-${row.evidenceRef}`}>
              <div className="evidenceMapRowTop">
                <span>{row.group}</span>
                <em>{authorityLabel(row.authority)}</em>
              </div>
              <strong>{row.label}</strong>
              <p>{row.value}</p>
              <div className="evidenceMapRef">
                <code>{row.evidenceRef}</code>
                {row.copyable && row.value !== 'pending' && row.value !== 'not recorded' ? (
                  <EvidenceMapCopyButton value={row.value} />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>

      <JsonViewer title="Explorer 源 JSON" value={auditPackage} />
    </section>
  );
}
