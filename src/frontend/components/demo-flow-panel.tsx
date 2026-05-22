'use client';

import { PixelIcon, type PixelIconName } from './pixel-icon';

const disconnectedFlowSteps = [
  {
    label: 'Choose a case',
    detail: 'Pick a judge scenario or connect a Sui mainnet wallet.',
    icon: 'case',
  },
  {
    label: 'Read the risk',
    detail: 'Review deterministic signals and scenario losses.',
    icon: 'read',
  },
  {
    label: 'Check policy',
    detail: 'Confirm budget, assets, market, and expiry limits.',
    icon: 'policy',
  },
  {
    label: 'Prepare audit',
    detail: 'Prepare the mainnet action and archive the decision package.',
    icon: 'archive',
  },
] as const;

const connectedFlowSteps = [
  {
    label: 'Use wallet',
    detail: 'Read connected Sui mainnet balances directly.',
    icon: 'case',
  },
  {
    label: 'Scan objects',
    detail: 'Attach owned mainnet objects and protocol hints.',
    icon: 'read',
  },
  {
    label: 'Check policy',
    detail: 'Confirm budget, assets, market, and expiry limits.',
    icon: 'policy',
  },
  {
    label: 'Prepare audit',
    detail: 'Prepare the mainnet action and archive the decision package.',
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
        {flowSteps.map(({ label, detail, icon }, index) => (
          <div className="flowStep" key={label}>
            <PixelIcon name={icon as PixelIconName} className="flowStepIcon" />
            <div>
              <strong>{index + 1}. {label}</strong>
              <span>{detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
