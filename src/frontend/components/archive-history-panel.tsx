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
          <p className="eyebrow">归档历史</p>
          <h2 className="panelTitle">最近可复用的证据</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${latest ? 'pillSuccess' : 'pillMuted'}`}>
            {latest ? `${entries.length} 条本地记录` : '空'}
          </span>
          {onClear && entries.length > 0 ? (
            <button className="iconButton" type="button" onClick={onClear} aria-label="清空归档历史">
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="archiveHistoryList" aria-label="最近的 Walrus 归档">
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
                    {active ? '已打开' : entry.executionStatus}
                  </span>
                </div>

                <div className="archiveHistoryFields">
                  <div>
                    <span>钱包</span>
                    <strong>{formatAddress(entry.walletAddress)}</strong>
                  </div>
                  <div>
                    <span>Walrus blob</span>
                    <strong>{entry.storageId}</strong>
                  </div>
                  <div>
                    <span>Register digest</span>
                    <strong>{entry.registerDigest ?? '证据待定'}</strong>
                  </div>
                  <div>
                    <span>Certify digest</span>
                    <strong>{entry.certifyDigest ?? '证据待定'}</strong>
                  </div>
                </div>

                {entry.receiptProof ? (
                  <details className="archiveHistoryMore">
                    <summary>StrategyReceipt 证明</summary>
                    <div className="archiveHistoryFields archiveHistoryFieldsSecondary">
                      <div>
                        <span>Receipt tx</span>
                        <strong>{entry.receiptProof.receiptDigest}</strong>
                      </div>
                      <div>
                        <span>Receipt object</span>
                        <strong>{entry.receiptProof.receiptObjectId ?? '创建对象待定'}</strong>
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
          <strong>还没有本地归档历史。</strong>
          <span>钱包支付的 Walrus 归档成功后，RiskPilot 会保存本地回读卡片，包含 audit id、blob id 和 Sui digests。</span>
        </div>
      )}
    </section>
  );
}
