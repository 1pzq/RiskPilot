import type { RiskReport } from '@/lib/risk/types';
import type { AiProviderMode } from '@/lib/ai/provider';
import type { DeepBookLiveGate } from '@/lib/sui/deepbook-live';
import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { MonitorRule } from '@/lib/strategy/monitor';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';

export type CouncilAgentId =
  | 'risk_analyst'
  | 'strategy_agent'
  | 'policy_guard'
  | 'audit_agent'
  | 'manager';

export type CouncilAgentStatus = 'clear' | 'watch' | 'blocked' | 'ready';

export type CouncilAgentVerdict = {
  id: CouncilAgentId;
  name: string;
  role: string;
  status: CouncilAgentStatus;
  confidence: number;
  summary: string;
  evidence: string[];
  handoff: string;
};

export type EvidenceTimelineStepStatus = 'complete' | 'pending' | 'blocked' | 'warning';

export type EvidenceTimelineStep = {
  id: string;
  label: string;
  status: EvidenceTimelineStepStatus;
  summary: string;
  evidenceRef: string;
};

export type AgentCouncilMode = 'openai' | 'deepseek' | 'deterministic_fallback';

export type AgentCouncilDecision = {
  id: string;
  mode: AgentCouncilMode;
  model?: string;
  warning?: string;
  posture: 'audit_only' | 'prepare_ready' | 'policy_blocked' | 'live_ready';
  managerSummary: string;
  agents: CouncilAgentVerdict[];
  evidenceTimeline: EvidenceTimelineStep[];
};

type CouncilDeepBookMarketEvidence = {
  status: 'ready' | 'unavailable';
  routeStatus?: 'idle' | 'loading' | 'ready' | 'error';
  poolKey: string;
  fallbackReason?: string;
};

