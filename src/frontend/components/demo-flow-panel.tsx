'use client';

import { PixelIcon, type PixelIconName } from './pixel-icon';

const disconnectedFlowSteps = [
  {
    label: 'Context',
    detail: 'Connect a Sui mainnet wallet and start from real data.',
    badge: 'Input',
    icon: 'case',
  },
  {
    label: 'Risk map',
    detail: 'Score exposure, signals, and loss scenarios with deterministic rules.',
    badge: 'Rules',
    icon: 'risk',
  },
  {
    label: 'What-if',
    detail: 'Preview shocks without changing the real workflow.',
    badge: 'Preview',
    icon: 'read',
  },
  {
    label: 'Policy route',
    detail: 'Lock action boundaries, budget, market, and manual confirmation.',
    badge: 'Locked',
    icon: 'policy',
  },
  {
    label: 'Agent room',
    detail: 'Show bounded Agent tasks, handoffs, and final command.',
    badge: 'AI wording',
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
    badge: 'Scan',
    icon: 'read',
  },
  {
    label: 'Risk map',
    detail: 'Prevent unpriced assets from creating fake DeepBook trades.',
    badge: 'Rules',
    icon: 'risk',
  },
  {
    label: 'What-if',
    detail: 'Preview shocks while keeping the real wallet state intact.',
    badge: 'Preview',
    icon: 'strategy',
  },
  {
    label: 'Policy route',
    detail: 'Check budget, assets, market, expiry, and approval lock.',
    badge: 'Locked',
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
            {walletConnected ? 'Real wallet risk workflow' : 'Prepare-only risk workflow'}
          </h2>
        </div>
        <span className="pill pillAccent">No live submit by default</span>
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
