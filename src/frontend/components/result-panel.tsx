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
import { JsonViewer } from './json-viewer';

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
  if (mode === 'simulation') {
    return 'Simulation ID';
  }

  if (mode === 'prepare_mainnet') {
    return 'Prepared ID';
  }

  return 'Digest';
}

function resultTitle(mode: string): string {
  return mode === 'mainnet' ? 'Mainnet transaction archived' : 'Prepared action archived';
}

function formatOptionalNumber(value: number | undefined, fallback = 'n/a'): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : fallback;
}

function formatOptionalUsd(value: number | undefined, fallback = 'n/a'): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatUsd(value) : fallback;
}

function yesNo(value: boolean | undefined): string {
  if (typeof value !== 'boolean') {
    return 'unknown';
  }

  return value ? 'yes' : 'no';
}

function archivePaymentLabel(storageResult: AuditStorageResult): string {
  return storageResult.paymentLabel ?? 'Connected wallet';
}

function archiveSignerLabel(storageResult: AuditStorageResult): string {
  return storageResult.signerLabel ?? 'Connected wallet';
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
    return 'not recorded';
  }

  return posture.replace(/_/g, ' ');
}

function executionIdentifier(auditPackage: AuditPackage): string {
  return (
    auditPackage.execution.digest ??
    auditPackage.execution.simulationId ??
    auditPackage.execution.preparedTransactionSummary ??
    auditPackage.id
  );
}

function scoreDelta(before: RiskReport, after: RiskReport | undefined): string {
  if (!after) {
    return 'n/a';
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
      title="Risk before/after"
      icon={<ShieldCheck size={17} />}
      badge={<span className={`pill ${after ? statusPillClass(after.overallLevel) : 'pillWarn'}`}>delta {scoreDelta(before, after)}</span>}
      wide
    >
      <div className="evidenceRiskGrid">
        <div className="evidenceScoreBlock">
          <span>Before</span>
          <strong>{before.overallScore}</strong>
          <small>{formatRiskLevel(before.overallLevel)}</small>
        </div>
        <div className="evidenceScoreBlock evidenceScoreAfter">
          <span>After est.</span>
          <strong>{after ? after.overallScore : 'n/a'}</strong>
          <small>{after ? formatRiskLevel(after.overallLevel) : 'not archived'}</small>
        </div>
        <div className="evidenceScoreBlock evidenceScoreDelta">
          <span>Score delta</span>
          <strong>{scoreDelta(before, after)}</strong>
          <small>{after?.estimated ? 'estimated' : after ? 'recorded' : 'missing'}</small>
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
          <span className="evidenceSignal">No active priced signals</span>
        )}
      </div>
    </EvidenceCard>
  );
}

function PolicyEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const policyErrors = auditPackage.policyCheck.errors;

  return (
    <EvidenceCard
      title="Policy Gate"
      icon={<Scale size={17} />}
      badge={
        <span className={`pill ${auditPackage.policyCheck.ok ? 'pillSuccess' : 'pillDanger'}`}>
          {auditPackage.policyCheck.ok ? 'passed' : 'blocked'}
        </span>
      }
    >
      <div className="evidenceRows">
        <EvidenceRow label="Budget cap" value={formatUsd(auditPackage.policy.maxBudgetUsd)} />
        <EvidenceRow label="Single trade" value={formatUsd(auditPackage.policy.maxSingleTradeUsd)} />
        <EvidenceRow label="Manual approval" value={auditPackage.policy.requireManualApproval ? 'required' : 'not required'} />
        <EvidenceRow label="Expires" value={formatDateTime(auditPackage.policy.expiresAt)} />
        <EvidenceRow label="Assets" value={auditPackage.policy.allowedAssets.join(', ') || 'none'} />
        <EvidenceRow label="Markets" value={auditPackage.policy.allowedMarkets.join(', ') || 'none'} />
      </div>
      <EvidenceList items={policyErrors} empty="No policy errors recorded." />
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
            <EvidenceRow label="Mode" value={council.mode === 'openai' ? council.model ?? 'openai' : 'rules fallback'} />
            <EvidenceRow label="Decision ID" value={council.id} />
          </div>
          {council.warning ? <div className="evidenceWarning">{council.warning}</div> : null}
          <div className="evidenceAgentList">
            {council.agents.slice(0, 5).map((agent) => (
              <div className="evidenceAgentRow" key={agent.id}>
                <span className={`pill ${statusPillClass(agent.status)}`}>{agent.status}</span>
                <strong>{agent.name}</strong>
                <small>{agent.summary}</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="evidenceMuted">Agent council was not recorded in this archived package.</p>
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
      badge={<span className={`pill ${statusPillClass(incidentRoom?.severity)}`}>{incidentRoom?.severity ?? 'not recorded'}</span>}
    >
      {incidentRoom ? (
        <>
          <p className="evidenceLead">{incidentRoom.managerBriefing}</p>
          <div className="evidenceRows">
            <EvidenceRow label="Final command" value={incidentRoom.finalCommand} />
            <EvidenceRow label="Posture" value={postureLabel(incidentRoom.posture)} />
            <EvidenceRow label="Source council" value={incidentRoom.sourceCouncilId} />
          </div>
          {incidentRoom.warning ? <div className="evidenceWarning">{incidentRoom.warning}</div> : null}
          <div className="evidenceConsensusList">
            {incidentRoom.consensus.slice(0, 4).map((item) => (
              <div className="evidenceConsensusRow" key={item.id}>
                <span className={`pill ${statusPillClass(item.status)}`}>{item.status}</span>
                <strong>{item.label}</strong>
                <small>{item.evidenceRef}</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="evidenceMuted">Incident room was not recorded in this archived package.</p>
      )}
    </EvidenceCard>
  );
}

function DeepBookEvidenceSection({ auditPackage }: { auditPackage: AuditPackage }) {
  const evidence = auditPackage.deepbookMarketEvidence;

  return (
    <EvidenceCard
      title="DeepBook Evidence"
      icon={<Landmark size={17} />}
      badge={<span className={`pill ${statusPillClass(evidence.status)}`}>{evidence.status}</span>}
    >
      <div className="evidenceRows">
        <EvidenceRow label="Pool" value={evidence.poolKey} />
        <EvidenceRow label="Route" value={evidence.routeStatus ?? 'unknown'} />
        <EvidenceRow label="Mid price" value={formatOptionalNumber(evidence.midPrice)} />
        <EvidenceRow label="Quote out" value={formatOptionalNumber(evidence.quoteOutForOneBase)} />
        <EvidenceRow label="Pool status" value={evidence.poolStatus ?? yesNo(evidence.registeredPool)} />
        <EvidenceRow label="Whitelist" value={evidence.whitelistStatus ?? yesNo(evidence.whitelisted)} />
        <EvidenceRow label="Fetched" value={evidence.fetchedAt ? formatDateTime(evidence.fetchedAt) : 'not recorded'} />
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
      title="Wallet-Paid Walrus Archive"
      icon={<Archive size={17} />}
      badge={<span className="pill pillSuccess">{storageResult.mode}</span>}
    >
      <div className="evidenceRows">
        <EvidenceRow label="Audit ID" value={auditPackage.id} />
        <EvidenceRow label="Created" value={formatDateTime(auditPackage.createdAt)} />
        <EvidenceRow label="Subject wallet" value={formatAddress(auditPackage.walletAddress)} />
        <EvidenceRow label="Provider" value={storageResult.provider ?? 'unknown'} />
        <EvidenceRow label="Archive payer" value={archivePaymentLabel(storageResult)} />
        <EvidenceRow label="Archive signer" value={archiveSignerLabel(storageResult)} />
        <EvidenceRow label="Wallet pays archive" value={storageResult.walletPaysArchive ? 'yes' : 'no'} />
        <EvidenceRow label="Archive ID" value={storageResult.id} />
        <EvidenceRow label="Checksum" value={storageResult.checksum ? storageResult.checksum.slice(0, 24) : 'not recorded'} />
        <EvidenceRow label="Size" value={storageResult.sizeBytes ? `${formatNumber(storageResult.sizeBytes)} bytes` : 'not recorded'} />
        <EvidenceRow label="Fallback" value={typeof storageResult.fallback === 'boolean' ? yesNo(storageResult.fallback) : 'not recorded'} />
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
  const receiptState = 'mint-ready fields';

  return (
    <EvidenceCard
      title="Receipt"
      icon={<FileCheck2 size={17} />}
      badge={<span className="pill pillSuccess">{receiptState}</span>}
    >
      <div className="evidenceRows">
        <EvidenceRow label="Strategy ID" value={auditPackage.recommendation.id} />
        <EvidenceRow label="Audit blob" value={storageResult.id} />
        <EvidenceRow label={executionIdentifierLabel(auditPackage.execution.mode)} value={executionIdentifier(auditPackage)} />
        <EvidenceRow label="Execution" value={`${auditPackage.execution.mode} / ${auditPackage.execution.status}`} />
        {auditPackage.execution.authority ? (
          <>
            <EvidenceRow label="Tx signer" value={auditPackage.execution.authority.signerLabel} />
            <EvidenceRow label="Tx payer" value={auditPackage.execution.authority.payerLabel} />
          </>
        ) : null}
        {auditPackage.execution.effectsStatus ? (
          <EvidenceRow
            label="Sui effects"
            value={`${auditPackage.execution.effectsStatus}${auditPackage.execution.effectsError ? ` · ${auditPackage.execution.effectsError}` : ''}`}
          />
        ) : null}
        <EvidenceRow label="Estimated cost" value={formatOptionalUsd(auditPackage.recommendation.estimatedCostUsd)} />
      </div>
      {auditPackage.execution.warning || auditPackage.execution.error ? (
        <div className="evidenceWarning">{auditPackage.execution.warning ?? auditPackage.execution.error}</div>
      ) : null}
      {auditPackage.execution.authority?.note ? (
        <div className="evidenceWarning">{auditPackage.execution.authority.note}</div>
      ) : null}
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
    <div className="evidenceExplorer" aria-label="Audit package evidence explorer">
      <div className="evidenceExplorerHeader">
        <div>
          <p className="eyebrow">Evidence explorer</p>
          <h3>Archived audit package</h3>
        </div>
        <div className="evidenceExplorerStamp">
          <span>{auditPackage.execution.mode}</span>
          <strong>{storageResult.provider ?? storageResult.mode}</strong>
        </div>
      </div>

      <div className="evidenceExplorerGrid">
        <RiskEvidenceSection before={auditPackage.riskReportBefore} after={auditPackage.riskReportAfter} />
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
          <p className="eyebrow">Prepared result</p>
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
            Execution
          </div>
          <div className="metricValue">{formatExecutionMode(executionMode)}</div>
          <div className="metricSub">{executionStatus}</div>
        </div>
        <div className="resultMetric">
          <div className="metricLabel">
            <CheckCircle2 size={14} />
            Before
          </div>
          <div className="metricValue">
            {archivedRiskBefore.overallScore}{' '}
            <span className="metricInline">({formatRiskLevel(archivedRiskBefore.overallLevel)})</span>
          </div>
        </div>
        <div className="resultMetric">
          <div className="metricLabel">
            <CheckCircle2 size={14} />
            After est.
          </div>
          <div className="metricValue">
            {archivedRiskAfter ? archivedRiskAfter.overallScore : '—'}{' '}
            <span className="metricInline">{archivedRiskAfter ? `(${formatRiskLevel(archivedRiskAfter.overallLevel)})` : ''}</span>
          </div>
        </div>
      </div>

      <AuditEvidenceExplorer auditPackage={auditPackage} storageResult={storageResult} />

      {warning ? <div className="warningStrip inline">{warning}</div> : null}

      <JsonViewer title="Audit JSON" value={auditPackage} />

      <div className="noteRow">
        <FileJson2 size={14} />
        <span>
          {auditPackage.execution.mode === 'mainnet'
            ? 'Real mainnet transaction digest, effects status, audit evidence, and estimated post-risk are recorded.'
            : 'Prepared action details and estimated post-risk are recorded without live submission.'}
        </span>
      </div>
    </section>
  );
}
