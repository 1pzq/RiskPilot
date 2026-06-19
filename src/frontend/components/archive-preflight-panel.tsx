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
        detail: policyOk ? '边界已就绪。' : '归档前先修正 Policy。',
      status: policyOk ? 'done' : 'blocked',
    },
    ...(liveSubmitSelected
      ? [
          {
            id: 'live',
            label: '钱包确认 1/3',
            detail: '签名 Live DeepBook Spot 交易。',
            status: statusForPhase('live', archiveProgressPhase, archiveDone, executionBusy),
          },
        ]
      : []),
    {
      id: 'register',
      label: `钱包确认 ${liveSubmitSelected ? '2/3' : '1/2'}`,
      detail: '在 Sui mainnet 注册 Walrus 存储。',
      status: statusForPhase('registered', archiveProgressPhase, archiveDone, executionBusy),
    },
    {
      id: 'upload',
      label: '上传证据',
      detail: '把审计包发送到 Walrus relay。',
      status: statusForPhase('uploaded', archiveProgressPhase, archiveDone, executionBusy),
    },
    {
      id: 'certify',
      label: `钱包确认 ${liveSubmitSelected ? '3/3' : '2/2'}`,
      detail: '用同一个钱包认证 Walrus blob。',
      status: statusForPhase('certified', archiveProgressPhase, archiveDone, executionBusy),
    },
  ] satisfies {
    id: string;
    label: string;
    detail: string;
    status: TimelineStatus;
  }[];
  const actorGrid = (
    <div className="archiveActorGrid" aria-label="归档参与者">
      <div>
        <WalletCards size={15} />
        <span>主体钱包</span>
        <strong>{accountAddress ? formatAddress(accountAddress) : '未连接'}</strong>
      </div>
      <div>
        <WalletCards size={15} />
        <span>签名者</span>
        <strong>{walletReady ? '已连接钱包' : '已阻断'}</strong>
      </div>
      <div>
        <WalletCards size={15} />
        <span>归档支付方</span>
        <strong>{auditStorage?.paymentLabel ?? (walletReady ? '已连接钱包' : '已阻断')}</strong>
      </div>
    </div>
  );
  const modeBox = (
    <div className="archivePreflightMode">
      <span>当前模式</span>
      <strong>{selectedMode}</strong>
      <small>
        {liveSubmitSelected
          ? 'Live Spot 先签名；只有实时交易成功后，Walrus 注册和认证才会开始。'
          : '不会提交 Live DeepBook 交易；Walrus 注册和认证仍需要钱包签名。'}
      </small>
    </div>
  );
  const intentBox = (
    <div className={`executionIntentBox executionIntentBox-${executionIntentStatus}`}>
      <span>执行意图</span>
      <strong>{executionIntent?.executionIntentId ?? (executionIntentStatus === 'locking' ? '正在锁定 digest...' : '未锁定')}</strong>
      <small>
        {executionIntent
          ? `${executionIntent.intentSource} · policy ${executionIntent.policyDigest.slice(0, 12)} · recommendation ${executionIntent.recommendationDigest.slice(0, 12)}`
          : 'Prepare 会在归档前等待 portfolio、risk、recommendation 和 policy digests。'}
      </small>
    </div>
  );
  const timeline = (
    <div className="archiveTimeline" aria-label="Walrus 归档进度">
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
          <p className="eyebrow">归档预检</p>
          <h2 className="panelTitle">Archive evidence</h2>
        </div>
        <span className={`pill ${archiveDone ? 'pillSuccess' : walletReady ? 'pillWarn' : 'pillDanger'}`}>
          {archiveDone ? '已认证' : walletReady ? '就绪' : '连接钱包'}
        </span>
      </div>

      {compact ? (
        <>
          <div className="archivePreflightCompactGrid">
            <div>
              <span>钱包</span>
              <strong>{accountAddress ? formatAddress(accountAddress) : '未连接'}</strong>
            </div>
            <div>
              <span>确认次数</span>
              <strong>{walletApprovalCount} signatures</strong>
            </div>
            <div>
              <span>意图</span>
              <strong>{executionIntentStatus === 'locked' ? '已锁定 digest' : executionIntentStatus}</strong>
            </div>
          </div>
          <details className="archivePreflightDrawer" open={executionBusy || archiveProgressPhase === 'failed'}>
            <summary>显示钱包确认时间线</summary>
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
