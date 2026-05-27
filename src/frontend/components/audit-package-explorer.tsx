'use client';

import { Archive, BrainCircuit, CheckCircle2, DatabaseZap, FileJson2, ShieldCheck } from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { formatAddress, formatRiskLevel, formatUsd } from '@/lib/utils/format';
import { JsonViewer } from './json-viewer';

type AuditPackageExplorerProps = {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
};

function storageLabel(storage: AuditStorageResult): string {
  if (storage.mode === 'walrus') {
    return storage.provider ?? 'walrus archive';
  }

  return storage.provider ?? 'local fallback';
}

export function AuditPackageExplorer({ auditPackage, storageResult }: AuditPackageExplorerProps) {
  const before = auditPackage.riskReportBefore;
  const after = auditPackage.riskReportAfter;
  const marketEvidence = auditPackage.deepbookMarketEvidence;
  const incidentTasks = auditPackage.incidentRoom?.tasks.length ?? 0;
  const councilAgents = auditPackage.agentCouncil?.agents.length ?? 0;
  const archiveIsWalrus = storageResult.mode === 'walrus';

  return (
    <section className="panel auditPackageExplorerPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Audit package explorer</p>
          <h2 className="panelTitle">Readable evidence package</h2>
        </div>
        <span className={`pill ${archiveIsWalrus ? 'pillSuccess' : 'pillWarn'}`}>
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
            Policy gate
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
            {incidentTasks} tasks · {councilAgents} agents
          </strong>
          <small>{auditPackage.incidentRoom?.finalCommand ?? auditPackage.agentCouncil?.managerSummary ?? 'No agent payload'}</small>
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
              : marketEvidence.error ?? marketEvidence.fallbackReason ?? 'snapshot not ready'}
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
          <span>Recommendation</span>
          <strong>
            {auditPackage.recommendation.title} · {formatUsd(auditPackage.recommendation.estimatedCostUsd)}
          </strong>
        </div>
        <div className="ticketRow">
          <span>Wallet</span>
          <strong>{formatAddress(auditPackage.walletAddress)}</strong>
        </div>
        <div className="ticketRow">
          <span>Checksum</span>
          <strong>{storageResult.checksum ? storageResult.checksum.slice(0, 18) : 'pending'}</strong>
        </div>
      </div>

      <div className="packageExplorerBoundary">
        <FileJson2 size={15} />
        <span>
          Explorer reads only the archived audit package returned by prepare/archive. What-if preview room and strategy
          diff stay outside this real evidence package.
        </span>
      </div>

      <JsonViewer title="Explorer source JSON" value={auditPackage} />
    </section>
  );
}
