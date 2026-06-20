'use client';

import { Archive, CheckCircle2, FileCheck2, FileSignature, ShieldCheck, WalletCards } from 'lucide-react';

import type { ExecutionIntent } from '@/lib/security/execution-intent';
import { executionDigestForReceipt, type PreparedDeepBookPtb, type SignedPreparedPtb } from '@/lib/sui/prepared-ptb';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { formatAddress, formatDateTime } from '@/lib/utils/format';

type ProofOfAgentActionPanelProps = {
  policyObjectId?: string;
  executionIntent: ExecutionIntent | null;
  preparedPtb: PreparedDeepBookPtb;
  signedPreparedPtb: SignedPreparedPtb | null;
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
  receiptPackageId?: string;
  compact?: boolean;
};

type ProofStepTone = 'ready' | 'waiting' | 'blocked';

function shortValue(value?: string, fallback = 'Awaiting generation') {
  if (!value) {
    return fallback;
  }

  return value.startsWith('0x') ? formatAddress(value) : value;
}

function fullValue(value?: string) {
  return value || 'Not available';
}

function localizedPtbDetail(value: string) {
  return value
    .replace('DeepBook market snapshot is required before building the prepared PTB.', 'DeepBook market snapshot is required before building the prepared PTB.')
    .replace('not eligible', 'not available');
}

function statusLabel(input: {
  preparedPtb: PreparedDeepBookPtb;
  signedPreparedPtb: SignedPreparedPtb | null;
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
}) {
  if (input.auditPackage?.receiptProof) {
    return { label: 'Receipt minted', className: 'pillSuccess' };
  }

  if (input.storageResult) {
    return { label: 'Archived', className: 'pillAccent' };
  }

  if (input.signedPreparedPtb) {
    return { label: 'Signed, not submitted', className: 'pillWarn' };
  }

  if (input.preparedPtb.eligible) {
    return { label: 'PTB built', className: 'pillWarn' };
  }

  return { label: 'Blocked', className: 'pillDanger' };
}

function proofTone(value?: string, blocked?: boolean): ProofStepTone {
  if (blocked) {
    return 'blocked';
  }

  return value ? 'ready' : 'waiting';
}

