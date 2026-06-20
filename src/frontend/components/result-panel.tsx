'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import type { RiskReport } from '@/lib/risk/types';
import { formatAddress, formatDateTime, formatRiskLevel } from '@/lib/utils/format';

type ResultPanelProps = {
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  executionMode: string;
  executionStatus: string;
  riskBefore: RiskReport;
  riskAfter?: RiskReport;
};

function formatExecutionMode(mode: string): string {
  return mode.replace(/_/g, ' ');
}

function resultTitle(mode: string): string {
  return mode === 'mainnet' ? 'Mainnet transaction archived' : 'Prepared action archived';
}

function archivePaymentLabel(storageResult: AuditStorageResult): string {
  return storageResult.paymentLabel ?? 'Connected wallet';
}

function ResultProofStrip({ auditPackage, storageResult }: { auditPackage: AuditPackage; storageResult: AuditStorageResult }) {
  return (
    <div className="resultProofStrip" aria-label="Core archive proof">
      <div>
        <span>Walrus blob</span>
        <strong>{storageResult.id}</strong>
      </div>
      <div>
        <span>Register tx</span>
        <strong>{storageResult.registerDigest ?? 'Awaiting proof'}</strong>
      </div>
      <div>
        <span>Certify tx</span>
        <strong>{storageResult.certifyDigest ?? 'Awaiting proof'}</strong>
      </div>
      <div>
        <span>Final command</span>
        <strong>{auditPackage.incidentRoom?.finalCommand ?? auditPackage.agentCouncil?.managerSummary ?? 'Not recorded'}</strong>
      </div>
    </div>
  );
}

function ResultSummaryGrid({ auditPackage, storageResult }: { auditPackage: AuditPackage; storageResult: AuditStorageResult }) {
  return (
    <div className="resultSummaryGrid" aria-label="Archive summary">
      <div>
        <span>Audit ID</span>
        <strong>{auditPackage.id}</strong>
      </div>
      <div>
        <span>Mode / Provider</span>
        <strong>
          {auditPackage.execution.mode} · {storageResult.provider ?? storageResult.mode}
        </strong>
      </div>
      <div>
        <span>Receipt</span>
        <strong>{auditPackage.receiptProof ? 'Minted' : 'Ready to mint'}</strong>
      </div>
      <div>
        <span>Archive payer</span>
        <strong>{archivePaymentLabel(storageResult)}</strong>
      </div>
    </div>
  );
}

function ResultEvidenceGrid({ auditPackage }: { auditPackage: AuditPackage }) {
  const signedEvidence = auditPackage.execution.signedPreparedPtb;
  const intent = auditPackage.executionIntent;

  return (
    <div className="resultEvidenceGrid" aria-label="Signature and boundary summary">
      <div>
        <span>Evidence signature</span>
        <strong>{signedEvidence?.messageDigest ?? signedEvidence?.bytesDigest ?? 'Awaiting signature'}</strong>
        <small>{signedEvidence?.signedAt ? formatDateTime(signedEvidence.signedAt) : 'Written into the archive after signing'}</small>
      </div>
      <div>
        <span>Policy object</span>
        <strong>{auditPackage.policyObjectId ? formatAddress(auditPackage.policyObjectId) : 'Not bound'}</strong>
        <small>{auditPackage.policyCheck.ok ? 'Policy passed' : 'Policy blocked'}</small>
      </div>
      <div>
        <span>Execution intent</span>
        <strong>{intent?.executionIntentId ?? signedEvidence?.executionIntentId ?? 'Not recorded'}</strong>
        <small>{intent ? `Expires ${formatDateTime(intent.intentExpiresAt)}` : 'Archive package is not bound to an intent'}</small>
      </div>
      <div>
        <span>Submit status</span>
        <strong>{signedEvidence?.submitted === false ? 'Not submitted' : auditPackage.execution.status}</strong>
        <small>Archives evidence only by default. No Live transaction is sent.</small>
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
          <p className="eyebrow">Prepare result</p>
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
            Estimated after
          </div>
          <div className="metricValue">
            {archivedRiskAfter ? archivedRiskAfter.overallScore : '—'}{' '}
            <span className="metricInline">{archivedRiskAfter ? `(${formatRiskLevel(archivedRiskAfter.overallLevel)})` : ''}</span>
          </div>
        </div>
      </div>

      <ResultProofStrip auditPackage={auditPackage} storageResult={storageResult} />
      <ResultSummaryGrid auditPackage={auditPackage} storageResult={storageResult} />
      <ResultEvidenceGrid auditPackage={auditPackage} />
    </section>
  );
}
