'use client';

import { CheckCircle2, CircleAlert, CircleDashed, FileCheck2, ShieldAlert } from 'lucide-react';

import type { EvidenceTimelineStep, EvidenceTimelineStepStatus } from '@/lib/agents/decision-council';

type EvidenceTimelineProps = {
  steps: EvidenceTimelineStep[];
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

export function EvidenceTimeline({ steps }: EvidenceTimelineProps) {
  const completeCount = steps.filter((step) => step.status === 'complete').length;

  return (
    <section className="panel evidenceTimelinePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Evidence timeline</p>
          <h2 className="panelTitle">Decision chain</h2>
        </div>
        <span className="pill pillAccent">
          <FileCheck2 size={14} />
          {completeCount}/{steps.length}
        </span>
      </div>

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
                <span>{step.status}</span>
              </div>
              <p>{step.summary}</p>
              <small>{step.evidenceRef}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
