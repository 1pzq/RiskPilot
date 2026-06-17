'use client';

import { CheckCircle2, CircleAlert, CircleDashed, FileCheck2, ShieldAlert } from 'lucide-react';

import type { EvidenceTimelineStep, EvidenceTimelineStepStatus } from '@/lib/agents/decision-council';
import { zhStatus } from '@/frontend/utils/zh';

type EvidenceTimelineProps = {
  steps: EvidenceTimelineStep[];
  compact?: boolean;
};

function timelineStatusClass(status: EvidenceTimelineStepStatus): string {
  if (status === 'blocked') {
    return 'timelineStepBlocked';
  }

  if (status === 'warning') {
    return 'timelineStepWarning';
  }

  if (status === 'complete') {
    return 'timelineStepComplete';
  }

  return 'timelineStepPending';
}

function timelineIcon(status: EvidenceTimelineStepStatus) {
  if (status === 'blocked') {
    return <ShieldAlert size={15} />;
  }

  if (status === 'warning') {
    return <CircleAlert size={15} />;
  }

  if (status === 'complete') {
    return <CheckCircle2 size={15} />;
  }

  return <CircleDashed size={15} />;
}

export function EvidenceTimeline({ steps, compact = false }: EvidenceTimelineProps) {
  const completeCount = steps.filter((step) => step.status === 'complete').length;
  const warningCount = steps.filter((step) => step.status === 'warning').length;
  const blockedCount = steps.filter((step) => step.status === 'blocked').length;
  const timelineList = (
    <div className="timelineList">
      {steps.map((step, index) => (
        <article className={`timelineStep ${timelineStatusClass(step.status)}`} key={step.id}>
          <div className="timelineMarker">
            {timelineIcon(step.status)}
            <span>{String(index + 1).padStart(2, '0')}</span>
          </div>
          <div className="timelineStepBody">
            <div className="timelineStepHeader">
              <strong>{step.label}</strong>
              <span>{zhStatus(step.status)}</span>
            </div>
            <p>{step.summary}</p>
            <small>{step.evidenceRef}</small>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <section className={`panel evidenceTimelinePanel ${compact ? 'evidenceTimelinePanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">证据时间线</p>
          <h2 className="panelTitle">决策链</h2>
        </div>
        <span className="pill pillAccent">
          <FileCheck2 size={14} />
          {completeCount}/{steps.length}
        </span>
      </div>

      {compact ? (
        <>
          <div className="auditCompactStats" aria-label="证据时间线摘要">
            <div>
              <span>完成</span>
              <strong>{completeCount}/{steps.length}</strong>
            </div>
            <div>
              <span>警告</span>
              <strong>{warningCount}</strong>
            </div>
            <div>
              <span>已阻断</span>
              <strong>{blockedCount}</strong>
            </div>
          </div>
          <details className="auditDetailDrawer" open={blockedCount > 0}>
            <summary>决策链详情</summary>
            {timelineList}
          </details>
        </>
      ) : (
        timelineList
      )}
    </section>
  );
}
