'use client';

import { BellRing, Eye, FileCheck2, PauseCircle, PlayCircle, ShieldAlert } from 'lucide-react';

import type { MonitorRule, MonitorRuleSeverity } from '@/lib/strategy/monitor';
import { zhStatus } from '@/frontend/utils/zh';

type MonitorPanelProps = {
  rules: MonitorRule[];
  onToggleRule: (ruleId: string, enabled: boolean) => void;
  compact?: boolean;
};

function severityClass(severity: MonitorRuleSeverity): string {
  if (severity === 'critical') {
    return 'pillDanger';
  }

  if (severity === 'high') {
    return 'pillWarn';
  }

  if (severity === 'medium') {
    return 'pillAccent';
  }

  return 'pillNeutral';
}

function actionIcon(kind: MonitorRule['recommendedAction']['kind']) {
  if (kind === 'audit') {
    return <FileCheck2 size={14} />;
  }

  if (kind === 'prepare') {
    return <ShieldAlert size={14} />;
  }

  return <Eye size={14} />;
}

export function MonitorPanel({ rules, onToggleRule, compact = false }: MonitorPanelProps) {
  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const criticalCount = rules.filter((rule) => rule.severity === 'critical').length;
  const highCount = rules.filter((rule) => rule.severity === 'high').length;
  const ruleList = (
    <div className="monitorRuleList">
      {rules.map((rule) => (
        <article className={`monitorRule ${rule.enabled ? '' : 'monitorRuleDisabled'}`} key={rule.id}>
          <div className="monitorRuleHeader">
            <div className="monitorRuleTitle">
              <BellRing size={15} />
              <strong>{rule.label}</strong>
            </div>
            <button
              aria-pressed={rule.enabled}
              className={`monitorToggle ${rule.enabled ? 'monitorToggleOn' : ''}`}
              type="button"
              onClick={() => onToggleRule(rule.id, !rule.enabled)}
            >
              {rule.enabled ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              <span>{rule.enabled ? '已启用' : '已停用'}</span>
            </button>
          </div>

          <div className="monitorMetaLine">
            <span className={`pill ${severityClass(rule.severity)}`}>{zhStatus(rule.severity)}</span>
            <span>{rule.sourceRiskSignalId ?? '审计上下文'}</span>
          </div>

          <div className="monitorRuleBody">
            <div>
              <span>条件</span>
              <p>{rule.condition}</p>
            </div>
            <div>
              <span>触发</span>
              <p>{rule.trigger}</p>
            </div>
          </div>

          <div className="monitorAction">
            {actionIcon(rule.recommendedAction.kind)}
            <div>
              <strong>{rule.recommendedAction.label}</strong>
              <p>{rule.recommendedAction.description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <section className={`panel monitorPanel ${compact ? 'monitorPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">风险观察</p>
          <h2 className="panelTitle">Monitor 模式</h2>
        </div>
        <span className="pill pillAccent">{enabledCount}/{rules.length} 已启用</span>
      </div>

      {compact ? (
        <>
          <div className="auditCompactStats" aria-label="Monitor 摘要">
            <div>
              <span>规则</span>
              <strong>{rules.length}</strong>
            </div>
            <div>
              <span>已启用</span>
              <strong>{enabledCount}</strong>
            </div>
            <div>
              <span>高 / 严重</span>
              <strong>{highCount} / {criticalCount}</strong>
            </div>
          </div>
          <details className="auditDetailDrawer">
            <summary>Monitor 规则列表</summary>
            {ruleList}
          </details>
        </>
      ) : (
        ruleList
      )}
    </section>
  );
}
