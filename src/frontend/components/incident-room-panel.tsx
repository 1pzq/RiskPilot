'use client';

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ShieldAlert,
  Siren,
} from 'lucide-react';

import type {
  IncidentConsensusStatus,
  IncidentRoomDecision,
  IncidentSeverity,
  IncidentTaskStatus,
} from '@/lib/agents/incident-room';

type IncidentRoomPanelProps = {
  incidentRoom: IncidentRoomDecision;
  refreshing?: boolean;
  onRefresh: () => void;
};

function modeLabel(incidentRoom: IncidentRoomDecision): string {
  if (incidentRoom.mode === 'openai') {
    return incidentRoom.model ? `AI ${incidentRoom.model}` : 'AI room';
  }

  return 'rules fallback';
}

function severityClass(severity: IncidentSeverity): string {
  if (severity === 'critical') {
    return 'pillDanger';
  }

  if (severity === 'high' || severity === 'medium') {
    return 'pillWarn';
  }

  return 'pillSuccess';
}

function taskStatusClass(status: IncidentTaskStatus): string {
  if (status === 'blocked') {
    return 'pillDanger';
  }

  if (status === 'watch' || status === 'waiting') {
    return 'pillWarn';
  }

  if (status === 'ready' || status === 'clear') {
    return 'pillSuccess';
  }

  return 'pillNeutral';
}

function consensusClass(status: IncidentConsensusStatus): string {
  if (status === 'blocked') {
    return 'incidentConsensusBlocked';
  }

  if (status === 'watch') {
    return 'incidentConsensusWatch';
  }

  return 'incidentConsensusAgree';
}

function statusIcon(status: IncidentTaskStatus | IncidentConsensusStatus) {
  if (status === 'blocked') {
    return <ShieldAlert size={14} />;
  }

  if (status === 'watch' || status === 'waiting') {
    return <CircleAlert size={14} />;
  }

  if (status === 'ready' || status === 'clear' || status === 'agree') {
    return <CheckCircle2 size={14} />;
  }

  return <CircleDashed size={14} />;
}

export function IncidentRoomPanel({ incidentRoom, refreshing = false, onRefresh }: IncidentRoomPanelProps) {
  return (
    <section className="panel incidentRoomPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Incident room</p>
          <h2 className="panelTitle">Agentic risk command</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${incidentRoom.mode === 'openai' ? 'pillSuccess' : 'pillWarn'}`}>
            {refreshing ? 'refreshing' : modeLabel(incidentRoom)}
          </span>
          <span className={`pill ${severityClass(incidentRoom.severity)}`}>
            <Siren size={14} />
            {incidentRoom.severity}
          </span>
        </div>
      </div>

      <div className="incidentBriefing">
        <BrainCircuit size={19} />
        <p>{incidentRoom.managerBriefing}</p>
      </div>

      {incidentRoom.warning ? <div className="warningStrip inline">{incidentRoom.warning}</div> : null}

      <div className="incidentCommand">
        <div>
          <span>Final command</span>
          <strong>{incidentRoom.finalCommand}</strong>
        </div>
        <button
          className="button buttonGhost"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <Activity size={16} />
          {refreshing ? 'Refreshing room' : 'Refresh room'}
        </button>
      </div>

      <div className="incidentLayout">
        <div className="incidentTaskBoard">
          {incidentRoom.tasks.map((task) => (
            <article className="incidentTask" key={task.id}>
              <div className="incidentTaskHeader">
                <div>
                  <span>{String(task.priority).padStart(2, '0')}</span>
                  <strong>{task.agentName}</strong>
                </div>
                <span className={`pill ${taskStatusClass(task.status)}`}>
                  {statusIcon(task.status)}
                  {task.status}
                </span>
              </div>
              <p>{task.objective}</p>
              <ul>
                {task.findings.slice(0, 3).map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
              <div className="incidentEvidenceRefs">
                {task.evidenceRefs.slice(0, 3).map((ref) => (
                  <span key={ref}>{ref}</span>
                ))}
              </div>
              <div className="incidentHandoffLine">{task.handoff}</div>
            </article>
          ))}
        </div>

        <div className="incidentSidecar">
          <div className="incidentConsensusGrid">
            {incidentRoom.consensus.map((item) => (
              <article className={`incidentConsensus ${consensusClass(item.status)}`} key={item.id}>
                <div>
                  <span>{statusIcon(item.status)}</span>
                  <strong>{item.label}</strong>
                </div>
                <p>{item.summary}</p>
                <small>{item.evidenceRef}</small>
              </article>
            ))}
          </div>

          <div className="incidentHandoffStream">
            {incidentRoom.handoffs.map((handoff) => (
              <article className="incidentHandoff" key={handoff.id}>
                <div className="incidentHandoffRoute">
                  <span>{handoff.from.replaceAll('_', ' ')}</span>
                  <ArrowRight size={14} />
                  <span>{handoff.to.replaceAll('_', ' ')}</span>
                </div>
                <p>{handoff.summary}</p>
                <small>{handoff.evidenceRef}</small>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
