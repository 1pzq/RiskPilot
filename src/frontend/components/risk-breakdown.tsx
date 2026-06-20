'use client';

import type { RiskSignal } from '@/lib/risk/types';
import { formatRiskLevel } from '@/lib/utils/format';

type RiskBreakdownProps = {
  signals: RiskSignal[];
};

const levelClass: Record<RiskSignal['level'], string> = {
  low: 'pillSuccess',
  medium: 'pillWarn',
  high: 'pillWarn',
  critical: 'pillDanger',
};

export function RiskBreakdown({ signals }: RiskBreakdownProps) {
  const hasSignals = signals.length > 0;

  return (
    <section className={hasSignals ? 'panel riskBreakdownPanel' : 'panel riskBreakdownPanel riskBreakdownPanelEmpty'}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Signals</p>
          <h2 className="panelTitle">Risk breakdown</h2>
        </div>
        <span className={`pill ${hasSignals ? 'pillWarn' : 'pillSuccess'}`}>{hasSignals ? `${signals.length} active` : 'Clear'}</span>
      </div>

      {hasSignals ? (
        <div className="stack">
          {signals.map((signal) => (
            <article className="signalRow" key={signal.id}>
              <div className="signalHead">
                <div>
                  <div className="signalTitle">{signal.title}</div>
                  <div className="signalSummary">{signal.summary}</div>
                </div>
                <span className={`pill ${levelClass[signal.level]}`}>{formatRiskLevel(signal.level)}</span>
              </div>
              <div className="signalEvidence">
                {signal.evidence.map((item) => (
                  <span key={item} className="evidenceChip">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="riskEmptyState">
          <strong>No active priced risk signals.</strong>
          <p>
            Until a priced executable route appears, the connected wallet remains audit-only. What-if can still preview shocks, but it does not change wallet state.
          </p>
          <div className="riskEmptyGrid" aria-label="Clear risk guardrails">
            <div>
              <span>Wallet</span>
              <strong>Live scan</strong>
            </div>
            <div>
              <span>Policy</span>
              <strong>Review only</strong>
            </div>
            <div>
              <span>Preview</span>
              <strong>No submit</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
