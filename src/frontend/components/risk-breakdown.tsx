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
          <p className="eyebrow">信号</p>
          <h2 className="panelTitle">风险拆解</h2>
        </div>
        <span className={`pill ${hasSignals ? 'pillWarn' : 'pillSuccess'}`}>{hasSignals ? `${signals.length} 个活跃` : '清晰'}</span>
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
          <strong>没有活跃的已定价风险信号。</strong>
          <p>
            在出现已定价、可执行的路线之前，已连接钱包会保持仅审计模式。What-if 仍可预览冲击，但不会改变钱包状态。
          </p>
          <div className="riskEmptyGrid" aria-label="清晰风险护栏">
            <div>
              <span>钱包</span>
              <strong>真实扫描</strong>
            </div>
            <div>
              <span>Policy</span>
              <strong>仅审查</strong>
            </div>
            <div>
              <span>预览</span>
              <strong>不提交</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
