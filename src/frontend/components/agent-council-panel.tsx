'use client';

import { BrainCircuit, CheckCircle2, CircleAlert, CircleDashed, ShieldAlert } from 'lucide-react';

import type { AgentCouncilDecision, CouncilAgentStatus } from '@/lib/agents/decision-council';
import { zhStatus } from '@/frontend/utils/zh';

type AgentCouncilPanelProps = {
  decision: AgentCouncilDecision;
  refreshing?: boolean;
  compact?: boolean;
};

function statusClass(status: CouncilAgentStatus): string {
  if (status === 'blocked') {
    return 'pillDanger';
  }

  if (status === 'watch') {
    return 'pillWarn';
  }

  if (status === 'ready') {
    return 'pillSuccess';
  }

  return 'pillNeutral';
}

function agentCardClass(status: CouncilAgentStatus): string {
  return `councilAgentStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function statusIcon(status: CouncilAgentStatus) {
  if (status === 'blocked') {
    return <ShieldAlert size={14} />;
  }

  if (status === 'watch') {
    return <CircleAlert size={14} />;
  }

  if (status === 'ready') {
    return <CheckCircle2 size={14} />;
  }

  return <CircleDashed size={14} />;
}

function postureLabel(posture: AgentCouncilDecision['posture']): string {
  if (posture === 'policy_blocked') {
    return 'Policy 阻断';
  }

  if (posture === 'live_ready') {
    return 'Live 就绪';
  }

  if (posture === 'audit_only') {
    return '仅审计';
  }

  return 'Prepare 就绪';
}

function modeLabel(decision: AgentCouncilDecision): string {
  if (decision.mode === 'openai' || decision.mode === 'deepseek') {
    return decision.model ? `AI ${decision.model}` : 'AI Council';
  }

  return '规则兜底';
}

function agentInputs(agentId: string): string[] {
  if (agentId === 'risk_analyst') {
    return ['portfolioSnapshot', 'riskReportBefore'];
  }

  if (agentId === 'strategy_agent') {
    return ['riskReportBefore', 'recommendation'];
  }

  if (agentId === 'policy_guard') {
    return ['policy', 'policyCheck'];
  }

  if (agentId === 'audit_agent') {
    return ['monitorRules', 'deepbookMarketEvidence', 'storage'];
  }

  return ['agent 结论', 'policyCheck', 'liveGate'];
}

function agentOutputs(agentId: string): string[] {
  if (agentId === 'risk_analyst') {
    return ['风险摘要', '风险交接'];
  }

  if (agentId === 'strategy_agent') {
    return ['受限动作摘要', '策略交接'];
  }

  if (agentId === 'policy_guard') {
    return ['Policy 结论', '阻断/通过证据'];
  }

  if (agentId === 'audit_agent') {
    return ['归档就绪度', 'receipt 交接'];
  }

  return ['锁定姿态', 'Manager 摘要'];
}

export function AgentCouncilPanel({ decision, refreshing = false, compact = false }: AgentCouncilPanelProps) {
  const readyCount = decision.agents.filter((agent) => agent.status === 'ready').length;
  const watchCount = decision.agents.filter((agent) => agent.status === 'watch').length;
  const blockedCount = decision.agents.filter((agent) => agent.status === 'blocked').length;
  const councilDetails = (
    <>
      <div className="agentTransparencyBar" aria-label="Agent 权限模式">
        <div>
          <span>Agent 模式</span>
          <strong>{decision.mode}</strong>
        </div>
        <div>
          <span>AI 可编辑</span>
          <strong>仅摘要和措辞</strong>
        </div>
        <div>
          <span>规则锁定</span>
          <strong>姿态、Policy Gate、路线边界</strong>
        </div>
      </div>

      <div className="councilGrid">
        {decision.agents.map((agent) => (
          <article className={`councilAgent ${agentCardClass(agent.status)}`} key={agent.id}>
            <div className="councilAgentHeader">
              <div>
                <span>{agent.role}</span>
                <strong>{agent.name}</strong>
              </div>
              <span className={`pill ${statusClass(agent.status)}`}>
                {statusIcon(agent.status)}
                {zhStatus(agent.status)}
              </span>
            </div>

            <p>{agent.summary}</p>

            <div className="confidenceTrack" aria-label={`${agent.name} 置信度 ${agent.confidence}%`}>
              <span style={{ width: `${agent.confidence}%` }} />
            </div>

            <div className="councilEvidence">
              {agent.evidence.slice(0, 2).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="agentIoGrid" aria-label={`${agent.name} 输入和输出`}>
              <div>
                <span>读取输入</span>
                {agentInputs(agent.id).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
              <div>
                <span>产生输出</span>
                {agentOutputs(agent.id).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
            </div>

            <div className="agentAuthorityTags">
              <span>AI 可编辑：摘要措辞</span>
              <span>已锁定：状态、置信度、交接引用</span>
            </div>

            <div className="councilHandoff">{agent.handoff}</div>
          </article>
        ))}
      </div>
    </>
  );

  return (
    <section className={`panel agentCouncilPanel ${compact ? 'agentCouncilPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Agent Council</p>
          <h2 className="panelTitle">多 Agent 风险委员会</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${decision.mode === 'openai' || decision.mode === 'deepseek' ? 'pillSuccess' : 'pillWarn'}`}>
            {refreshing ? '刷新中' : modeLabel(decision)}
          </span>
          <span className={`pill ${decision.posture === 'policy_blocked' ? 'pillDanger' : 'pillAccent'}`}>
            {postureLabel(decision.posture)}
          </span>
        </div>
      </div>

      <div className="councilSummary">
        <BrainCircuit size={18} />
        <p>{decision.managerSummary}</p>
      </div>

      {decision.warning ? <div className="warningStrip inline">{decision.warning}</div> : null}

      {compact ? (
        <>
          <div className="auditCompactStats" aria-label="Agent Council 摘要">
            <div>
              <span>Agent</span>
              <strong>{decision.agents.length}</strong>
            </div>
            <div>
              <span>就绪 / 观察</span>
              <strong>{readyCount} / {watchCount}</strong>
            </div>
            <div>
              <span>已阻断</span>
              <strong>{blockedCount}</strong>
            </div>
          </div>
          <details className="auditDetailDrawer">
            <summary>Agent 卡片、输入输出和交接</summary>
            {councilDetails}
          </details>
        </>
      ) : (
        councilDetails
      )}
    </section>
  );
}
