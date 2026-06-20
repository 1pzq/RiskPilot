'use client';

import { CheckCircle2, CircleDashed, Loader2, ShieldAlert, WalletCards } from 'lucide-react';

import type { AuditStorageResult } from '@/lib/walrus/types';
import type { ExecutionIntent } from '@/lib/security/execution-intent';
import { formatAddress } from '@/lib/utils/format';

export type ArchiveProgressPhase =
  | 'idle'
  | 'package'
  | 'live'
  | 'encoded'
  | 'registered'
  | 'uploaded'
  | 'certified'
  | 'failed';

type TimelineStatus = 'waiting' | 'active' | 'done' | 'blocked';

type ArchivePreflightPanelProps = {
  accountAddress?: string;
  selectedMode: string;
  liveSubmitSelected: boolean;
  policyOk: boolean;
  executionBusy: boolean;
  archiveProgressPhase: ArchiveProgressPhase;
  auditStorage: AuditStorageResult | null;
  executionIntent: ExecutionIntent | null;
  executionIntentStatus: 'locking' | 'locked' | 'error';
  compact?: boolean;
};

function statusForPhase(
  step: ArchiveProgressPhase,
  current: ArchiveProgressPhase,
  done: boolean,
  executionBusy: boolean,
): TimelineStatus {
  if (done) {
    return 'done';
  }

  if (current === 'failed') {
    return 'blocked';
  }

  if (current === step) {
    return 'active';
  }

  if (!executionBusy) {
    return 'waiting';
  }

  const order: ArchiveProgressPhase[] = ['package', 'live', 'encoded', 'registered', 'uploaded', 'certified'];
  const currentIndex = order.indexOf(current);
  const stepIndex = order.indexOf(step);

  return currentIndex > stepIndex ? 'done' : 'waiting';
}

function StatusIcon({ status }: { status: TimelineStatus }) {
  if (status === 'done') {
    return <CheckCircle2 size={15} />;
  }

  if (status === 'active') {
    return <Loader2 className="archiveStepSpinner" size={15} />;
  }

  if (status === 'blocked') {
    return <ShieldAlert size={15} />;
  }

  return <CircleDashed size={15} />;
}

export function ArchivePreflightPanel({
  accountAddress,
  selectedMode,
  liveSubmitSelected,
  policyOk,
  executionBusy,
  archiveProgressPhase,
  auditStorage,
  executionIntent,
  executionIntentStatus,
  compact = false,
}: ArchivePreflightPanelProps) {
  const walletReady = Boolean(accountAddress);
  const archiveDone = Boolean(auditStorage);
  const walletApprovalCount = liveSubmitSelected ? 3 : 2;
  const steps = [
    {
      id: 'policy',
        label: 'Policy Gate',
        detail: policyOk ? 'Boundaries ready.' : 'Fix Policy before archiving.',
      status: policyOk ? 'done' : 'blocked',
    },
    ...(liveSubmitSelected
      ? [
          {
            id: 'live',
            label: 'Wallet confirm 1/3',
            detail: 'Sign the Live DeepBook Spot transaction.',
            status: statusForPhase('live', archiveProgressPhase, archiveDone, executionBusy),
          },
        ]
      : []),
    {
      id: 'register',
      label: `Wallet confirm ${liveSubmitSelected ? '2/3' : '1/2'}`,
      detail: 'Register Walrus storage on Sui mainnet.',
      status: statusForPhase('registered', archiveProgressPhase, archiveDone, executionBusy),
    },
    {
      id: 'upload',
      label: 'Upload evidence',
      detail: 'Send the audit package to the Walrus relay.',
      status: statusForPhase('uploaded', archiveProgressPhase, archiveDone, executionBusy),
    },
    {
      id: 'certify',
      label: `Wallet confirm ${liveSubmitSelected ? '3/3' : '2/2'}`,
      detail: 'Certify the Walrus blob with the same wallet.',
      status: statusForPhase('certified', archiveProgressPhase, archiveDone, executionBusy),
    },
  ] satisfies {
    id: string;
    label: string;
    detail: string;
    status: TimelineStatus;
  }[];
  const actorGrid = (
    <div className="archiveActorGrid" aria-label="Archive actors">
      <div>
        <WalletCards size={15} />
        <span>Subject wallet</span>
        <strong>{accountAddress ? formatAddress(accountAddress) : 'Not connected'}</strong>
      </div>
      <div>
        <WalletCards size={15} />
        <span>Signer</span>
        <strong>{walletReady ? 'Connected wallet' : 'Blocked'}</strong>
      </div>
      <div>
        <WalletCards size={15} />
        <span>Archive payer</span>
        <strong>{auditStorage?.paymentLabel ?? (walletReady ? 'Connected wallet' : 'Blocked')}</strong>
      </div>
    </div>
  );
  const modeBox = (
    <div className="archivePreflightMode">
      <span>Current mode</span>
      <strong>{selectedMode}</strong>
      <small>
        {liveSubmitSelected
          ? 'Live Spot is signed first; Walrus register and certify start only after the transaction succeeds.'
          : 'No Live DeepBook transaction is submitted; Walrus register and certify still require wallet signatures.'}
      </small>
    </div>
  );
  const intentBox = (
    <div className={`executionIntentBox executionIntentBox-${executionIntentStatus}`}>
      <span>Execution intent</span>
      <strong>{executionIntent?.executionIntentId ?? (executionIntentStatus === 'locking' ? 'Locking digests...' : 'Not locked')}</strong>
      <small>
        {executionIntent
          ? `${executionIntent.intentSource} · policy ${executionIntent.policyDigest.slice(0, 12)} · recommendation ${executionIntent.recommendationDigest.slice(0, 12)}`
          : 'Prepare waits for portfolio, risk, recommendation, and policy digests before archiving.'}
      </small>
    </div>
  );
  const timeline = (
    <div className="archiveTimeline" aria-label="Walrus archive progress">
      {steps.map((step) => (
        <div className={`archiveTimelineStep archiveTimelineStep-${step.status}`} key={step.id}>
          <StatusIcon status={step.status} />
          <div>
            <strong>{step.label}</strong>
            <span>{step.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section className={`panel archivePreflightPanel ${compact ? 'archivePreflightPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Archive preflight</p>
          <h2 className="panelTitle">Archive evidence</h2>
        </div>
        <span className={`pill ${archiveDone ? 'pillSuccess' : walletReady ? 'pillWarn' : 'pillDanger'}`}>
          {archiveDone ? 'Certified' : walletReady ? 'Ready' : 'Connect wallet'}
        </span>
      </div>

      {compact ? (
        <>
          <div className="archivePreflightCompactGrid">
            <div>
              <span>Wallet</span>
              <strong>{accountAddress ? formatAddress(accountAddress) : 'Not connected'}</strong>
            </div>
            <div>
              <span>Confirmations</span>
              <strong>{walletApprovalCount} signatures</strong>
            </div>
            <div>
              <span>Intent</span>
              <strong>{executionIntentStatus === 'locked' ? 'Digests locked' : executionIntentStatus}</strong>
            </div>
          </div>
          <details className="archivePreflightDrawer" open={executionBusy || archiveProgressPhase === 'failed'}>
            <summary>Show wallet confirmation timeline</summary>
            {modeBox}
            {intentBox}
            {actorGrid}
            {timeline}
          </details>
        </>
      ) : (
        <>
          {actorGrid}
          {modeBox}
          {intentBox}
          {timeline}
        </>
      )}

    </section>
  );
}
