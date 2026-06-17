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
    return '需要钱包签名';
  }

  if (value === 'optional') {
    return '可选钱包签名';
  }

  return '无需钱包签名';
}

export function JudgeGuidePanel({ steps, activeSection, onOpenSection, compact = false }: JudgeGuidePanelProps) {
  return (
    <section className={`panel judgeGuidePanel ${compact ? 'judgeGuidePanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">评委路径</p>
          <h2 className="panelTitle">30 秒看懂 Agent Loop</h2>
        </div>
        <span className="pill pillAccent">按故事走</span>
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
                <small>动作：{step.input}</small>
                <small>结果：{step.output}</small>
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
