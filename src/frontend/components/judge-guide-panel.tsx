'use client';

import { ArrowRight, CheckCircle2, CircleDashed, WalletCards } from 'lucide-react';

import type { DemoSection } from './app-shell';

export type JudgeGuideStep = {
  id: DemoSection;
  label: string;
  input: string;
  output: string;
  evidence: string;
  walletSignature: 'none' | 'optional' | 'required';
  complete: boolean;
};

type JudgeGuidePanelProps = {
  steps: JudgeGuideStep[];
  activeSection: DemoSection;
  onOpenSection: (section: DemoSection) => void;
  compact?: boolean;
};

function walletLabel(value: JudgeGuideStep['walletSignature']) {
  if (value === 'required') {
    return 'Wallet signature required';
  }

  if (value === 'optional') {
    return 'Optional wallet signature';
  }

  return 'No wallet signature';
}

export function JudgeGuidePanel({ steps, activeSection, onOpenSection, compact = false }: JudgeGuidePanelProps) {
  return (
    <section className={`panel judgeGuidePanel ${compact ? 'judgeGuidePanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Judge path</p>
          <h2 className="panelTitle">30-second Agent Loop</h2>
        </div>
        <span className="pill pillAccent">Follow the story</span>
      </div>

      <div className="judgeGuideSteps" aria-label="Judge walkthrough">
        {steps.map((step, index) => {
          const active = step.id === activeSection;

          return (
            <button
              className={`judgeGuideStep ${active ? 'judgeGuideStepActive' : ''}`}
              type="button"
              key={step.id}
              onClick={() => onOpenSection(step.id)}
            >
              <span className="judgeGuideIcon" aria-hidden="true">
                {step.complete ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}
              </span>
              <span className="judgeGuideBody">
                <strong>{index + 1}. {step.label}</strong>
                <small>Action: {step.input}</small>
                <small>Result: {step.output}</small>
                <em>{step.evidence}</em>
                <span>
                  <WalletCards size={13} />
                  {walletLabel(step.walletSignature)}
                </span>
              </span>
              <ArrowRight size={14} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
