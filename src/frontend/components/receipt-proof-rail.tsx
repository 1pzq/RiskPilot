'use client';

import { FileCheck2, Link2, Wallet } from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { RECEIPT_PACKAGE_ID } from '@/lib/sui/receipt';
import { executionDigestForReceipt } from '@/lib/sui/prepared-ptb';
import { formatAddress } from '@/lib/utils/format';

type ReceiptProofRailProps = {
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  accountAddress?: string;
  recommendationId: string;
  executionDigestPreview: string;
  compact?: boolean;
};

export function ReceiptProofRail({
  auditPackage,
  storageResult,
  accountAddress,
  recommendationId,
  executionDigestPreview,
  compact = false,
}: ReceiptProofRailProps) {
  const receiptProof = auditPackage?.receiptProof;
  const auditBlobId = storageResult?.id ?? '需要先完成 Walrus 归档';
  const executionDigest =
    receiptProof?.executionDigest ??
    (auditPackage
      ? executionDigestForReceipt({
          signedPreparedPtb: auditPackage.execution.signedPreparedPtb,
          digest: auditPackage.execution.digest,
          preparedTransactionSummary: auditPackage.execution.preparedTransactionSummary,
          fallbackId: auditPackage.id,
        })
      : executionDigestPreview);
  const receiptDetails = (
    <>
      <div className="receiptProofPreview" aria-label="StrategyReceipt proof link preview">
        <div>
          <span>Strategy ID</span>
          <strong>{recommendationId}</strong>
        </div>
        <div>
          <span>Walrus blob ID</span>
          <strong>{auditBlobId}</strong>
        </div>
        <div>
          <span>Execution digest</span>
          <strong>{executionDigest}</strong>
        </div>
      </div>

      {receiptProof ? (
        <div className="receiptProofMinted">
          <div>
            <span>Receipt tx</span>
            <strong>{receiptProof.receiptDigest}</strong>
          </div>
          <div>
            <span>Receipt object</span>
            <strong>{receiptProof.receiptObjectId ?? '钱包响应中创建对象待定'}</strong>
          </div>
        </div>
      ) : null}

      <div className="receiptProofBoundary">
        <Link2 size={14} />
        <Wallet size={14} />
        <span>
          {accountAddress
            ? `签名者：${formatAddress(accountAddress)}`
            : '必须由已连接钱包显式签名 receipt mint。'}
        </span>
        <FileCheck2 size={14} />
        <span>{RECEIPT_PACKAGE_ID ? `Package：${formatAddress(RECEIPT_PACKAGE_ID)}` : 'Receipt package 未配置。'}</span>
      </div>
    </>
  );

  return (
    <section className={`panel receiptProofRailPanel ${compact ? 'receiptProofRailCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">归档后证明轨</p>
          <h2 className="panelTitle">StrategyReceipt 链接预览</h2>
        </div>
        <span className={`pill ${receiptProof ? 'pillSuccess' : storageResult ? 'pillWarn' : 'pillMuted'}`}>
          <FileCheck2 size={14} />
          {receiptProof ? '已 mint' : storageResult ? '可 mint' : '归档后'}
        </span>
      </div>

      {compact ? (
        <>
          <div className="receiptProofCompactGrid">
            <div>
              <span>Receipt</span>
              <strong>{receiptProof ? '已 mint' : storageResult ? '可 mint' : '归档后'}</strong>
            </div>
            <div>
              <span>Blob</span>
              <strong>{storageResult?.id ?? '待处理'}</strong>
            </div>
          </div>
          <details className="receiptProofDrawer" open={Boolean(receiptProof)}>
            <summary>{receiptProof ? '显示已 mint 的 receipt 证明' : '显示 receipt 链接字段'}</summary>
            {receiptDetails}
          </details>
        </>
      ) : (
        receiptDetails
      )}
    </section>
  );
}
