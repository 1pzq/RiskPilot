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
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Signals</p>
          <h2 className="panelTitle">Breakdown</h2>
        </div>
      </div>

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
    </section>
  );
}

