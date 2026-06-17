import type { RiskReport } from '@/lib/risk/types';
import type { AiProviderMode } from '@/lib/ai/provider';
import type { DeepBookLiveGate } from '@/lib/sui/deepbook-live';
import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { MonitorRule } from '@/lib/strategy/monitor';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import {
  buildAgentCouncilDecision,
  type AgentCouncilDecision,
  type BuildAgentCouncilInput,
  type CouncilAgentStatus,
  type EvidenceTimelineStep,
} from './decision-council';

export type IncidentRoomMode = 'openai' | 'deepseek' | 'deterministic_fallback';

export type IncidentAgentId =
  | 'manager'
  | 'risk_analyst'
  | 'liquidity_scout'
  | 'policy_guard'
  | 'execution_planner'
  | 'audit_agent';

export type IncidentTaskStatus = CouncilAgentStatus | 'waiting';
export type IncidentConsensusStatus = 'agree' | 'watch' | 'blocked';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentTask = {
  id: IncidentAgentId;
  agentName: string;
  objective: string;
  status: IncidentTaskStatus;
  priority: number;
  findings: string[];
  evidenceRefs: string[];
  handoff: string;
  locked: boolean;
};

export type IncidentHandoff = {
  id: string;
  from: IncidentAgentId;
  to: IncidentAgentId;
  status: IncidentConsensusStatus;
  summary: string;
  evidenceRef: string;
};

export type IncidentConsensusItem = {
  id: string;
  label: string;
  status: IncidentConsensusStatus;
  summary: string;
  evidenceRef: string;
};

export type IncidentRoomDecision = {
  id: string;
  mode: IncidentRoomMode;
  model?: string;
  warning?: string;
  sourceCouncilId: string;
  posture: AgentCouncilDecision['posture'];
  severity: IncidentSeverity;
  managerBriefing: string;
  finalCommand: string;
  tasks: IncidentTask[];
  handoffs: IncidentHandoff[];
  consensus: IncidentConsensusItem[];
  evidenceTimeline: EvidenceTimelineStep[];
};

type IncidentDeepBookMarketEvidence = BuildAgentCouncilInput['deepbookMarketEvidence'] & {
  midPrice?: number;
  error?: string;
};

export type BuildIncidentRoomInput = {
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  monitorRules: MonitorRule[];
  deepbookMarketEvidence: IncidentDeepBookMarketEvidence;
  explanationMode: AiProviderMode;
  walletConnected: boolean;
  auditArchived: boolean;
  receiptEnabled: boolean;
  liveGate?: DeepBookLiveGate;
  agentCouncil?: AgentCouncilDecision;
  policyObject?: {
    objectId?: string;
    status?: string;
    source?: string;
  } | null;
};

function activeMonitorCount(rules: MonitorRule[]): number {
  return rules.filter((rule) => rule.enabled).length;
}

function severityFromInput(input: BuildIncidentRoomInput, posture: AgentCouncilDecision['posture']): IncidentSeverity {
  if (!input.policyCheck.ok) {
    return 'critical';
  }

  if (input.riskReport.overallScore >= 70) {
    return 'critical';
  }

  if (input.riskReport.overallScore >= 50 || posture === 'live_ready') {
    return 'high';
  }

  if (input.riskReport.overallScore >= 25 || input.recommendation.type === 'wallet_review') {
    return 'medium';
  }

  return 'low';
}

function postureLabel(posture: AgentCouncilDecision['posture']): string {
  if (posture === 'policy_blocked') {
    return 'Policy 已阻断';
  }

  if (posture === 'live_ready') {
    return 'Live 就绪';
  }

  if (posture === 'audit_only') {
    return '仅审计';
  }

  return 'Prepare 就绪';
}

