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

function finalCommandForPosture(input: BuildIncidentRoomInput, posture: AgentCouncilDecision['posture']): string {
  if (posture === 'policy_blocked') {
    return `Pause this incident. Do not prepare or submit until Policy Guard clears it: ${input.policyCheck.errors[0] ?? 'Policy check failed'}`;
  }

  if (posture === 'live_ready') {
    return 'Live spot can execute only after the user explicitly chooses it and completes wallet signing. Archive result evidence immediately after.';
  }

  if (posture === 'audit_only') {
    return 'Keep this as a no-trade wallet review, preserve the evidence chain, and do not invent a DeepBook action.';
  }

  return 'Prepare the mainnet action package and archive the full evidence chain. Do not submit a live transaction by default.';
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
    return 'No active priced risk signals in the current portfolio context.';
  }

  return `${topSignal.title} is the top signal with ${topSignal.level} severity.`;
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
      objective: 'Open the incident, assign bounded Agent work, and issue the final command.',
      status: council.posture === 'policy_blocked' ? 'blocked' : council.posture === 'live_ready' ? 'ready' : 'watch',
      priority: 1,
      findings: [
        `Council posture locked as ${postureLabel(council.posture)}.`,
        `Incident severity is ${severityFromInput(input, council.posture)}, based on deterministic risk and Policy signals.`,
      ],
      evidenceRefs: ['agentCouncil', 'policyCheck', 'riskReportBefore'],
      handoff: finalCommandForPosture(input, council.posture),
      locked: true,
    },
    {
      id: 'risk_analyst',
      agentName: 'Risk Analyst',
      objective: 'Triage priced wallet and scenario risk, then identify active incident drivers.',
      status: agentStatus(council, 'risk_analyst') ?? 'clear',
      priority: 2,
      findings: [
        `Risk score is ${input.riskReport.overallScore}/${input.riskReport.overallLevel}.`,
        signalFinding(input.riskReport),
      ],
      evidenceRefs: ['riskReportBefore', 'portfolioSnapshot'],
      handoff:
        input.riskReport.signals.length > 0
          ? 'Send top-signal context to Liquidity Scout and Execution Planner.'
          : 'Send low-risk context to Audit Agent for evidence packaging.',
      locked: true,
    },
    {
      id: 'liquidity_scout',
      agentName: 'Liquidity Scout',
      objective: 'Check whether DeepBook market evidence can support a bounded action.',
      status: marketReady ? 'ready' : input.deepbookMarketEvidence.routeStatus === 'error' ? 'watch' : 'waiting',
      priority: 3,
      findings: [
        marketReady
          ? `${input.deepbookMarketEvidence.poolKey} snapshot is ready${input.deepbookMarketEvidence.midPrice ? `, mid ${input.deepbookMarketEvidence.midPrice}` : ''}.`
          : input.deepbookMarketEvidence.fallbackReason ?? 'DeepBook market evidence is not ready.',
        `Route status is ${input.deepbookMarketEvidence.routeStatus ?? 'unknown'}.`,
      ],
      evidenceRefs: ['deepbookMarketEvidence'],
      handoff: marketReady
        ? 'Send market readiness to Execution Planner.'
        : 'Keep market-dependent actions in prepare-only or review mode.',
      locked: true,
    },
    {
      id: 'policy_guard',
      agentName: 'Policy Guard',
      objective: 'Enforce budget, asset, market, expiry, and manual-confirmation constraints.',
      status: policyBlocked ? 'blocked' : 'ready',
      priority: 4,
      findings: policyBlocked
        ? input.policyCheck.errors
        : [
            `Budget cap is $${input.policy.maxBudgetUsd.toFixed(2)}.`,
            input.policyObject?.objectId ? `Sui AgentPolicy object selected: ${input.policyObject.objectId}.` : 'Sui AgentPolicy object not minted.',
            `Manual confirmation is ${input.policy.requireManualApproval ? 'required' : 'not required'}.`,
          ],
      evidenceRefs: ['policy', 'policyCheck', 'policyObject'],
      handoff: policyBlocked
        ? 'Block every execution path until Policy is fixed.'
        : 'Send Policy-cleared boundaries to Execution Planner and Audit Agent.',
      locked: true,
    },
    {
      id: 'execution_planner',
      agentName: 'Execution Planner',
      objective: 'Convert the approved strategy into the safest allowed execution posture.',
      status: policyBlocked ? 'blocked' : walletReview ? 'watch' : council.posture === 'live_ready' ? 'ready' : 'watch',
      priority: 5,
      findings: [
        `Recommendation type is ${input.recommendation.type}.`,
        `DeepBook action mode is ${input.recommendation.deepbookAction.mode}; market is ${input.recommendation.deepbookAction.market}.`,
        `Default execution remains ${council.posture === 'live_ready' ? 'live only after explicit wallet-signed choice' : 'prepare/archive'}.`,
      ],
      evidenceRefs: ['recommendation', 'liveGate', 'policyCheck'],
      handoff: walletReview
        ? 'Send no-trade review to Audit Agent.'
        : policyBlocked
          ? 'Wait for Policy Guard before preparing anything.'
          : 'Send bounded prepare package to Audit Agent.',
      locked: true,
    },
    {
      id: 'audit_agent',
      agentName: 'Audit Agent',
      objective: 'Package monitor rules, Council decisions, DeepBook evidence, and storage receipt.',
      status: input.auditArchived ? 'ready' : marketReady ? 'watch' : 'waiting',
      priority: 6,
      findings: [
        `${enabledRules}/${input.monitorRules.length} monitor rules enabled.`,
        input.auditArchived ? 'Walrus archive for this incident is complete.' : 'Walrus archive waits for prepare/archive completion.',
        input.receiptEnabled ? 'Receipt can be minted after archive.' : 'Receipt package is optional or not configured.',
      ],
      evidenceRefs: ['monitorRules', 'storage', 'receipt'],
      handoff: input.auditArchived
        ? 'Show blob/checksum and optional receipt to the user.'
        : 'Wait for prepare/archive before final evidence sealing.',
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
        ? `Risk Analyst escalates ${input.riskReport.signals[0].id} into market-evidence checks.`
        : 'Risk Analyst reports no priced incident driver.',
      evidenceRef: 'riskReportBefore',
    },
    {
      id: 'liquidity-to-execution',
      from: 'liquidity_scout',
      to: 'execution_planner',
      status: marketConsensusStatus(input.deepbookMarketEvidence),
      summary:
        input.deepbookMarketEvidence.status === 'ready'
          ? 'Liquidity Scout confirms DeepBook evidence can support a bounded prepare package.'
          : 'Liquidity Scout keeps market-dependent execution under review until evidence is ready.',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'policy-to-execution',
      from: 'policy_guard',
      to: 'execution_planner',
      status: policyStatus,
      summary: input.policyCheck.ok
        ? 'Policy Guard clears the bounded recommendation.'
        : `Policy Guard blocks execution: ${input.policyCheck.errors[0] ?? 'Policy check failed'}`,
      evidenceRef: 'policyCheck',
    },
    {
      id: 'execution-to-audit',
      from: 'execution_planner',
      to: 'audit_agent',
      status: strategyStatus,
      summary:
        council.posture === 'audit_only'
          ? 'Execution Planner sends the no-trade review package to Audit Agent.'
          : 'Execution Planner sends the locked posture and bounded action to Audit Agent.',
      evidenceRef: 'recommendation',
    },
    {
      id: 'audit-to-manager',
      from: 'audit_agent',
      to: 'manager',
      status: input.auditArchived ? 'agree' : 'watch',
      summary: input.auditArchived
        ? 'Audit Agent confirms evidence sealing is complete.'
        : 'Audit Agent is ready to seal evidence after prepare/archive.',
      evidenceRef: 'storage',
    },
  ];
}

