'use client';

import { ArrowRight, GitCompareArrows, RouteOff, ShieldCheck, Sparkles } from 'lucide-react';

import type { WhatIfSimulation } from '@/lib/risk/what-if-scenarios';
import type { PolicyCheckResult } from '@/lib/strategy/policy';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import { formatRiskLevel, formatUsd } from '@/lib/utils/format';

type WhatIfStrategyDiffProps = {
  simulation: WhatIfSimulation;
  baseRecommendation: StrategyRecommendation;
  simulatedRecommendation: StrategyRecommendation;
  simulatedPolicyCheck: PolicyCheckResult;
};

function deltaLabel(value: number, suffix = ''): string {
  if (value > 0) {
    return `+${value}${suffix}`;
  }

  return `${value}${suffix}`;
}

function policyLabel(policyCheck: PolicyCheckResult): string {
  return policyCheck.ok ? 'Preview policy open' : 'Preview policy blocked';
}

export function WhatIfStrategyDiff({
  simulation,
  baseRecommendation,
  simulatedRecommendation,
  simulatedPolicyCheck,
}: WhatIfStrategyDiffProps) {
  const baseRisk = simulation.baseRiskReport;
  const simulatedRisk = simulation.simulatedRiskReport;
  const costDelta = simulatedRecommendation.estimatedCostUsd - baseRecommendation.estimatedCostUsd;
  const sizeDelta = simulatedRecommendation.deepbookAction.amountUsd - baseRecommendation.deepbookAction.amountUsd;
  const marketChanged =
    baseRecommendation.deepbookAction.market !== simulatedRecommendation.deepbookAction.market ||
    simulation.marketOverride?.deepbookStatus === 'unavailable';

  return (
    <section className="panel whatIfStrategyDiffPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">What-if strategy diff</p>
          <h2 className="panelTitle">Base plan vs stressed plan</h2>
        </div>
        <span className="pill pillAccent">
          <Sparkles size={14} />
          preview only
        </span>
      </div>

      <div className="whatIfDiffHeader">
        <GitCompareArrows size={18} />
        <p>
          {simulation.scenario.label} reruns the risk and strategy engines in preview. It does not replace the real
          prepare/archive payload.
        </p>
      </div>

      <div className="whatIfDiffGrid">
        <div className="whatIfDiffColumn">
          <span>Base</span>
          <strong>{baseRecommendation.title}</strong>
          <small>
            Score {baseRisk.overallScore} · {formatRiskLevel(baseRisk.overallLevel)}
          </small>
        </div>
        <div className="whatIfDiffArrow" aria-hidden="true">
          <ArrowRight size={18} />
        </div>
        <div className="whatIfDiffColumn whatIfDiffColumnHot">
          <span>What-if</span>
          <strong>{simulatedRecommendation.title}</strong>
          <small>
            Score {simulatedRisk.overallScore} · {formatRiskLevel(simulatedRisk.overallLevel)}
          </small>
        </div>
      </div>

      <div className="ticketRows whatIfDiffRows">
        <div className="ticketRow">
          <span>Risk score</span>
          <strong>
            {baseRisk.overallScore} → {simulatedRisk.overallScore} ({deltaLabel(simulation.delta.scoreDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>Estimated cost</span>
          <strong>
            {formatUsd(baseRecommendation.estimatedCostUsd)} → {formatUsd(simulatedRecommendation.estimatedCostUsd)} (
            {formatUsd(costDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>Prepared size</span>
          <strong>
            {formatUsd(baseRecommendation.deepbookAction.amountUsd)} →{' '}
            {formatUsd(simulatedRecommendation.deepbookAction.amountUsd)} ({formatUsd(sizeDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>Market</span>
          <strong>
            {baseRecommendation.deepbookAction.market} → {simulatedRecommendation.deepbookAction.market}
          </strong>
        </div>
        <div className="ticketRow">
          <span>Policy posture</span>
          <strong>{policyLabel(simulatedPolicyCheck)}</strong>
        </div>
        <div className="ticketRow">
          <span>Live submit</span>
          <strong>Not authorized in What-if preview</strong>
        </div>
      </div>

      {marketChanged || simulation.delta.marketNote || !simulatedPolicyCheck.ok ? (
        <div className="whatIfDiffNotes">
          {marketChanged ? (
            <span>
              <RouteOff size={14} />
              Market route changed or degraded in the simulated path.
            </span>
          ) : null}
          {simulation.delta.marketNote ? <span>{simulation.delta.marketNote}</span> : null}
          {!simulatedPolicyCheck.ok ? (
            <span>
              <ShieldCheck size={14} />
              {simulatedPolicyCheck.errors[0]}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
