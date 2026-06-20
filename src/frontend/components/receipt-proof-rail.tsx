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
  const auditBlobId = storageResult?.id ?? 'Walrus archive required first';
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
            <strong>{receiptProof.receiptObjectId ?? 'Created object pending in wallet response'}</strong>
          </div>
        </div>
      ) : null}

      <div className="receiptProofBoundary">
        <Link2 size={14} />
        <Wallet size={14} />
        <span>
          {accountAddress
            ? `Signer: ${formatAddress(accountAddress)}`
            : 'Receipt mint must be explicitly signed by the connected wallet.'}
        </span>
        <FileCheck2 size={14} />
        <span>{RECEIPT_PACKAGE_ID ? `Package: ${formatAddress(RECEIPT_PACKAGE_ID)}` : 'Receipt package not configured.'}</span>
      </div>
    </>
  );

  return (
    <section className={`panel receiptProofRailPanel ${compact ? 'receiptProofRailCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Post-archive proof rail</p>
          <h2 className="panelTitle">StrategyReceipt link preview</h2>
        </div>
        <span className={`pill ${receiptProof ? 'pillSuccess' : storageResult ? 'pillWarn' : 'pillMuted'}`}>
          <FileCheck2 size={14} />
          {receiptProof ? 'Minted' : storageResult ? 'Ready to mint' : 'After archive'}
        </span>
      </div>

      {compact ? (
        <>
          <div className="receiptProofCompactGrid">
            <div>
              <span>Receipt</span>
              <strong>{receiptProof ? 'Minted' : storageResult ? 'Ready to mint' : 'After archive'}</strong>
            </div>
            <div>
              <span>Blob</span>
              <strong>{storageResult?.id ?? 'Pending'}</strong>
            </div>
          </div>
          <details className="receiptProofDrawer" open={Boolean(receiptProof)}>
            <summary>{receiptProof ? 'Show minted receipt proof' : 'Show receipt link fields'}</summary>
            {receiptDetails}
          </details>
        </>
      ) : (
        receiptDetails
      )}
    </section>
  );
}