function buildConsensus(input: BuildIncidentRoomInput, council: AgentCouncilDecision): IncidentConsensusItem[] {
  return [
    {
      id: 'risk-consensus',
      label: 'Risk signals',
      status: input.riskReport.signals.length > 0 ? 'watch' : 'agree',
      summary:
        input.riskReport.signals.length > 0
          ? `${input.riskReport.signals.length} deterministic signals need handling.`
          : 'No priced risk signals need handling.',
      evidenceRef: 'riskReportBefore',
    },
    {
      id: 'policy-consensus',
      label: 'Policy gate',
      status: input.policyCheck.ok ? 'agree' : 'blocked',
      summary: input.policyCheck.ok
        ? 'All Policy checks passed.'
        : `${input.policyCheck.errors.length} Policy issues block execution.`,
      evidenceRef: 'policyCheck',
    },
    {
      id: 'market-consensus',
      label: 'Market evidence',
      status: marketConsensusStatus(input.deepbookMarketEvidence),
      summary:
        input.deepbookMarketEvidence.status === 'ready'
          ? `${input.deepbookMarketEvidence.poolKey} evidence is ready for audit.`
          : input.deepbookMarketEvidence.fallbackReason ?? 'DeepBook evidence is not ready.',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'execution-consensus',
      label: 'Execution posture',
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
    managerBriefing: `Incident Room opened with ${severity} severity. ${agentCouncil.managerSummary}`,
    finalCommand,
    tasks: buildTasks(input, agentCouncil),
    handoffs: buildHandoffs(input, agentCouncil),
    consensus: buildConsensus(input, agentCouncil),
    evidenceTimeline: agentCouncil.evidenceTimeline,
  };
}
