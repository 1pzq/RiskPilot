'use client';

import { CheckCircle2, FileJson2, ShieldCheck } from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import type { RiskReport } from '@/lib/risk/types';
import { formatRiskLevel, formatUsd } from '@/lib/utils/format';
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

  return (
    <section className="panel resultPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Prepared result</p>
          <h2 className="panelTitle">Prepared action archived</h2>
        </div>
        <span className={`pill ${storageResult.mode === 'walrus' ? 'pillSuccess' : 'pillWarn'}`}>
          {storageResult.mode}
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
            {riskBefore.overallScore} <span className="metricInline">({formatRiskLevel(riskBefore.overallLevel)})</span>
          </div>
        </div>
        <div className="resultMetric">
          <div className="metricLabel">
            <CheckCircle2 size={14} />
            After est.
          </div>
          <div className="metricValue">
            {riskAfter ? riskAfter.overallScore : '—'}{' '}
            <span className="metricInline">{riskAfter ? `(${formatRiskLevel(riskAfter.overallLevel)})` : ''}</span>
          </div>
        </div>
      </div>

      <div className="positionBlock">
        <div className="positionLine">
          <span>Venue</span>
          <span>{auditPackage.execution.adapter?.venue ?? 'DeepBook mainnet'}</span>
        </div>
        <div className="positionLine">
          <span>{executionIdentifierLabel(auditPackage.execution.mode)}</span>
          <span>{auditPackage.execution.digest ?? auditPackage.execution.simulationId ?? 'pending'}</span>
        </div>
        <div className="positionLine">
          <span>Archive</span>
          <span>{storageResult.id}</span>
        </div>
        {storageResult.checksum ? (
          <div className="positionLine">
            <span>Checksum</span>
            <span>{storageResult.checksum.slice(0, 16)}</span>
          </div>
        ) : null}
        <div className="positionLine">
          <span>Cost</span>
          <span>{formatUsd(auditPackage.recommendation.estimatedCostUsd)}</span>
        </div>
        {auditPackage.execution.preparedTransactionSummary ? (
          <div className="positionLine">
            <span>Summary</span>
            <span>{auditPackage.execution.preparedTransactionSummary}</span>
          </div>
        ) : null}
      </div>

      {warning ? <div className="warningStrip inline">{warning}</div> : null}

      <JsonViewer title="Audit JSON" value={auditPackage} />

      <div className="noteRow">
        <FileJson2 size={14} />
        <span>Prepared action details and estimated post-risk are recorded without live submission.</span>
      </div>
    </section>
  );
}
