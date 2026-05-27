'use client';

import { PixelIcon, type PixelIconName } from './pixel-icon';

const disconnectedFlowSteps = [
  {
    label: 'Context',
    detail: 'Start from a judge scenario or connect a Sui mainnet wallet.',
    badge: 'input',
    icon: 'case',
  },
  {
    label: 'Risk map',
    detail: 'Score deterministic exposure, signals, and loss scenarios.',
    badge: 'rules',
    icon: 'risk',
  },
  {
    label: 'What-if',
    detail: 'Preview shocks without mutating the real workflow.',
    badge: 'preview',
    icon: 'read',
  },
  {
    label: 'Policy route',
    detail: 'Gate action bounds, budget, market, and manual approval.',
    badge: 'locked',
    icon: 'policy',
  },
  {
    label: 'Agent room',
    detail: 'Show bounded agent tasks, handoffs, and final command.',
    badge: 'AI text',
    icon: 'audit',
  },
  {
    label: 'Audit trail',
    detail: 'Prepare the action and archive the evidence package.',
    badge: 'Walrus',
    icon: 'archive',
  },
] as const;

const connectedFlowSteps = [
  {
    label: 'Wallet',
    detail: 'Read connected Sui mainnet balances directly.',
    badge: 'mainnet',
    icon: 'case',
  },
  {
    label: 'Objects',
    detail: 'Attach owned mainnet objects and protocol hints.',
    badge: 'scan',
    icon: 'read',
  },
  {
    label: 'Risk map',
    detail: 'Keep unpriced assets from creating fake DeepBook trades.',
    badge: 'rules',
    icon: 'risk',
  },
  {
    label: 'What-if',
    detail: 'Preview shocks while preserving real wallet state.',
    badge: 'preview',
    icon: 'strategy',
  },
  {
    label: 'Policy route',
    detail: 'Confirm budget, asset, market, expiry, and approval locks.',
    badge: 'locked',
    icon: 'policy',
  },
  {
    label: 'Audit trail',
    detail: 'Prepare the mainnet action and archive the decision package.',
    badge: 'Walrus',
    icon: 'archive',
  },
] as const;

type DemoFlowPanelProps = {
  walletConnected: boolean;
};

export function DemoFlowPanel({ walletConnected }: DemoFlowPanelProps) {
  const flowSteps = walletConnected ? connectedFlowSteps : disconnectedFlowSteps;

  return (
    <section className="panel demoFlowPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">{walletConnected ? 'Wallet flow' : 'Judge flow'}</p>
          <h2 className="panelTitle">
            {walletConnected ? 'Real-wallet risk workflow' : 'Prepare-only risk workflow'}
          </h2>
        </div>
        <span className="pill pillAccent">no live submit</span>
      </div>

      <div className="flowGrid">
        {flowSteps.map(({ label, detail, badge, icon }, index) => (
          <div className="flowStep" key={label}>
            <PixelIcon name={icon as PixelIconName} className="flowStepIcon" />
            <div>
              <em>{badge}</em>
              <strong>{index + 1}. {label}</strong>
              <span>{detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
