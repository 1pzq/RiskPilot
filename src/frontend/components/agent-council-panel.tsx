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
    return 'Policy blocked';
  }

  if (posture === 'live_ready') {
    return 'Live ready';
  }

  if (posture === 'audit_only') {
    return 'Audit only';
  }

  return 'Prepare ready';
}

function modeLabel(decision: AgentCouncilDecision): string {
  if (decision.mode === 'openai' || decision.mode === 'deepseek') {
    return decision.model ? `AI ${decision.model}` : 'AI Council';
  }

  return 'Rules fallback';
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

  return ['agent verdicts', 'policyCheck', 'liveGate'];
}

function agentOutputs(agentId: string): string[] {
  if (agentId === 'risk_analyst') {
    return ['risk summary', 'risk handoff'];
  }

  if (agentId === 'strategy_agent') {
    return ['bounded action summary', 'strategy handoff'];
  }

  if (agentId === 'policy_guard') {
    return ['Policy verdict', 'block/pass evidence'];
  }

  if (agentId === 'audit_agent') {
    return ['archive readiness', 'receipt handoff'];
  }

  return ['locked posture', 'Manager summary'];
}

export function AgentCouncilPanel({ decision, refreshing = false, compact = false }: AgentCouncilPanelProps) {
  const readyCount = decision.agents.filter((agent) => agent.status === 'ready').length;
  const watchCount = decision.agents.filter((agent) => agent.status === 'watch').length;
  const blockedCount = decision.agents.filter((agent) => agent.status === 'blocked').length;
  const councilDetails = (
    <>
      <div className="agentTransparencyBar" aria-label="Agent authority mode">
        <div>
          <span>Agent mode</span>
          <strong>{decision.mode}</strong>
        </div>
        <div>
          <span>AI editable</span>
          <strong>Summary and wording only</strong>
        </div>
        <div>
          <span>Rules locked</span>
          <strong>Posture, Policy Gate, route boundaries</strong>
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

            <div className="confidenceTrack" aria-label={`${agent.name} confidence ${agent.confidence}%`}>
              <span style={{ width: `${agent.confidence}%` }} />
            </div>

            <div className="councilEvidence">
              {agent.evidence.slice(0, 2).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="agentIoGrid" aria-label={`${agent.name} inputs and outputs`}>
              <div>
                <span>Reads</span>
                {agentInputs(agent.id).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
              <div>
                <span>Produces</span>
                {agentOutputs(agent.id).map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </div>
            </div>

            <div className="agentAuthorityTags">
              <span>AI editable: summary wording</span>
              <span>Locked: status, confidence, handoff refs</span>
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
          <h2 className="panelTitle">Multi-Agent risk council</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${decision.mode === 'openai' || decision.mode === 'deepseek' ? 'pillSuccess' : 'pillWarn'}`}>
            {refreshing ? 'Refreshing' : modeLabel(decision)}
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
          <div className="auditCompactStats" aria-label="Agent Council summary">
            <div>
              <span>Agent</span>
              <strong>{decision.agents.length}</strong>
            </div>
            <div>
              <span>Ready / watch</span>
              <strong>{readyCount} / {watchCount}</strong>
            </div>
            <div>
              <span>Blocked</span>
              <strong>{blockedCount}</strong>
            </div>
          </div>
          <details className="auditDetailDrawer">
            <summary>Agent cards, inputs, outputs, and handoffs</summary>
            {councilDetails}
          </details>
        </>
      ) : (
        councilDetails
      )}
    </section>
  );
}
