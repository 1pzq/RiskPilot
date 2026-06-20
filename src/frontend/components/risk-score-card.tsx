'use client';

import type { CSSProperties } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

import type { RiskReport } from '@/lib/risk/types';
import { formatPercent, formatRiskLevel, formatUsd } from '@/lib/utils/format';

type RiskScoreCardProps = {
  report: RiskReport;
};

export function RiskScoreCard({ report }: RiskScoreCardProps) {
  const scoreStyle: CSSProperties = {
    background: `conic-gradient(var(--accent) 0 ${report.overallScore}%, rgba(255, 255, 255, 0.08) ${report.overallScore}% 100%)`,
  };

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Risk</p>
          <h2 className="panelTitle">Deterministic score</h2>
        </div>
        <span className={`pill pill${report.overallLevel === 'critical' ? 'Danger' : report.overallLevel === 'high' ? 'Warn' : 'Success'}`}>
          {formatRiskLevel(report.overallLevel)}
        </span>
      </div>

      <div className="scoreGrid">
        <div className="scoreDial" style={scoreStyle}>
          <div className="scoreDialInner">
            <div className="scoreValue">{report.overallScore}</div>
            <div className="scoreLabel">/ 100</div>
          </div>
        </div>

        <div className="scoreCopy">
          <div className="scoreSummary">
            <ShieldCheck size={15} />
            <span>{report.signals.length} active signals</span>
          </div>
          <div className="scoreSummary">
            <AlertTriangle size={15} />
            <span>
              Worst-case loss {formatUsd(Math.max(...report.scenarioResults.map((item) => item.estimatedLossUsd)))}
            </span>
          </div>

          <div className="scenarioList">
            {report.scenarioResults.map((scenario) => (
              <div className="scenarioRow" key={scenario.scenario}>
                <span>{scenario.scenario}</span>
                <span>
                  {formatUsd(scenario.estimatedLossUsd)} · {formatPercent(scenario.estimatedLossPct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
