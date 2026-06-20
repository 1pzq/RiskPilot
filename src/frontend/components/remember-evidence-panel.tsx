'use client';

import { Archive, CheckCircle2, FileSignature, WalletCards } from 'lucide-react';

import { executionDigestForReceipt, type SignedPreparedPtb } from '@/lib/sui/prepared-ptb';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { formatAddress, formatDateTime } from '@/lib/utils/format';

type RememberEvidencePanelProps = {
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  signedPreparedPtb: SignedPreparedPtb | null;
  accountAddress?: string;
};

function evidenceDigest(auditPackage: AuditPackage | null, signedPreparedPtb: SignedPreparedPtb | null) {
  if (!auditPackage) {
    return signedPreparedPtb?.bytesDigest ?? 'Awaiting signed PTB';
  }

  return executionDigestForReceipt({
    signedPreparedPtb: auditPackage.execution.signedPreparedPtb,
    digest: auditPackage.execution.digest,
    preparedTransactionSummary: auditPackage.execution.preparedTransactionSummary,
    fallbackId: auditPackage.id,
  });
}

function signerLabel(signedPreparedPtb: SignedPreparedPtb | null, accountAddress?: string) {
  const signer = signedPreparedPtb?.signer ?? accountAddress;

  return signer ? formatAddress(signer) : 'Awaiting wallet signature';
}

function statusLabel(status: 'receipt ready' | 'archived' | 'signed' | 'waiting') {
  if (status === 'receipt ready') {
    return 'Receipt ready';
  }

  if (status === 'archived') {
    return 'Walrus archived';
  }

  if (status === 'signed') {
    return 'Signed, awaiting archive';
  }

  return 'Awaiting signature';
}

export function RememberEvidencePanel({
  auditPackage,
  storageResult,
  signedPreparedPtb,
  accountAddress,
}: RememberEvidencePanelProps) {
  const receiptProof = auditPackage?.receiptProof;
  const digest = receiptProof?.executionDigest ?? evidenceDigest(auditPackage, signedPreparedPtb);
  const status = receiptProof ? 'receipt ready' : storageResult ? 'archived' : signedPreparedPtb ? 'signed' : 'waiting';

  return (
    <section className="panel rememberEvidencePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Remember evidence</p>
          <h2 className="panelTitle">Replayable evidence</h2>
        </div>
        <span className={`pill ${receiptProof ? 'pillSuccess' : storageResult ? 'pillAccent' : signedPreparedPtb ? 'pillWarn' : 'pillMuted'}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="rememberEvidenceGrid" aria-label="Remember evidence summary">
        <div className="rememberEvidenceItem rememberEvidenceSigner">
          <WalletCards size={16} />
          <span>Signer</span>
          <strong>{signerLabel(signedPreparedPtb, accountAddress)}</strong>
          <em>{signedPreparedPtb?.signedAt ? formatDateTime(signedPreparedPtb.signedAt) : 'Wallet signature required before archive'}</em>
        </div>
        <div className="rememberEvidenceItem rememberEvidenceDigest">
          <FileSignature size={16} />
          <span>Signed payload</span>
          <strong>{digest}</strong>
          <em>prepared PTB digest; signing still does not auto-submit</em>
        </div>
        <div className="rememberEvidenceItem rememberEvidenceBlob">
          <Archive size={16} />
          <span>Archive target</span>
          <strong>{storageResult?.id ?? 'Awaiting Walrus blob'}</strong>
          <em>{storageResult?.registerDigest ?? storageResult?.certifyDigest ?? 'Awaiting register / certify'}</em>
        </div>
        <div className="rememberEvidenceItem rememberEvidenceReceipt">
          <CheckCircle2 size={16} />
          <span>Review path</span>
          <strong>{receiptProof?.receiptObjectId ? formatAddress(receiptProof.receiptObjectId) : receiptProof?.receiptDigest ?? 'Receipt pending'}</strong>
          <em>{receiptProof ? `tx ${receiptProof.receiptDigest}` : 'Receipt can be minted after archive'}</em>
        </div>
      </div>

    </section>
  );
}
