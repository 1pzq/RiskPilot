'use client';

import type { DemoScenario, DemoScenarioId } from '@/lib/risk/fixtures';
import { PixelIcon, type PixelIconName } from './pixel-icon';

type ScenarioSelectorProps = {
  scenarios: DemoScenario[];
  selectedScenarioId: DemoScenarioId;
  onChange: (scenarioId: DemoScenarioId) => void;
};

const scenarioIcons: Record<DemoScenarioId, PixelIconName> = {
  conservative_sui_holder: 'holder',
  leveraged_lending_user: 'lending',
  lp_impermanent_loss: 'lp',
  dao_stablecoin_treasury: 'treasury',
};

export function ScenarioSelector({
  scenarios,
  selectedScenarioId,
  onChange,
}: ScenarioSelectorProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Portfolio case</p>
          <h2 className="panelTitle">Select a risk story</h2>
        </div>
      </div>

      <div className="scenarioGrid">
        {scenarios.map((scenario) => {
          const icon = scenarioIcons[scenario.id];
          const selected = scenario.id === selectedScenarioId;

          return (
            <button
              className={`scenarioButton ${selected ? 'scenarioButtonActive' : ''}`}
              key={scenario.id}
              type="button"
              onClick={() => onChange(scenario.id)}
              aria-pressed={selected}
            >
              <PixelIcon name={icon} className="scenarioPixelIcon" />
              <span>
                <strong>{scenario.label}</strong>
                <small>{scenario.summary}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