function finalCommandForPosture(input: BuildIncidentRoomInput, posture: AgentCouncilDecision['posture']): string {
  if (posture === 'policy_blocked') {
    return `暂停该 Incident。在 Policy Guard 放行前，不要 Prepare 或提交：${input.policyCheck.errors[0] ?? 'Policy 检查失败'}`;
  }

  if (posture === 'live_ready') {
    return '只有在用户明确选择并完成钱包签名后，Live Spot 才可执行；随后立即归档结果证据。';
  }

  if (posture === 'audit_only') {
    return '保持为无交易钱包复核，保留证据链，不要虚构 DeepBook 动作。';
  }

  return 'Prepare mainnet 动作包并归档完整证据链；默认不提交 Live 交易。';
}

function marketConsensusStatus(evidence: IncidentDeepBookMarketEvidence): IncidentConsensusStatus {
  if (evidence.status === 'ready') {
    return 'agree';
  }

  if (evidence.routeStatus === 'error') {
    return 'watch';
  }

  return 'watch';
}

function agentStatus(decision: AgentCouncilDecision, id: string): CouncilAgentStatus | undefined {
  return decision.agents.find((agent) => agent.id === id)?.status;
}

function signalFinding(report: RiskReport): string {
  const topSignal = report.signals[0];

  if (!topSignal) {
    return '当前 Portfolio 上下文没有活跃的已定价风险信号。';
  }

  return `${topSignal.title} 是首要信号，严重度为 ${topSignal.level}。`;
}