export function ProofOfAgentActionPanel({
  policyObjectId,
  executionIntent,
  preparedPtb,
  signedPreparedPtb,
  auditPackage,
  storageResult,
  receiptPackageId,
  compact = false,
}: ProofOfAgentActionPanelProps) {
  const receiptProof = auditPackage?.receiptProof;
  const effectivePolicyObjectId = policyObjectId ?? auditPackage?.policyObjectId ?? receiptProof?.policyObjectId;
  const executionDigest = auditPackage
    ? executionDigestForReceipt({
        signedPreparedPtb: auditPackage.execution.signedPreparedPtb,
        digest: auditPackage.execution.digest,
        preparedTransactionSummary: auditPackage.execution.preparedTransactionSummary,
        fallbackId: auditPackage.id,
      })
    : signedPreparedPtb?.bytesDigest;
  const badge = statusLabel({ preparedPtb, signedPreparedPtb, auditPackage, storageResult });
  const signedAt = signedPreparedPtb?.signedAt ?? receiptProof?.mintedAt;
  const outcome = receiptProof
    ? 'Signed + archived + receipt'
    : storageResult
      ? 'Signed + archived'
      : signedPreparedPtb
        ? 'Signed, not submitted'
        : preparedPtb.eligible
          ? 'PTB prepared, awaiting signature'
          : 'Action blocked by boundaries';
  const summaryItems = [
    {
      label: 'Authority',
      value: effectivePolicyObjectId ? 'Policy verified' : 'Policy pending',
      tone: effectivePolicyObjectId ? 'ready' : 'waiting',
    },
    {
      label: 'Action',
      value: preparedPtb.eligible ? 'PTB prepared' : 'PTB not available',
      tone: preparedPtb.eligible ? 'ready' : 'blocked',
    },
    {
      label: 'Wallet',
      value: signedPreparedPtb ? 'Signed, not submitted' : 'Awaiting signature',
      tone: signedPreparedPtb ? 'ready' : 'waiting',
    },
    {
      label: 'Memory',
      value: storageResult ? 'Walrus archived' : 'Awaiting archive',
      tone: storageResult ? 'ready' : 'waiting',
    },
  ] as const;
  const steps = [
    {
      id: 'policy',
      icon: ShieldCheck,
      label: 'Policy object',
      value: shortValue(effectivePolicyObjectId, 'Mint / selection required'),
      detail: fullValue(effectivePolicyObjectId),
      tone: proofTone(effectivePolicyObjectId),
    },
    {
      id: 'intent',
      icon: FileCheck2,
      label: 'Execution intent',
      value: executionIntent?.executionIntentId ?? auditPackage?.executionIntent?.executionIntentId ?? 'Awaiting lock',
      detail: executionIntent
        ? `expires ${formatDateTime(executionIntent.intentExpiresAt)}`
        : 'Risk, Policy, and recommendation digests are not locked yet',
      tone: proofTone(executionIntent?.executionIntentId ?? auditPackage?.executionIntent?.executionIntentId),
    },
    {
      id: 'ptb',
      icon: FileSignature,
      label: 'Prepared PTB digest',
      value: signedPreparedPtb?.bytesDigest ?? executionDigest ?? (preparedPtb.eligible ? 'Built, awaiting signature' : 'Cannot build'),
      detail: signedPreparedPtb
        ? 'Wallet signed the prepared evidence message'
        : localizedPtbDetail(preparedPtb.reason ?? preparedPtb.safety.note),
      tone: proofTone(signedPreparedPtb?.bytesDigest ?? executionDigest, !preparedPtb.eligible),
    },
    {
      id: 'signature',
      icon: WalletCards,
      label: 'Wallet signature',
      value: signedPreparedPtb ? formatAddress(signedPreparedPtb.signer) : 'Wallet signature required',
      detail: signedPreparedPtb
        ? `signed ${signedAt ? formatDateTime(signedAt) : 'for current intent'}`
        : 'Signature is required before Walrus archive',
      tone: proofTone(signedPreparedPtb?.signature),
    },
    {
      id: 'walrus',
      icon: Archive,
      label: 'Walrus blob',
      value: storageResult?.id ?? 'Generated after archive',
      detail: storageResult?.url ?? storageResult?.registerDigest ?? 'Signed prepared action is not archived yet',
      tone: proofTone(storageResult?.id),
    },
    {
      id: 'receipt',
      icon: CheckCircle2,
      label: 'StrategyReceipt',
      value: receiptProof?.receiptObjectId ? formatAddress(receiptProof.receiptObjectId) : receiptProof?.receiptDigest ?? 'Ready to mint after archive',
      detail: receiptProof
        ? `tx ${receiptProof.receiptDigest}`
        : receiptPackageId
          ? `package ${formatAddress(receiptPackageId)}`
          : 'receipt package not configured',
      tone: proofTone(receiptProof?.receiptDigest),
    },
  ] as const;

  return (
    <section className={`panel proofOfAgentActionPanel ${compact ? 'proofOfAgentActionPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Proof of Agent Action</p>
          <h2 className="panelTitle">{outcome}</h2>
        </div>
        <span className={`pill ${badge.className}`}>{badge.label}</span>
      </div>

      <div className="proofOutcomeStrip" aria-label="Agent proof status">
        {summaryItems.map((item) => (
          <div className={`proofOutcomeItem proofOutcomeItem-${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="proofActionChain" aria-label="Proof of agent action chain">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <article className={`proofActionStep proofActionStep-${step.tone}`} key={step.id}>
              <div className="proofActionIndex">
                <Icon size={15} />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div className="proofActionBody">
                <span>{step.label}</span>
                <strong title={step.value}>{step.value}</strong>
                <em title={step.detail}>{step.detail}</em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
