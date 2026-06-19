'use client';

import { FileJson2, Sparkles } from 'lucide-react';

type AuditLogPanelProps = {
  explanation: string;
  explanationMode: string;
  explanationStatus: string;
  storageMode: string;
  storageId: string;
  storageUrl?: string;
  storagePaymentLabel?: string;
  onRefresh: () => void;
  refreshing: boolean;
  compact?: boolean;
};

export function AuditLogPanel({
  explanation,
  explanationMode,
  explanationStatus,
  storageMode,
  storageId,
  storageUrl,
  storagePaymentLabel,
  onRefresh,
  refreshing,
  compact = false,
}: AuditLogPanelProps) {
  const archiveMetadata = (
    <>
      <div className="positionBlock">
        <div className="positionLine">
          <span>Audit id</span>
          <span>{storageId || '待处理'}</span>
        </div>
        <div className="positionLine">
          <span>归档支付方</span>
          <span>{storagePaymentLabel ?? '需要连接钱包'}</span>
        </div>
        {storageUrl ? (
          <div className="positionLine">
            <span>URL</span>
            <span>{storageUrl}</span>
          </div>
        ) : null}
      </div>

      <div className="noteRow">
        <FileJson2 size={14} />
        <span>Audit JSON 会在 mainnet 动作准备完成后出现。Walrus 归档的 register 和 certify 必须由已连接钱包签名并支付。</span>
      </div>
    </>
  );

  return (
    <section className={`panel auditLogPanel ${compact ? 'auditLogPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">决策说明</p>
          <h2 className="panelTitle">风险解释</h2>
        </div>
        <button className="button buttonGhost" type="button" onClick={onRefresh} disabled={refreshing}>
          <Sparkles size={14} />
          {refreshing ? '刷新中' : '刷新'}
        </button>
      </div>

      <div className="statusLine">
        <span className="pill pillMuted">{explanationMode}</span>
        <span className="pill pillNeutral">{explanationStatus}</span>
        <span className="pill pillAccent">{storageMode}</span>
      </div>

      <p className="panelCopy auditExplanationText">{explanation}</p>

      {compact ? null : archiveMetadata}
    </section>
  );
}