function buildTasks(input: BuildIncidentRoomInput, council: AgentCouncilDecision): IncidentTask[] {
  const enabledRules = activeMonitorCount(input.monitorRules);
  const marketReady = input.deepbookMarketEvidence.status === 'ready';
  const policyBlocked = !input.policyCheck.ok;
  const walletReview = input.recommendation.type === 'wallet_review';

  return [
    {
      id: 'manager',
      agentName: 'Manager',
      objective: '打开 Incident，分配有边界的 Agent 工作，并发出最终指令。',
      status: council.posture === 'policy_blocked' ? 'blocked' : council.posture === 'live_ready' ? 'ready' : 'watch',
      priority: 1,
      findings: [
        `Council 姿态已锁定为 ${postureLabel(council.posture)}。`,
        `Incident 严重度为 ${severityFromInput(input, council.posture)}，来自确定性风险和 Policy 信号。`,
      ],
      evidenceRefs: ['agentCouncil', 'policyCheck', 'riskReportBefore'],
      handoff: finalCommandForPosture(input, council.posture),
      locked: true,
    },
    {
      id: 'risk_analyst',
      agentName: 'Risk Analyst',
      objective: '分诊已定价的钱包/情景风险，并识别活跃 Incident 驱动因素。',
      status: agentStatus(council, 'risk_analyst') ?? 'clear',
      priority: 2,
      findings: [
        `风险评分为 ${input.riskReport.overallScore}/${input.riskReport.overallLevel}。`,
        signalFinding(input.riskReport),
      ],
      evidenceRefs: ['riskReportBefore', 'portfolioSnapshot'],
      handoff:
        input.riskReport.signals.length > 0
          ? '将首要信号上下文交给 Liquidity Scout 和 Execution Planner。'
          : '将低风险上下文交给 Audit Agent 做证据打包。',
      locked: true,
    },
    {
      id: 'liquidity_scout',
      agentName: 'Liquidity Scout',
      objective: '检查 DeepBook 市场证据是否足以支撑有边界的动作。',
      status: marketReady ? 'ready' : input.deepbookMarketEvidence.routeStatus === 'error' ? 'watch' : 'waiting',
      priority: 3,
      findings: [
        marketReady
          ? `${input.deepbookMarketEvidence.poolKey} 快照已就绪${input.deepbookMarketEvidence.midPrice ? `，中间价 ${input.deepbookMarketEvidence.midPrice}` : ''}。`
          : input.deepbookMarketEvidence.fallbackReason ?? 'DeepBook 市场证据尚未就绪。',
        `路线状态为 ${input.deepbookMarketEvidence.routeStatus ?? 'unknown'}。`,
      ],
      evidenceRefs: ['deepbookMarketEvidence'],
      handoff: marketReady
        ? '将市场就绪状态交给 Execution Planner。'
        : '将依赖市场的动作保持为仅 Prepare 或复核模式。',
      locked: true,
    },
    {
      id: 'policy_guard',
      agentName: 'Policy Guard',
      objective: '执行预算、资产、市场、过期时间和人工确认约束。',
      status: policyBlocked ? 'blocked' : 'ready',
      priority: 4,
      findings: policyBlocked
        ? input.policyCheck.errors
        : [
            `预算上限为 $${input.policy.maxBudgetUsd.toFixed(2)}。`,
            input.policyObject?.objectId ? `Sui AgentPolicy object 已选择：${input.policyObject.objectId}。` : 'Sui AgentPolicy object 尚未 mint。',
            `人工确认${input.policy.requireManualApproval ? '必需' : '非必需'}。`,
          ],
      evidenceRefs: ['policy', 'policyCheck', 'policyObject'],
      handoff: policyBlocked
        ? '在 Policy 修正前阻断所有执行路径。'
        : '将 Policy 放行后的边界交给 Execution Planner 和 Audit Agent。',
      locked: true,
    },
    {
      id: 'execution_planner',
      agentName: 'Execution Planner',
      objective: '把已批准策略转换为允许范围内最稳妥的执行姿态。',
      status: policyBlocked ? 'blocked' : walletReview ? 'watch' : council.posture === 'live_ready' ? 'ready' : 'watch',
      priority: 5,
      findings: [
        `推荐类型为 ${input.recommendation.type}。`,
        `DeepBook 动作模式为 ${input.recommendation.deepbookAction.mode}；市场为 ${input.recommendation.deepbookAction.market}。`,
        `默认执行仍为 ${council.posture === 'live_ready' ? '明确选择后才进行钱包签名 Live' : 'Prepare/归档'}。`,
      ],
      evidenceRefs: ['recommendation', 'liveGate', 'policyCheck'],
      handoff: walletReview
        ? '将无交易复核交给 Audit Agent。'
        : policyBlocked
          ? '在准备任何内容前等待 Policy Guard。'
          : '将有边界的 Prepare 包交给 Audit Agent。',
      locked: true,
    },
    {
      id: 'audit_agent',
      agentName: 'Audit Agent',
      objective: '打包监控规则、Council 决策、DeepBook 证据和存储 receipt。',
      status: input.auditArchived ? 'ready' : marketReady ? 'watch' : 'waiting',
      priority: 6,
      findings: [
        `${enabledRules}/${input.monitorRules.length} 条监控规则已启用。`,
        input.auditArchived ? '该 Incident 的 Walrus 归档已完成。' : 'Walrus 归档会等待 Prepare/归档后完成。',
        input.receiptEnabled ? '归档后可 mint Receipt。' : 'Receipt 包为可选或尚未配置。',
      ],
      evidenceRefs: ['monitorRules', 'storage', 'receipt'],
      handoff: input.auditArchived
        ? '向用户展示 blob/checksum 和可选 receipt。'
        : '最终封存证据前等待 Prepare/归档。',
      locked: true,
    },
  ];
}

