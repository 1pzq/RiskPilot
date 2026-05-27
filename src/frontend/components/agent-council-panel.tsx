'use client';

import { BrainCircuit, CheckCircle2, CircleAlert, CircleDashed, ShieldAlert } from 'lucide-react';

import type { AgentCouncilDecision, CouncilAgentStatus } from '@/lib/agents/decision-council';

type AgentCouncilPanelProps = {
  decision: AgentCouncilDecision;
  refreshing?: boolean;
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
    return 'policy blocked';
  }

  if (posture === 'live_ready') {
    return 'live ready';
  }

  if (posture === 'audit_only') {
    return 'audit only';
  }

  return 'prepare ready';
}

function modeLabel(decision: AgentCouncilDecision): string {
  if (decision.mode === 'openai') {
    return decision.model ? `AI ${decision.model}` : 'AI council';
  }

  return 'rules fallback';
}

export function AgentCouncilPanel({ decision, refreshing = false }: AgentCouncilPanelProps) {
  return (
    <section className="panel agentCouncilPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Agent council</p>
          <h2 className="panelTitle">Multi-agent risk committee</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${decision.mode === 'openai' ? 'pillSuccess' : 'pillWarn'}`}>
            {refreshing ? 'refreshing' : modeLabel(decision)}
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
                {agent.status}
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

            <div className="councilHandoff">{agent.handoff}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
