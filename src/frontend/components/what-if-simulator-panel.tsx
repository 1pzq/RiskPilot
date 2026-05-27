'use client';

import { Activity, ArrowRight, BadgeAlert, Gauge, RouteOff, ShieldAlert, Sparkles } from 'lucide-react';

import type { WhatIfScenarioId, WhatIfSimulation } from '@/lib/risk/what-if-scenarios';
import { WHAT_IF_SCENARIOS } from '@/lib/risk/what-if-scenarios';
import { formatRiskLevel, formatUsd } from '@/lib/utils/format';

type WhatIfSimulatorPanelProps = {
  simulation: WhatIfSimulation;
  selectedScenarioId: WhatIfScenarioId;
  onScenarioChange: (scenarioId: WhatIfScenarioId) => void;
};

function riskPillClass(level: string): string {
  if (level === 'critical') {
    return 'pillDanger';
  }

  if (level === 'high' || level === 'medium') {
    return 'pillWarn';
  }

  return 'pillSuccess';
}

function deltaLabel(value: number, suffix = ''): string {
  if (value > 0) {
    return `+${value}${suffix}`;
  }

  return `${value}${suffix}`;
}

function deltaClass(value: number): string {
  if (value > 0) {
    return 'pillDanger';
  }

  if (value < 0) {
    return 'pillSuccess';
  }

  return 'pillNeutral';
}

export function WhatIfSimulatorPanel({
  simulation,
  selectedScenarioId,
  onScenarioChange,
}: WhatIfSimulatorPanelProps) {
  const base = simulation.baseRiskReport;
  const simulated = simulation.simulatedRiskReport;
  const worstBaseLoss = Math.max(...base.scenarioResults.map((item) => item.estimatedLossUsd), 0);
  const worstSimulatedLoss = Math.max(...simulated.scenarioResults.map((item) => item.estimatedLossUsd), 0);

  return (
    <section className="panel whatIfPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">What-if simulator</p>
          <h2 className="panelTitle">Preview risk shocks</h2>
        </div>
        <span className="pill pillAccent">
          <Sparkles size={14} />
          preview
        </span>
      </div>

      <div className="whatIfPresetGroup" role="radiogroup" aria-label="What-if scenario">
        {WHAT_IF_SCENARIOS.map((scenario) => (
          <button
            className={`optionChip ${selectedScenarioId === scenario.id ? 'optionChipActive' : ''}`}
            key={scenario.id}
            type="button"
            role="radio"
            aria-checked={selectedScenarioId === scenario.id}
            onClick={() => onScenarioChange(scenario.id)}
          >
            <span>{scenario.shortLabel}</span>
            <small>{scenario.intensityLabel}</small>
          </button>
        ))}
      </div>

      <div className="whatIfScenarioBrief">
        <BadgeAlert size={16} />
        <p>{simulation.scenario.summary}</p>
      </div>

      <div className="whatIfProjectionGrid">
        <div className="metricCard">
          <div className="metricLabel">
            <Gauge size={14} />
            Base score
          </div>
          <div className="metricValue">{base.overallScore}</div>
          <span className={`pill ${riskPillClass(base.overallLevel)}`}>{formatRiskLevel(base.overallLevel)}</span>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <Activity size={14} />
            Simulated
          </div>
          <div className="metricValue">{simulated.overallScore}</div>
          <span className={`pill ${riskPillClass(simulated.overallLevel)}`}>{formatRiskLevel(simulated.overallLevel)}</span>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <ArrowRight size={14} />
            Score delta
          </div>
          <div className="metricValue">{deltaLabel(simulation.delta.scoreDelta)}</div>
          <span className={`pill ${deltaClass(simulation.delta.scoreDelta)}`}>risk move</span>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <ShieldAlert size={14} />
            Worst loss
          </div>
          <div className="metricValue">{formatUsd(worstSimulatedLoss)}</div>
          <span className="pill pillNeutral">base {formatUsd(worstBaseLoss)}</span>
        </div>
      </div>

      <div className="ticketRows whatIfImpactRows">
        <div className="ticketRow">
          <span>Portfolio value</span>
          <strong>
            {formatUsd(simulation.simulatedPortfolio.totalUsdValue)} ({formatUsd(simulation.delta.totalValueDeltaUsd)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>Active signals</span>
          <strong>
            {simulated.signals.length} ({deltaLabel(simulation.delta.activeSignalDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>Top new signal</span>
          <strong>{simulation.delta.topNewSignal ?? 'No new signal'}</strong>
        </div>
        <div className="ticketRow">
          <span>Preview status</span>
          <strong>Does not mutate wallet or archive by default</strong>
        </div>
      </div>

      {simulation.delta.policyNote || simulation.delta.marketNote ? (
        <div className="whatIfNotes">
          {simulation.delta.policyNote ? <span>{simulation.delta.policyNote}</span> : null}
          {simulation.delta.marketNote ? (
            <span>
              <RouteOff size={14} />
              {simulation.delta.marketNote}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
