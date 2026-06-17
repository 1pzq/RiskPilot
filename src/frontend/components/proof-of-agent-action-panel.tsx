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

function shortValue(value?: string, fallback = '等待生成') {
  if (!value) {
    return fallback;
  }

  return value.startsWith('0x') ? formatAddress(value) : value;
}

function fullValue(value?: string) {
  return value || '暂不可用';
}

function localizedPtbDetail(value: string) {
  return value
    .replace(
      'DeepBook market snapshot is required before building the prepared PTB.',
      '构建 prepared PTB 前需要 DeepBook 市场快照。',
    )
    .replace('not eligible', '暂不可用');
}

function statusLabel(input: {
  preparedPtb: PreparedDeepBookPtb;
  signedPreparedPtb: SignedPreparedPtb | null;
  auditPackage: AuditPackage | null;
  storageResult: AuditStorageResult | null;
}) {
  if (input.auditPackage?.receiptProof) {
    return { label: 'Receipt 已 mint', className: 'pillSuccess' };
  }

  if (input.storageResult) {
    return { label: '已归档', className: 'pillAccent' };
  }

  if (input.signedPreparedPtb) {
    return { label: '已签名，未提交', className: 'pillWarn' };
  }

  if (input.preparedPtb.eligible) {
    return { label: 'PTB 已构建', className: 'pillWarn' };
  }

  return { label: '已阻断', className: 'pillDanger' };
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
    ? '已签名 + 已归档 + Receipt'
    : storageResult
      ? '已签名 + 已归档'
      : signedPreparedPtb
        ? '已签名，未提交'
        : preparedPtb.eligible
          ? 'PTB 已准备，等待签名'
          : '动作已被边界阻断';
  const summaryItems = [
    {
      label: 'Authority',
      value: effectivePolicyObjectId ? 'Policy 已验证' : 'Policy 待确认',
      tone: effectivePolicyObjectId ? 'ready' : 'waiting',
    },
    {
      label: 'Action',
      value: preparedPtb.eligible ? 'PTB 已准备' : 'PTB 暂不可用',
      tone: preparedPtb.eligible ? 'ready' : 'blocked',
    },
    {
      label: 'Wallet',
      value: signedPreparedPtb ? '已签名未提交' : '等待签名',
      tone: signedPreparedPtb ? 'ready' : 'waiting',
    },
    {
      label: 'Memory',
      value: storageResult ? 'Walrus 已归档' : '等待归档',
      tone: storageResult ? 'ready' : 'waiting',
    },
  ] as const;
  const steps = [
    {
      id: 'policy',
      icon: ShieldCheck,
      label: 'Policy object',
      value: shortValue(effectivePolicyObjectId, '需要 mint / 选择'),
      detail: fullValue(effectivePolicyObjectId),
      tone: proofTone(effectivePolicyObjectId),
    },
    {
      id: 'intent',
      icon: FileCheck2,
      label: 'Execution intent',
      value: executionIntent?.executionIntentId ?? auditPackage?.executionIntent?.executionIntentId ?? '等待锁定',
      detail: executionIntent
        ? `expires ${formatDateTime(executionIntent.intentExpiresAt)}`
        : '风险、Policy 和建议摘要尚未锁定',
      tone: proofTone(executionIntent?.executionIntentId ?? auditPackage?.executionIntent?.executionIntentId),
    },
    {
      id: 'ptb',
      icon: FileSignature,
      label: 'Prepared PTB digest',
      value: signedPreparedPtb?.bytesDigest ?? executionDigest ?? (preparedPtb.eligible ? '已构建，等待签名' : '不可构建'),
      detail: signedPreparedPtb
        ? '钱包已签名 prepared transaction bytes'
        : localizedPtbDetail(preparedPtb.reason ?? preparedPtb.safety.note),
      tone: proofTone(signedPreparedPtb?.bytesDigest ?? executionDigest, !preparedPtb.eligible),
    },
    {
      id: 'signature',
      icon: WalletCards,
      label: 'Wallet signature',
      value: signedPreparedPtb ? formatAddress(signedPreparedPtb.signer) : '需要钱包签名',
      detail: signedPreparedPtb
        ? `signed ${signedAt ? formatDateTime(signedAt) : 'for current intent'}`
        : 'Walrus 归档前必须先签名',
      tone: proofTone(signedPreparedPtb?.signature),
    },
    {
      id: 'walrus',
      icon: Archive,
      label: 'Walrus blob',
      value: storageResult?.id ?? '归档后生成',
      detail: storageResult?.url ?? storageResult?.registerDigest ?? 'signed prepared action 尚未归档',
      tone: proofTone(storageResult?.id),
    },
    {
      id: 'receipt',
      icon: CheckCircle2,
      label: 'StrategyReceipt',
      value: receiptProof?.receiptObjectId ? formatAddress(receiptProof.receiptObjectId) : receiptProof?.receiptDigest ?? '归档后可 mint',
      detail: receiptProof
        ? `tx ${receiptProof.receiptDigest}`
        : receiptPackageId
          ? `package ${formatAddress(receiptPackageId)}`
          : 'receipt package 未配置',
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

      <div className="proofActionBoundary">
        <span>Boundary</span>
        <strong>已签名也只是 prepare-only，不会自动提交</strong>
        <em>Policy object 定义授权边界；钱包签名 PTB bytes；Walrus 和 StrategyReceipt 让行动轨迹可回放。</em>
      </div>
    </section>
  );
}
