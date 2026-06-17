'use client';

import {
  Activity,
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
import { zhStatus } from '@/frontend/utils/zh';

type IncidentRoomPanelProps = {
  incidentRoom: IncidentRoomDecision;
  refreshing?: boolean;
  onRefresh: () => void;
  compact?: boolean;
};

function modeLabel(incidentRoom: IncidentRoomDecision): string {
  if (incidentRoom.mode === 'openai' || incidentRoom.mode === 'deepseek') {
    return incidentRoom.model ? `AI ${incidentRoom.model}` : 'AI 房间';
  }

  return '规则兜底';
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

export function IncidentRoomPanel({ incidentRoom, refreshing = false, onRefresh, compact = false }: IncidentRoomPanelProps) {
  const lockedTaskCount = incidentRoom.tasks.filter((task) => task.locked).length;
  const blockedTaskCount = incidentRoom.tasks.filter((task) => task.status === 'blocked').length;
  const readyConsensusCount = incidentRoom.consensus.filter((item) => item.status === 'agree').length;
  const incidentDetails = (
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
                {zhStatus(task.status)}
              </span>
            </div>
            <p>{task.objective}</p>
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
            </article>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section className={`panel incidentRoomPanel ${compact ? 'incidentRoomPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Incident Room</p>
          <h2 className="panelTitle">Agentic 风险指挥台</h2>
        </div>
        <div className="panelHeaderMeta">
          <span className={`pill ${incidentRoom.mode === 'openai' || incidentRoom.mode === 'deepseek' ? 'pillSuccess' : 'pillWarn'}`}>
            {refreshing ? '刷新中' : modeLabel(incidentRoom)}
          </span>
          <span className={`pill ${severityClass(incidentRoom.severity)}`}>
            <Siren size={14} />
            {zhStatus(incidentRoom.severity)}
          </span>
        </div>
      </div>

      {incidentRoom.warning ? <div className="warningStrip inline">{incidentRoom.warning}</div> : null}

      <div className="incidentCommand">
        <div>
          <span>最终指令</span>
          <strong>{incidentRoom.finalCommand}</strong>
          <em>由确定性姿态锁定</em>
        </div>
        <button
          className="button buttonGhost"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <Activity size={16} />
          {refreshing ? '刷新房间' : '刷新房间'}
        </button>
      </div>

      {compact ? (
        <>
          <div className="auditCompactStats" aria-label="Incident Room 摘要">
            <div>
              <span>任务</span>
              <strong>{incidentRoom.tasks.length}</strong>
            </div>
            <div>
              <span>已锁定</span>
              <strong>{lockedTaskCount}/{incidentRoom.tasks.length}</strong>
            </div>
            <div>
              <span>共识</span>
              <strong>{readyConsensusCount}/{incidentRoom.consensus.length}</strong>
            </div>
            <div>
              <span>已阻断</span>
              <strong>{blockedTaskCount}</strong>
            </div>
          </div>
          <details className="auditDetailDrawer">
            <summary>任务、共识和交接</summary>
            {incidentDetails}
          </details>
        </>
      ) : (
        incidentDetails
      )}
    </section>
  );
}
