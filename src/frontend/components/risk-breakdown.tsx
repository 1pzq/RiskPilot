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
          <h2 className="panelTitle">Breakdown</h2>
        </div>
        <span className={`pill ${hasSignals ? 'pillWarn' : 'pillSuccess'}`}>{hasSignals ? `${signals.length} active` : 'clear'}</span>
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
          <strong>No active priced risk signal.</strong>
          <p>
            Connected-wallet review stays in audit-only mode until a priced, actionable route appears. What-if can still preview shocks without mutating wallet state.
          </p>
          <div className="riskEmptyGrid" aria-label="Clear risk guardrails">
            <div>
              <span>Wallet</span>
              <strong>real scan</strong>
            </div>
            <div>
              <span>Policy</span>
              <strong>review only</strong>
            </div>
            <div>
              <span>Preview</span>
              <strong>no submit</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
