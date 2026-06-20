'use client';

import { CheckCircle2, CircleDashed, Loader2, ShieldAlert, WalletCards } from 'lucide-react';

export type AgentToolStatus = 'complete' | 'active' | 'pending' | 'blocked' | 'warning';

export type AgentToolStep = {
  id: string;
  label: string;
  status: AgentToolStatus;
  input: string;
  output: string;
  evidenceRef: string;
  walletSignature: 'none' | 'optional' | 'required';
};

type AgentToolTimelineProps = {
  steps: AgentToolStep[];
  compact?: boolean;
};

function StatusIcon({ status }: { status: AgentToolStatus }) {
  if (status === 'complete') {
    return <CheckCircle2 size={15} />;
  }

  if (status === 'active') {
    return <Loader2 className="archiveStepSpinner" size={15} />;
  }

  if (status === 'blocked' || status === 'warning') {
    return <ShieldAlert size={15} />;
  }

  return <CircleDashed size={15} />;
}

function walletLabel(value: AgentToolStep['walletSignature']) {
  if (value === 'required') {
    return 'Wallet signature';
  }

  if (value === 'optional') {
    return 'Optional signature';
  }

  return 'No signature';
}

export function AgentToolTimeline({ steps, compact = false }: AgentToolTimelineProps) {
  const completed = steps.filter((step) => step.status === 'complete').length;

  return (
    <section className={`panel agentToolTimelinePanel ${compact ? 'agentToolTimelinePanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Agent tool use</p>
          <h2 className="panelTitle">Observe, verify, act timeline</h2>
        </div>
        <span className="pill pillAccent">{completed}/{steps.length} tools</span>
      </div>

      <div className="agentToolTimeline" aria-label="Agent tool timeline">
        {steps.map((step, index) => (
          <article className={`agentToolStep agentToolStep-${step.status}`} key={step.id}>
            <div className="agentToolStepIndex">
              <StatusIcon status={step.status} />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="agentToolStepBody">
              <div className="agentToolStepHeader">
                <strong>{step.label}</strong>
                <em>{step.evidenceRef}</em>
              </div>
              <div className="agentToolIO">
                <span>Input: {step.input}</span>
                <span>Output: {step.output}</span>
              </div>
              <div className="agentToolWallet">
                <WalletCards size={13} />
                <span>{walletLabel(step.walletSignature)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
