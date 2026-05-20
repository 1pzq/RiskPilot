'use client';

import { FileJson2, Sparkles } from 'lucide-react';

type AuditLogPanelProps = {
  explanation: string;
  explanationMode: string;
  explanationStatus: string;
  storageMode: string;
  storageId: string;
  storageUrl?: string;
  onRefresh: () => void;
  refreshing: boolean;
};

export function AuditLogPanel({
  explanation,
  explanationMode,
  explanationStatus,
  storageMode,
  storageId,
  storageUrl,
  onRefresh,
  refreshing,
}: AuditLogPanelProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Decision note</p>
          <h2 className="panelTitle">Risk explanation</h2>
        </div>
        <button className="button buttonGhost" type="button" onClick={onRefresh} disabled={refreshing}>
          <Sparkles size={14} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="statusLine">
        <span className="pill pillMuted">{explanationMode}</span>
        <span className="pill pillNeutral">{explanationStatus}</span>
        <span className="pill pillAccent">{storageMode}</span>
      </div>

      <p className="panelCopy">{explanation}</p>

      <div className="positionBlock">
        <div className="positionLine">
          <span>Audit id</span>
          <span>{storageId || 'pending'}</span>
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
        <span>Audit JSON appears after the mainnet action is prepared.</span>
      </div>
    </section>
  );
}
