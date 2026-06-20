'use client';

import { History, Trash2 } from 'lucide-react';

import type { ArchiveHistoryEntry } from '@/lib/walrus/archive-history';
import { formatAddress, formatDateTime } from '@/lib/utils/format';

type ArchiveHistoryPanelProps = {
  entries: ArchiveHistoryEntry[];
  activeAuditId?: string;
  compact?: boolean;
  onClear?: () => void;
};

export function ArchiveHistoryPanel({
  entries,
  activeAuditId,
  compact = false,
  onClear,
}: ArchiveHistoryPanelProps) {
  const latest = entries[0];

  return (
    <section className={`panel archiveHistoryPanel ${compact ? 'archiveHistoryPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Archive history</p>
          <h2 className="panelTitle">Recent reusable evidence</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${latest ? 'pillSuccess' : 'pillMuted'}`}>
            {latest ? `${entries.length} local records` : 'Empty'}
          </span>
          {onClear && entries.length > 0 ? (
            <button className="iconButton" type="button" onClick={onClear} aria-label="Clear archive history">
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="archiveHistoryList" aria-label="Recent Walrus archives">
          {entries.map((entry) => {
            const active = entry.auditId === activeAuditId;

            return (
              <article className={`archiveHistoryItem ${active ? 'archiveHistoryItemActive' : ''}`} key={`${entry.auditId}:${entry.storageId}`}>
                <div className="archiveHistoryItemHead">
                  <div>
                    <span>{formatDateTime(entry.createdAt)}</span>
                    <strong>{entry.auditId}</strong>
                  </div>
                  <span className={`pill ${active ? 'pillSuccess' : 'pillNeutral'}`}>
                    {active ? 'Open' : entry.executionStatus}
                  </span>
                </div>

                <div className="archiveHistoryFields">
                  <div>
                    <span>Wallet</span>
                    <strong>{formatAddress(entry.walletAddress)}</strong>
                  </div>
                  <div>
                    <span>Walrus blob</span>
                    <strong>{entry.storageId}</strong>
                  </div>
                  <div>
                    <span>Register digest</span>
                    <strong>{entry.registerDigest ?? 'Proof pending'}</strong>
                  </div>
                  <div>
                    <span>Certify digest</span>
                    <strong>{entry.certifyDigest ?? 'Proof pending'}</strong>
                  </div>
                </div>

                {entry.receiptProof ? (
                  <details className="archiveHistoryMore">
                    <summary>StrategyReceipt proof</summary>
                    <div className="archiveHistoryFields archiveHistoryFieldsSecondary">
                      <div>
                        <span>Receipt tx</span>
                        <strong>{entry.receiptProof.receiptDigest}</strong>
                      </div>
                      <div>
                        <span>Receipt object</span>
                        <strong>{entry.receiptProof.receiptObjectId ?? 'Object pending'}</strong>
                      </div>
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="archiveHistoryEmpty">
          <History size={18} />
          <strong>No local archive history yet.</strong>
          <span>After a wallet-paid Walrus archive succeeds, RiskPilot keeps a local readback card with the audit id, blob id, and Sui digests.</span>
        </div>
      )}
    </section>
  );
}
