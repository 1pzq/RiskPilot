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
  return storage.provider ?? 'Walrus archive';
}

function archivePaymentLabel(storage: AuditStorageResult): string {
  return storage.paymentLabel ?? 'Connected wallet';
}

function archiveSignerLabel(storage: AuditStorageResult): string {
  return storage.signerLabel ?? 'Connected wallet';
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
    return 'AI wording';
  }

  if (authority === 'chain_proof') {
    return 'Chain proof';
  }

  return 'Deterministic rules';
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
    return 'Not recorded';
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
      group: 'Wallet evidence',
      label: 'Subject wallet',
      value: auditPackage.walletAddress,
      evidenceRef: 'walletAddress',
      authority: 'deterministic',
      copyable: true,
    },
    {
      group: 'Wallet evidence',
      label: 'Balances',
      value: `${auditPackage.portfolioSnapshot.assets.length} assets · ${formatUsd(auditPackage.portfolioSnapshot.totalUsdValue)}`,
      evidenceRef: 'portfolioSnapshot.assets',
      authority: 'deterministic',
    },
    {
      group: 'Wallet evidence',
      label: 'Owned object scan',
      value: walletScan
        ? `${walletScan.totalObjects} objects · ${walletScan.defiCandidates} DeFi candidates`
        : 'Local sample or scan not recorded',
      evidenceRef: 'portfolioSnapshot.walletScan',
      authority: 'deterministic',
    },
    {
      group: 'Deterministic risk',
      label: 'Risk score',
      value: `${auditPackage.riskReportBefore.overallScore}/${auditPackage.riskReportBefore.overallLevel}`,
      evidenceRef: 'riskReportBefore.overallScore',
      authority: 'deterministic',
    },
    {
      group: 'Deterministic risk',
      label: 'Signals',
      value: `${auditPackage.riskReportBefore.signals.length} signals`,
      evidenceRef: 'riskReportBefore.signals',
      authority: 'deterministic',
    },
    {
      group: 'Deterministic risk',
      label: 'Scenarios',
      value: `${auditPackage.riskReportBefore.scenarioResults.length} scenario checks`,
      evidenceRef: 'riskReportBefore.scenarioResults',
      authority: 'deterministic',
    },
    {
      group: 'Strategy evidence',
      label: 'Recommendation',
      value: `${auditPackage.recommendation.type} · ${auditPackage.recommendation.deepbookAction.mode}`,
      evidenceRef: 'recommendation',
      authority: 'deterministic',
    },
    {
      group: 'Strategy evidence',
      label: 'Action boundary',
      value: `${auditPackage.recommendation.deepbookAction.market} · ${formatUsd(auditPackage.recommendation.estimatedCostUsd)}`,
      evidenceRef: 'recommendation.deepbookAction',
      authority: 'deterministic',
    },
    {
      group: 'Policy evidence',
      label: 'Policy Gate',
      value: auditPackage.policyCheck.ok ? 'Passed' : `${auditPackage.policyCheck.errors.length} errors`,
      evidenceRef: 'policyCheck',
      authority: 'deterministic',
    },
    {
      group: 'Policy evidence',
      label: 'Intent digest',
      value: intent?.executionIntentId ?? 'Not recorded',
      evidenceRef: 'executionIntent',
      authority: 'deterministic',
      copyable: Boolean(intent?.executionIntentId),
    },
    {
      group: 'Market evidence',
      label: 'DeepBook route',
      value: `${marketEvidence.poolKey} · ${marketEvidence.routeStatus ?? 'unknown'} · ${marketEvidence.status}`,
      evidenceRef: 'deepbookMarketEvidence',
      authority: 'deterministic',
    },
    {
      group: 'Market evidence',
      label: 'Pool proof',
      value: `${optionalValue(marketEvidence.poolAddress)} · whitelist ${marketEvidence.whitelistStatus ?? 'unknown'}`,
      evidenceRef: 'deepbookMarketEvidence.poolAddress',
      authority: 'chain_proof',
      copyable: Boolean(marketEvidence.poolAddress),
    },
    {
      group: 'Agent evidence',
      label: 'Incident command',
      value: incidentRoom?.finalCommand ?? 'not recorded',
      evidenceRef: 'incidentRoom.finalCommand',
      authority: 'deterministic',
    },
    {
      group: 'Agent evidence',
      label: 'Handoffs',
      value: incidentRoom ? `${incidentRoom.handoffs.length} handoffs · locked ${incidentRoom.tasks.filter((task) => task.locked).length}/${incidentRoom.tasks.length}` : 'not recorded',
      evidenceRef: 'incidentRoom.handoffs',
      authority: 'deterministic',
    },
    {
      group: 'AI wording',
      label: 'Explanation',
      value: `${auditPackage.aiExplanation.slice(0, 96)}${auditPackage.aiExplanation.length > 96 ? '...' : ''}`,
      evidenceRef: 'aiExplanation',
      authority: 'ai_wording',
    },
    {
      group: 'AI wording',
      label: 'Council summary',
      value: agentCouncil?.managerSummary ?? 'not recorded',
      evidenceRef: 'agentCouncil.managerSummary',
      authority: agentCouncil?.mode === 'openai' || agentCouncil?.mode === 'deepseek' ? 'ai_wording' : 'deterministic',
    },
    {
      group: 'Archive evidence',
      label: 'Walrus blob',
      value: storageResult.id,
      evidenceRef: 'storage.id',
      authority: 'chain_proof',
      copyable: true,
    },
    {
      group: 'Archive evidence',
      label: 'Blob object',
      value: storageResult.blobObjectId ?? 'pending',
      evidenceRef: 'storage.blobObjectId',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.blobObjectId),
    },
    {
      group: 'Archive evidence',
      label: 'Register tx',
      value: storageResult.registerDigest ?? 'pending',
      evidenceRef: 'storage.registerDigest',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.registerDigest),
    },
    {
      group: 'Archive evidence',
      label: 'Certify tx',
      value: storageResult.certifyDigest ?? 'pending',
      evidenceRef: 'storage.certifyDigest',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.certifyDigest),
    },
    {
      group: 'Archive evidence',
      label: 'Checksum',
      value: storageResult.checksum ?? 'not recorded',
      evidenceRef: 'storage.checksum',
      authority: 'chain_proof',
      copyable: Boolean(storageResult.checksum),
    },
    {
      group: 'Archive evidence',
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
      title="Copy evidence value"
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
          <p className="eyebrow">Audit package explorer</p>
          <h2 className="panelTitle">Readable evidence package</h2>
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
            Risk before / after
          </span>
          <strong>
            {before.overallScore} {after ? `→ ${after.overallScore}` : '→ pending'}
          </strong>
          <small>
            {formatRiskLevel(before.overallLevel)}
            {after ? ` to ${formatRiskLevel(after.overallLevel)}` : ''}
          </small>
        </div>
        <div className="packageExplorerCard packageExplorerCardMint">
          <span>
            <CheckCircle2 size={14} />
            Policy Gate
          </span>
          <strong>{auditPackage.policyCheck.ok ? 'Passed' : 'Blocked'}</strong>
          <small>{auditPackage.policy.requireManualApproval ? 'Manual approval required' : 'Manual approval off'}</small>
        </div>
        <div className="packageExplorerCard packageExplorerCardYellow">
          <span>
            <BrainCircuit size={14} />
            Agent proof
          </span>
          <strong>
            {incidentTasks} tasks · {councilAgents} Agents
          </strong>
          <small>{auditPackage.incidentRoom?.finalCommand ?? auditPackage.agentCouncil?.managerSummary ?? 'No Agent payload'}</small>
        </div>
        <div className="packageExplorerCard packageExplorerCardPurple">
          <span>
            <DatabaseZap size={14} />
            Market evidence
          </span>
          <strong>{marketEvidence.status === 'ready' ? marketEvidence.poolKey : 'Unavailable'}</strong>
          <small>
            {marketEvidence.status === 'ready'
              ? `mid ${marketEvidence.midPrice ?? 'n/a'}`
              : marketEvidence.error ?? marketEvidence.fallbackReason ?? 'Snapshot not ready'}
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
          <span>Execution</span>
          <strong>
            {auditPackage.execution.mode} · {auditPackage.execution.status}
          </strong>
        </div>
        <div className="ticketRow">
          <span>Intent</span>
          <strong>{auditPackage.executionIntent?.executionIntentId ?? 'Not recorded'}</strong>
        </div>
        <div className="ticketRow">
          <span>Policy digest</span>
          <strong>{auditPackage.executionIntent?.policyDigest.slice(0, 18) ?? 'Not recorded'}</strong>
        </div>
        <div className="ticketRow">
          <span>Recommendation</span>
          <strong>
            {auditPackage.recommendation.title} · {formatUsd(auditPackage.recommendation.estimatedCostUsd)}
          </strong>
        </div>
        <div className="ticketRow">
          <span>Subject wallet</span>
          <strong>{formatAddress(auditPackage.walletAddress)}</strong>
        </div>
        <div className="ticketRow">
          <span>Archive payer</span>
          <strong>{archivePaymentLabel(storageResult)}</strong>
        </div>
        <div className="ticketRow">
          <span>Archive signer</span>
          <strong>{archiveSignerLabel(storageResult)}</strong>
        </div>
        <div className="ticketRow">
          <span>Checksum</span>
          <strong>{storageResult.checksum ? storageResult.checksum.slice(0, 18) : 'Pending'}</strong>
        </div>
      </div>

      <div className="packageExplorerBoundary">
        <FileJson2 size={15} />
        <span>
          Explorer reads the archived audit package for the subject wallet. Walrus archive payment and certification come from the connected wallet; backend or local wallets are not the default payer.
        </span>
      </div>

      <div className="evidenceMapPanel" aria-label="Audit package evidence map">
        <div className="evidenceMapHeader">
          <div>
            <p className="eyebrow">Evidence map</p>
            <h3>Field-level proof</h3>
          </div>
          <span className="pill pillAccent">Refs visible</span>
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

      <JsonViewer title="Explorer source JSON" value={auditPackage} />
    </section>
  );
}
