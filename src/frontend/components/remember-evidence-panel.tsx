'use client';

import { Archive, CheckCircle2, ExternalLink, FileSignature, RotateCcw, WalletCards } from 'lucide-react';

import { executionDigestForReceipt, type SignedPreparedPtb } from '@/lib/sui/prepared-ptb';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { formatAddress, formatDateTime } from '@/lib/utils/format';

type RememberEvidencePanelProps = {
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  signedPreparedPtb: SignedPreparedPtb | null;
  accountAddress?: string;
  onOpenLatest?: () => void;
};

function evidenceDigest(auditPackage: AuditPackage | null, signedPreparedPtb: SignedPreparedPtb | null) {
  if (!auditPackage) {
    return signedPreparedPtb?.bytesDigest ?? '等待 signed PTB';
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

  return signer ? formatAddress(signer) : '等待钱包签名';
}

function statusLabel(status: 'receipt ready' | 'archived' | 'signed' | 'waiting') {
  if (status === 'receipt ready') {
    return 'Receipt 就绪';
  }

  if (status === 'archived') {
    return 'Walrus 已归档';
  }

  if (status === 'signed') {
    return '已签名待归档';
  }

  return '等待签名';
}

export function RememberEvidencePanel({
  auditPackage,
  storageResult,
  signedPreparedPtb,
  accountAddress,
  onOpenLatest,
}: RememberEvidencePanelProps) {
  const receiptProof = auditPackage?.receiptProof;
  const digest = receiptProof?.executionDigest ?? evidenceDigest(auditPackage, signedPreparedPtb);
  const status = receiptProof ? 'receipt ready' : storageResult ? 'archived' : signedPreparedPtb ? 'signed' : 'waiting';

  return (
    <section className="panel rememberEvidencePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Remember evidence</p>
          <h2 className="panelTitle">可回放证据</h2>
        </div>
        <span className={`pill ${receiptProof ? 'pillSuccess' : storageResult ? 'pillAccent' : signedPreparedPtb ? 'pillWarn' : 'pillMuted'}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="rememberEvidenceGrid" aria-label="Remember evidence summary">
        <div className="rememberEvidenceItem rememberEvidenceSigner">
          <WalletCards size={16} />
          <span>谁签了</span>
          <strong>{signerLabel(signedPreparedPtb, accountAddress)}</strong>
          <em>{signedPreparedPtb?.signedAt ? formatDateTime(signedPreparedPtb.signedAt) : '归档前需要钱包签名'}</em>
        </div>
        <div className="rememberEvidenceItem rememberEvidenceDigest">
          <FileSignature size={16} />
          <span>签了什么</span>
          <strong>{digest}</strong>
          <em>prepared PTB digest，签名后仍不会自动提交</em>
        </div>
        <div className="rememberEvidenceItem rememberEvidenceBlob">
          <Archive size={16} />
          <span>归档到了哪里</span>
          <strong>{storageResult?.id ?? '等待 Walrus blob'}</strong>
          <em>{storageResult?.registerDigest ?? storageResult?.certifyDigest ?? '等待 register / certify'}</em>
        </div>
        <div className="rememberEvidenceItem rememberEvidenceReceipt">
          <CheckCircle2 size={16} />
          <span>如何复核</span>
          <strong>{receiptProof?.receiptObjectId ? formatAddress(receiptProof.receiptObjectId) : receiptProof?.receiptDigest ?? 'Receipt 待生成'}</strong>
          <em>{receiptProof ? `tx ${receiptProof.receiptDigest}` : '归档后可 mint receipt'}</em>
        </div>
      </div>

      <div className="rememberEvidenceActions">
        {storageResult?.url ? (
          <a className="button buttonGhost" href={storageResult.url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            验证 Walrus
          </a>
        ) : null}
        {onOpenLatest ? (
          <button className="button buttonGhost" type="button" onClick={onOpenLatest}>
            <RotateCcw size={15} />
            载入本地证明
          </button>
        ) : null}
      </div>
    </section>
  );
}
