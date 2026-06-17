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
  return policyCheck.ok ? '预览 Policy 放行' : '预览 Policy 已阻断';
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
          <p className="eyebrow">What-if 策略差异</p>
          <h2 className="panelTitle">基准计划 vs 压力计划</h2>
        </div>
        <span className="pill pillAccent">
          <Sparkles size={14} />
          仅预览
        </span>
      </div>

      <div className="whatIfDiffHeader">
        <GitCompareArrows size={18} />
        <p>
          {simulation.scenario.label} 会在预览中重新运行风险和策略引擎，但不会替换真实的 Prepare/归档 payload。
        </p>
      </div>

      <div className="whatIfDiffGrid">
        <div className="whatIfDiffColumn">
          <span>基准</span>
          <strong>{baseRecommendation.title}</strong>
          <small>
            评分 {baseRisk.overallScore} · {formatRiskLevel(baseRisk.overallLevel)}
          </small>
        </div>
        <div className="whatIfDiffArrow" aria-hidden="true">
          <ArrowRight size={18} />
        </div>
        <div className="whatIfDiffColumn whatIfDiffColumnHot">
          <span>What-if</span>
          <strong>{simulatedRecommendation.title}</strong>
          <small>
            评分 {simulatedRisk.overallScore} · {formatRiskLevel(simulatedRisk.overallLevel)}
          </small>
        </div>
      </div>

      <div className="ticketRows whatIfDiffRows">
        <div className="ticketRow">
          <span>风险评分</span>
          <strong>
            {baseRisk.overallScore} → {simulatedRisk.overallScore} ({deltaLabel(simulation.delta.scoreDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>预估成本</span>
          <strong>
            {formatUsd(baseRecommendation.estimatedCostUsd)} → {formatUsd(simulatedRecommendation.estimatedCostUsd)} (
            {formatUsd(costDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>已准备规模</span>
          <strong>
            {formatUsd(baseRecommendation.deepbookAction.amountUsd)} →{' '}
            {formatUsd(simulatedRecommendation.deepbookAction.amountUsd)} ({formatUsd(sizeDelta)})
          </strong>
        </div>
        <div className="ticketRow">
          <span>市场</span>
          <strong>
            {baseRecommendation.deepbookAction.market} → {simulatedRecommendation.deepbookAction.market}
          </strong>
        </div>
        <div className="ticketRow">
          <span>Policy 姿态</span>
          <strong>{policyLabel(simulatedPolicyCheck)}</strong>
        </div>
        <div className="ticketRow">
          <span>Live 提交</span>
          <strong>What-if 预览中未授权</strong>
        </div>
      </div>

      {marketChanged || simulation.delta.marketNote || !simulatedPolicyCheck.ok ? (
        <div className="whatIfDiffNotes">
          {marketChanged ? (
            <span>
              <RouteOff size={14} />
              模拟路径中的市场路线已变化或降级。
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