function buildHandoffs(input: BuildIncidentRoomInput, council: AgentCouncilDecision): IncidentHandoff[] {
  const policyStatus: IncidentConsensusStatus = input.policyCheck.ok ? 'agree' : 'blocked';
  const strategyStatus: IncidentConsensusStatus =
    input.recommendation.type === 'wallet_review' ? 'watch' : input.policyCheck.ok ? 'agree' : 'blocked';

  return [
    {
      id: 'risk-to-liquidity',
      from: 'risk_analyst',
      to: 'liquidity_scout',
      status: input.riskReport.signals.length > 0 ? 'watch' : 'agree',
      summary: input.riskReport.signals[0]
        ? `Risk Analyst 将 ${input.riskReport.signals[0].id} 升级为市场证据检查。`
        : 'Risk Analyst 报告没有已定价的 Incident 驱动因素。',
      evidenceRef: 'riskReportBefore',
    },
    {
      id: 'liquidity-to-execution',
      from: 'liquidity_scout',
      to: 'execution_planner',
      status: marketConsensusStatus(input.deepbookMarketEvidence),
      summary:
        input.deepbookMarketEvidence.status === 'ready'
          ? 'Liquidity Scout 确认 DeepBook 证据可支撑有边界的 Prepare 包。'
          : 'Liquidity Scout 在证据就绪前将依赖市场的执行保持为复核。',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'policy-to-execution',
      from: 'policy_guard',
      to: 'execution_planner',
      status: policyStatus,
      summary: input.policyCheck.ok
        ? 'Policy Guard 放行有边界的推荐。'
        : `Policy Guard 阻断执行：${input.policyCheck.errors[0] ?? 'Policy 检查失败'}`,
      evidenceRef: 'policyCheck',
    },
    {
      id: 'execution-to-audit',
      from: 'execution_planner',
      to: 'audit_agent',
      status: strategyStatus,
      summary:
        council.posture === 'audit_only'
          ? 'Execution Planner 将无交易复核包交给 Audit Agent。'
          : 'Execution Planner 将已锁定姿态和有边界动作交给 Audit Agent。',
      evidenceRef: 'recommendation',
    },
    {
      id: 'audit-to-manager',
      from: 'audit_agent',
      to: 'manager',
      status: input.auditArchived ? 'agree' : 'watch',
      summary: input.auditArchived
        ? 'Audit Agent 确认证据封存已完成。'
        : 'Audit Agent 已准备好在 Prepare/归档后封存证据。',
      evidenceRef: 'storage',
    },
  ];
}

function buildConsensus(input: BuildIncidentRoomInput, council: AgentCouncilDecision): IncidentConsensusItem[] {
  return [
    {
      id: 'risk-consensus',
      label: '风险信号',
      status: input.riskReport.signals.length > 0 ? 'watch' : 'agree',
      summary:
        input.riskReport.signals.length > 0
          ? `${input.riskReport.signals.length} 个确定性信号需要处理。`
          : '没有需要处理的已定价风险信号。',
      evidenceRef: 'riskReportBefore',
    },
    {
      id: 'policy-consensus',
      label: 'Policy 闸门',
      status: input.policyCheck.ok ? 'agree' : 'blocked',
      summary: input.policyCheck.ok
        ? '所有 Policy 检查均通过。'
        : `${input.policyCheck.errors.length} 个 Policy 问题阻断执行。`,
      evidenceRef: 'policyCheck',
    },
    {
      id: 'market-consensus',
      label: '市场证据',
      status: marketConsensusStatus(input.deepbookMarketEvidence),
      summary:
        input.deepbookMarketEvidence.status === 'ready'
          ? `${input.deepbookMarketEvidence.poolKey} 证据已可用于审计。`
          : input.deepbookMarketEvidence.fallbackReason ?? 'DeepBook 证据尚未就绪。',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'execution-consensus',
      label: '执行姿态',
      status: council.posture === 'policy_blocked' ? 'blocked' : council.posture === 'live_ready' ? 'agree' : 'watch',
      summary: finalCommandForPosture(input, council.posture),
      evidenceRef: 'agentCouncil',
    },
  ];
}

export function buildIncidentRoomDecision(input: BuildIncidentRoomInput): IncidentRoomDecision {
  const agentCouncil = buildAgentCouncilDecision(input);
  const severity = severityFromInput(input, agentCouncil.posture);
  const finalCommand = finalCommandForPosture(input, agentCouncil.posture);

  return {
    id: `incident-${input.recommendation.id}`,
    mode: 'deterministic_fallback',
    model: 'riskpilot-incident-rules-v1',
    sourceCouncilId: agentCouncil.id,
    posture: agentCouncil.posture,
    severity,
    managerBriefing: `Incident Room 已打开，严重度为 ${severity}。${agentCouncil.managerSummary}`,
    finalCommand,
    tasks: buildTasks(input, agentCouncil),
    handoffs: buildHandoffs(input, agentCouncil),
    consensus: buildConsensus(input, agentCouncil),
    evidenceTimeline: agentCouncil.evidenceTimeline,
  };
}
