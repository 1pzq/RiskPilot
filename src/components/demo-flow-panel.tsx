'use client';

import { PixelIcon, type PixelIconName } from './pixel-icon';

const flowSteps = [
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

export function DemoFlowPanel() {
  return (
    <section className="panel demoFlowPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Judge flow</p>
          <h2 className="panelTitle">Prepare-only risk workflow</h2>
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
