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
  return mode === 'mainnet' ? 'Mainnet 交易已归档' : 'Prepared 动作已归档';
}

function archivePaymentLabel(storageResult: AuditStorageResult): string {
  return storageResult.paymentLabel ?? '已连接钱包';
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

function ResultSummaryGrid({ auditPackage, storageResult }: { auditPackage: AuditPackage; storageResult: AuditStorageResult }) {
  return (
    <div className="resultSummaryGrid" aria-label="归档摘要">
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
        <strong>{auditPackage.receiptProof ? '已 mint' : '可 mint'}</strong>
      </div>
      <div>
        <span>归档支付方</span>
        <strong>{archivePaymentLabel(storageResult)}</strong>
      </div>
    </div>
  );
}

function ResultEvidenceGrid({ auditPackage }: { auditPackage: AuditPackage }) {
  const signedEvidence = auditPackage.execution.signedPreparedPtb;
  const intent = auditPackage.executionIntent;

  return (
    <div className="resultEvidenceGrid" aria-label="签名与约束摘要">
      <div>
        <span>签名证明</span>
        <strong>{signedEvidence?.messageDigest ?? signedEvidence?.bytesDigest ?? '等待签名'}</strong>
        <small>{signedEvidence?.signedAt ? formatDateTime(signedEvidence.signedAt) : '签名后写入归档包'}</small>
      </div>
      <div>
        <span>Policy object</span>
        <strong>{auditPackage.policyObjectId ? formatAddress(auditPackage.policyObjectId) : '未绑定'}</strong>
        <small>{auditPackage.policyCheck.ok ? 'Policy 已通过' : 'Policy 已阻断'}</small>
      </div>
      <div>
        <span>Execution intent</span>
        <strong>{intent?.executionIntentId ?? signedEvidence?.executionIntentId ?? '未记录'}</strong>
        <small>{intent ? `过期 ${formatDateTime(intent.intentExpiresAt)}` : '归档包未绑定 intent'}</small>
      </div>
      <div>
        <span>提交状态</span>
        <strong>{signedEvidence?.submitted === false ? '未提交交易' : auditPackage.execution.status}</strong>
        <small>默认只归档证据，不发起 Live 交易</small>
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
      <ResultSummaryGrid auditPackage={auditPackage} storageResult={storageResult} />
      <ResultEvidenceGrid auditPackage={auditPackage} />
    </section>
  );
}