export type BuildAgentCouncilInput = {
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  monitorRules: MonitorRule[];
  deepbookMarketEvidence: CouncilDeepBookMarketEvidence;
  explanationMode: AiProviderMode;
  walletConnected: boolean;
  auditArchived: boolean;
  receiptEnabled: boolean;
  liveGate?: DeepBookLiveGate;
  policyObject?: {
    objectId?: string;
    status?: string;
    source?: string;
  } | null;
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function signalSummary(report: RiskReport): string {
  if (report.signals.length === 0) {
    return 'No active priced risk signals.';
  }

  return report.signals
    .slice(0, 3)
    .map((signal) => `${signal.title} (${signal.level})`)
    .join('; ');
}

function enabledMonitorCount(rules: MonitorRule[]): number {
  return rules.filter((rule) => rule.enabled).length;
}

function buildPosture(input: BuildAgentCouncilInput): AgentCouncilDecision['posture'] {
  if (!input.policyCheck.ok) {
    return 'policy_blocked';
  }

  if (input.liveGate?.canSubmitLive) {
    return 'live_ready';
  }

  if (input.recommendation.type === 'wallet_review') {
    return 'audit_only';
  }

  return 'prepare_ready';
}

function postureSummary(posture: AgentCouncilDecision['posture'], input: BuildAgentCouncilInput): string {
  if (posture === 'policy_blocked') {
    return `Manager blocks execution until Policy is fixed: ${input.policyCheck.errors[0] ?? 'Policy check failed'}`;
  }

  if (posture === 'live_ready') {
    return 'Manager allows live spot only when wallet, Policy, route, and market gates all pass.';
  }

  if (posture === 'audit_only') {
    return 'Manager keeps this wallet audit-only because RiskPilot cannot invent a priced executable route.';
  }

  return 'Manager approves a prepare-only package: risk, strategy, Policy, and market evidence are ready to archive.';
}

function statusFromRisk(score: number): CouncilAgentStatus {
  if (score >= 50) {
    return 'watch';
  }

  return 'clear';
}

function policyStatus(policyCheck: PolicyCheckResult): CouncilAgentStatus {
  return policyCheck.ok ? 'ready' : 'blocked';
}

function marketStatus(evidence: CouncilDeepBookMarketEvidence): EvidenceTimelineStepStatus {
  if (evidence.status === 'ready') {
    return 'complete';
  }

  if (evidence.routeStatus === 'error') {
    return 'warning';
  }

  return 'pending';
}

export function buildAgentCouncilDecision(input: BuildAgentCouncilInput): AgentCouncilDecision {
  const posture = buildPosture(input);
  const activeSignals = input.riskReport.signals.length;
  const enabledRules = enabledMonitorCount(input.monitorRules);
  const topSignal = input.riskReport.signals[0];
  const liveReasons = input.liveGate?.reasons.filter((reason) => reason !== 'Select live mainnet explicitly.') ?? [];

  const agents: CouncilAgentVerdict[] = [
    {
      id: 'risk_analyst',
      name: 'Risk Analyst',
      role: 'Assess deterministic wallet and scenario risk.',
      status: statusFromRisk(input.riskReport.overallScore),
      confidence: clampConfidence(74 + Math.min(16, activeSignals * 4)),
      summary:
        activeSignals > 0
          ? `${activeSignals} signals active; score ${input.riskReport.overallScore}/${input.riskReport.overallLevel}.`
          : `Score ${input.riskReport.overallScore}/${input.riskReport.overallLevel}; no active priced signals.`,
      evidence: [
        signalSummary(input.riskReport),
        `Scenario checks: ${input.riskReport.scenarioResults.map((scenario) => scenario.scenario).join(', ')}`,
      ],
      handoff: topSignal ? `Escalate ${topSignal.id} to Strategy Agent.` : 'Send wallet context into audit-only review.',
    },
    {
      id: 'strategy_agent',
      name: 'Strategy Agent',
      role: 'Map risk into bounded DeepBook actions.',
      status: input.recommendation.type === 'wallet_review' ? 'watch' : 'ready',
      confidence: clampConfidence(input.recommendation.deepbookAction.amountUsd > 0 ? 86 : 72),
      summary: `${input.recommendation.title} covers ${input.recommendation.targetRiskSignalIds.length || 'review-only'} signals.`,
      evidence: [
        `Mode: ${input.recommendation.deepbookAction.mode}`,
        `Market: ${input.recommendation.deepbookAction.market}`,
        `Estimated cost: $${input.recommendation.estimatedCostUsd.toFixed(2)}`,
      ],
      handoff:
        input.recommendation.deepbookAction.amountUsd > 0
          ? 'Send prepared action to Policy Guard.'
          : 'Send no-trade review package to Audit Agent.',
    },
    {
      id: 'policy_guard',
      name: 'Policy Guard',
      role: 'Enforce budget, asset, market, expiry, and approval gates.',
      status: policyStatus(input.policyCheck),
      confidence: clampConfidence(input.policyCheck.ok ? 94 : 88),
      summary: input.policyCheck.ok
        ? `Policy allows up to $${input.policy.maxBudgetUsd.toFixed(2)}; manual approval ${input.policy.requireManualApproval ? 'required' : 'not required'}.`
        : `${input.policyCheck.errors.length} Policy issues need fixing.`,
      evidence: input.policyCheck.ok
        ? [
            `Allowed assets: ${input.policy.allowedAssets.join(', ')}`,
            `Allowed markets: ${input.policy.allowedMarkets.join(', ')}`,
          ]
        : input.policyCheck.errors,
      handoff: input.policyCheck.ok ? 'Send gated package to Audit Agent.' : 'Block prepare/archive until Policy is fixed.',
    },
    {
      id: 'audit_agent',
      name: 'Audit Agent',
      role: 'Package evidence for Walrus and receipt handoff.',
      status: input.deepbookMarketEvidence.status === 'ready' || input.auditArchived ? 'ready' : 'watch',
      confidence: clampConfidence(input.deepbookMarketEvidence.status === 'ready' ? 90 : 70),
      summary: input.auditArchived
        ? 'Archive complete; package includes execution and storage evidence.'
        : `${enabledRules}/${input.monitorRules.length} monitor rules enabled in archive preview; DeepBook evidence is ${input.deepbookMarketEvidence.status}.`,
      evidence: [
        `DeepBook: ${input.deepbookMarketEvidence.status} ${input.deepbookMarketEvidence.poolKey}`,
        `Explanation mode: ${input.explanationMode}`,
        `Receipt: ${input.receiptEnabled ? 'available after Walrus archive' : 'not configured'}`,
      ],
      handoff: input.auditArchived ? 'Show storage result and optional receipt mint.' : 'Wait for user to prepare/archive.',
    },
    {
      id: 'manager',
      name: 'Manager',
      role: 'Summarize Agent conclusions into one execution posture.',
      status: posture === 'policy_blocked' ? 'blocked' : posture === 'live_ready' ? 'ready' : 'watch',
      confidence: clampConfidence(input.policyCheck.ok ? 89 : 80),
      summary: postureSummary(posture, input),
      evidence: [
        `Wallet mode: ${input.walletConnected ? 'connected mainnet wallet' : 'local sample context'}`,
        input.policyObject?.objectId ? `Policy object: ${input.policyObject.objectId}` : 'Policy object not minted.',
        liveReasons.length > 0 ? `Live gate notes: ${liveReasons.join(' ')}` : 'No live-gate blocking note for the selected context.',
      ],
      handoff: posture === 'live_ready' ? 'User may choose wallet-signed spot submission.' : 'Default action remains prepare/archive.',
    },
  ];

  const evidenceTimeline: EvidenceTimelineStep[] = [
    {
      id: 'wallet-scan',
      label: 'Wallet scan',
      status: input.walletConnected ? 'complete' : 'pending',
      summary: input.walletConnected
        ? 'Live mainnet wallet context loaded.'
        : 'Connecting a wallet replaces local sample context with live mainnet data.',
      evidenceRef: 'portfolioSnapshot',
    },
    {
      id: 'risk-signals',
      label: 'Risk signals',
      status: 'complete',
      summary: `${activeSignals} signals scored ${input.riskReport.overallScore}/${input.riskReport.overallLevel}.`,
      evidenceRef: 'riskReportBefore',
    },
    {
      id: 'strategy',
      label: 'Strategy',
      status: input.recommendation.type === 'wallet_review' ? 'warning' : 'complete',
      summary: input.recommendation.title,
      evidenceRef: 'recommendation',
    },
    {
      id: 'policy',
      label: 'Policy gate',
      status: input.policyCheck.ok ? 'complete' : 'blocked',
      summary: input.policyCheck.ok ? 'Policy gate passed.' : input.policyCheck.errors[0] ?? 'Policy gate failed.',
      evidenceRef: 'policyCheck',
    },
    {
      id: 'deepbook',
      label: 'DeepBook evidence',
      status: marketStatus(input.deepbookMarketEvidence),
      summary:
        input.deepbookMarketEvidence.status === 'ready'
          ? `${input.deepbookMarketEvidence.poolKey} market snapshot is ready.`
          : input.deepbookMarketEvidence.fallbackReason ?? 'Market snapshot is not ready.',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'walrus',
      label: 'Walrus archive',
      status: input.auditArchived ? 'complete' : 'pending',
      summary: input.auditArchived ? 'Audit package archived.' : 'Archive is created after prepare.',
      evidenceRef: 'storage',
    },
    {
      id: 'receipt',
      label: 'Receipt',
      status: input.receiptEnabled ? (input.auditArchived ? 'pending' : 'warning') : 'warning',
      summary: input.receiptEnabled ? 'Receipt can be minted after Walrus archive.' : 'Receipt package is optional or not configured.',
      evidenceRef: 'receipt',
    },
  ];

  return {
    id: `council-${input.recommendation.id}`,
    mode: 'deterministic_fallback',
    model: 'riskpilot-rules-v1',
    posture,
    managerSummary: postureSummary(posture, input),
    agents,
    evidenceTimeline,
  };
}
