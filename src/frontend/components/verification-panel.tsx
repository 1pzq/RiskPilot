'use client';

import { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Copy, ExternalLink, FileJson2 } from 'lucide-react';

import { LATEST_MAINNET_PROOF, type MainnetProof } from '@/lib/verification/latest-mainnet-proof';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { formatNumber } from '@/lib/utils/format';

type VerificationPanelProps = {
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  onOpenAudit?: () => void;
};

type ProofCard = {
  label: string;
  badge: string;
  proof: MainnetProof;
  auditPackage?: AuditPackage | null;
  active: boolean;
};

type ProofEvidenceItem = {
  label: string;
  value: string;
  copyLabel?: string;
  wide?: boolean;
};

function commandFor(kind: 'read' | 'status', blobId: string): string {
  return kind === 'read'
    ? `walrus read ${blobId} --out /tmp/riskpilot-walrus-read.json`
    : `walrus blob-status --blob-id ${blobId}`;
}

function proofFromStorage(auditPackage: AuditPackage, storageResult: AuditStorageResult): MainnetProof {
  return {
    verifiedAt: auditPackage.createdAt,
    auditId: auditPackage.id,
    blobId: storageResult.id,
    blobObjectId: storageResult.blobObjectId ?? 'pending',
    registerTx: storageResult.registerDigest ?? 'pending',
    certifyTx: storageResult.certifyDigest ?? 'pending',
    blobSizeBytes: storageResult.sizeBytes ?? 0,
    checksum: storageResult.checksum,
    readbackUrl:
      storageResult.url ??
      `https://aggregator.mainnet.walrus.space/v1/blobs/${encodeURIComponent(storageResult.id)}`,
    walrusReadCommand: commandFor('read', storageResult.id),
    walrusStatusCommand: commandFor('status', storageResult.id),
    source: 'current_session_archive',
  };
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="iconTextButton"
      type="button"
      title={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

function ProofEvidenceRow({ item }: { item: ProofEvidenceItem }) {
  return (
    <div className={`proofEvidenceRow ${item.wide ? 'proofEvidenceRowWide' : ''}`}>
      <div>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </div>
      {item.copyLabel ? <CopyButton value={item.value} label={item.copyLabel} /> : null}
    </div>
  );
}

function ProofRows({ card }: { card: ProofCard }) {
  const proof = card.proof;
  const primaryRows: ProofEvidenceItem[] = [
    { label: 'Walrus blob ID', value: proof.blobId, copyLabel: 'Copy blob' },
    { label: 'Blob object ID', value: proof.blobObjectId, copyLabel: 'Copy object' },
    { label: 'Register tx', value: proof.registerTx, copyLabel: 'Copy register' },
    { label: 'Certify tx', value: proof.certifyTx, copyLabel: 'Copy certify' },
  ];
  const secondaryRows: ProofEvidenceItem[] = [
    { label: 'Verified at', value: proof.verifiedAt },
    {
      label: 'Blob size',
      value: proof.blobSizeBytes ? `${formatNumber(proof.blobSizeBytes)} bytes` : 'Pending',
    },
    { label: 'Checksum', value: proof.checksum ?? 'Not recorded' },
    { label: 'Walrus readback command', value: proof.walrusReadCommand, copyLabel: 'Copy read', wide: true },
    { label: 'Walrus status command', value: proof.walrusStatusCommand, copyLabel: 'Copy status', wide: true },
  ];

  return (
    <div className={`proofCard ${card.active ? 'proofCardActive' : ''}`}>
      <div className="proofCardHeader">
        <div>
          <span>{card.label}</span>
          <strong>{proof.auditId}</strong>
        </div>
        <em>{card.badge}</em>
      </div>

      <div className="proofEvidenceRows">
        {primaryRows.map((item) => (
          <ProofEvidenceRow item={item} key={`${proof.auditId}-${item.label}`} />
        ))}
      </div>

      <details className="proofDetailDrawer">
          <summary>Readback commands and checksum</summary>
        <div className="proofEvidenceRows proofEvidenceRowsSecondary">
          {secondaryRows.map((item) => (
            <ProofEvidenceRow item={item} key={`${proof.auditId}-${item.label}`} />
          ))}
        </div>
      </details>

      <div className="proofCommandRow">
        <CopyButton value={proof.walrusReadCommand} label="Copy read" />
        <CopyButton value={proof.walrusStatusCommand} label="Copy status" />
        <a className="iconTextButton" href={proof.readbackUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          <span>Readback</span>
        </a>
      </div>
    </div>
  );
}

export function VerificationPanel({ auditPackage, storageResult, onOpenAudit }: VerificationPanelProps) {
  const cards = useMemo<ProofCard[]>(() => {
    const currentCard =
      auditPackage && storageResult
        ? [
            {
              label: 'Current session archive',
              badge: 'Current',
              proof: proofFromStorage(auditPackage, storageResult),
              auditPackage,
              active: true,
            },
          ]
        : [];

    return [
      ...currentCard,
      {
        label: 'Latest verified mainnet sample',
        badge: 'Verified sample',
        proof: LATEST_MAINNET_PROOF,
        active: currentCard.length === 0,
      },
    ];
  }, [auditPackage, storageResult]);
  const [primaryCard, ...secondaryCards] = cards;

  return (
    <section className="panel verificationPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Verification</p>
          <h2 className="panelTitle">Walrus replayable proof rail</h2>
        </div>
        <span className="pill pillSuccess">
          <Archive size={14} />
          mainnet
        </span>
      </div>

      <div className="proofCardStack">
        {primaryCard ? <ProofRows card={primaryCard} key={`${primaryCard.badge}-${primaryCard.proof.auditId}`} /> : null}
        {secondaryCards.length > 0 ? (
          <details className="proofSampleDrawer">
            <summary>Sample</summary>
            {secondaryCards.map((card) => (
              <ProofRows card={card} key={`${card.badge}-${card.proof.auditId}`} />
            ))}
          </details>
        ) : null}
      </div>

      <div className="proofPanelFooter">
        <span>
          <FileJson2 size={14} />
          {storageResult ? 'Current archive is available for readback review.' : 'Showing the latest verified sample when no wallet is connected.'}
        </span>
        {onOpenAudit ? (
          <button className="iconTextButton" type="button" onClick={onOpenAudit}>
            <ExternalLink size={14} />
            <span>Audit explorer</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
