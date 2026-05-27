import type { RiskReport } from '@/lib/risk/types';
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

export type AgentCouncilMode = 'openai' | 'deterministic_fallback';

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
  explanationMode: 'mock' | 'openai';
  walletConnected: boolean;
  auditArchived: boolean;
  receiptEnabled: boolean;
  liveGate?: DeepBookLiveGate;
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function signalSummary(report: RiskReport): string {
  if (report.signals.length === 0) {
    return 'No priced risk signal is active.';
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
    return `Manager blocks execution until policy is fixed: ${input.policyCheck.errors[0] ?? 'policy check failed'}`;
  }

  if (posture === 'live_ready') {
    return 'Manager allows live Spot only because wallet, policy, route, and market gates are all green.';
  }

  if (posture === 'audit_only') {
    return 'Manager keeps this wallet in audit-only review because no priced actionable route should be invented.';
  }

  return 'Manager approves a prepare-only package: risk, strategy, policy, and market evidence are ready for archive.';
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
      role: 'Scores deterministic wallet and scenario risk.',
      status: statusFromRisk(input.riskReport.overallScore),
      confidence: clampConfidence(74 + Math.min(16, activeSignals * 4)),
      summary:
        activeSignals > 0
          ? `${activeSignals} signal${activeSignals === 1 ? '' : 's'} active; score is ${input.riskReport.overallScore}/${input.riskReport.overallLevel}.`
          : `Score is ${input.riskReport.overallScore}/${input.riskReport.overallLevel}; no priced signal is active.`,
      evidence: [
        signalSummary(input.riskReport),
        `Scenario checks: ${input.riskReport.scenarioResults.map((scenario) => scenario.scenario).join(', ')}`,
      ],
      handoff: topSignal ? `Escalate ${topSignal.id} to Strategy Agent.` : 'Send wallet context to audit-only review.',
    },
    {
      id: 'strategy_agent',
      name: 'Strategy Agent',
      role: 'Maps risk into a bounded DeepBook action.',
      status: input.recommendation.type === 'wallet_review' ? 'watch' : 'ready',
      confidence: clampConfidence(input.recommendation.deepbookAction.amountUsd > 0 ? 86 : 72),
      summary: `${input.recommendation.title} targets ${input.recommendation.targetRiskSignalIds.length || 'review-only'} signal${input.recommendation.targetRiskSignalIds.length === 1 ? '' : 's'}.`,
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
      role: 'Enforces budget, asset, market, expiry, and approval gates.',
      status: policyStatus(input.policyCheck),
      confidence: clampConfidence(input.policyCheck.ok ? 94 : 88),
      summary: input.policyCheck.ok
        ? `Policy allows up to $${input.policy.maxBudgetUsd.toFixed(2)} with manual approval ${input.policy.requireManualApproval ? 'required' : 'not required'}.`
        : `${input.policyCheck.errors.length} policy issue${input.policyCheck.errors.length === 1 ? '' : 's'} must be fixed.`,
      evidence: input.policyCheck.ok
        ? [
            `Allowed assets: ${input.policy.allowedAssets.join(', ')}`,
            `Allowed markets: ${input.policy.allowedMarkets.join(', ')}`,
          ]
        : input.policyCheck.errors,
      handoff: input.policyCheck.ok ? 'Send gated package to Audit Agent.' : 'Block prepare/archive until policy is corrected.',
    },
    {
      id: 'audit_agent',
      name: 'Audit Agent',
      role: 'Packages evidence for Walrus and receipt handoff.',
      status: input.deepbookMarketEvidence.status === 'ready' || input.auditArchived ? 'ready' : 'watch',
      confidence: clampConfidence(input.deepbookMarketEvidence.status === 'ready' ? 90 : 70),
      summary: input.auditArchived
        ? 'Archive completed; the package now includes execution and storage evidence.'
        : `Archive preview has ${enabledRules}/${input.monitorRules.length} monitor rules enabled and DeepBook evidence ${input.deepbookMarketEvidence.status}.`,
      evidence: [
        `DeepBook: ${input.deepbookMarketEvidence.status} ${input.deepbookMarketEvidence.poolKey}`,
        `Explanation mode: ${input.explanationMode}`,
        `Receipt: ${input.receiptEnabled ? 'enabled after Walrus archive' : 'not configured'}`,
      ],
      handoff: input.auditArchived ? 'Expose storage result and optional receipt mint.' : 'Wait for prepare/archive click.',
    },
    {
      id: 'manager',
      name: 'Manager',
      role: 'Synthesizes agent verdicts into one execution posture.',
      status: posture === 'policy_blocked' ? 'blocked' : posture === 'live_ready' ? 'ready' : 'watch',
      confidence: clampConfidence(input.policyCheck.ok ? 89 : 80),
      summary: postureSummary(posture, input),
      evidence: [
        `Wallet mode: ${input.walletConnected ? 'connected mainnet wallet' : 'judge scenario'}`,
        liveReasons.length > 0 ? `Live gate notes: ${liveReasons.join(' ')}` : 'Live gate has no blocking notes for the selected context.',
      ],
      handoff: posture === 'live_ready' ? 'User may opt into wallet-signed Spot submit.' : 'Default action remains prepare/archive.',
    },
  ];

  const evidenceTimeline: EvidenceTimelineStep[] = [
    {
      id: 'wallet-scan',
      label: 'Wallet scan',
      status: input.walletConnected ? 'complete' : 'pending',
      summary: input.walletConnected ? 'Live mainnet wallet context is loaded.' : 'Judge scenario is active until a wallet connects.',
      evidenceRef: 'portfolioSnapshot',
    },
    {
      id: 'risk-signals',
      label: 'Risk signals',
      status: 'complete',
      summary: `${activeSignals} signal${activeSignals === 1 ? '' : 's'} scored at ${input.riskReport.overallScore}/${input.riskReport.overallLevel}.`,
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
          : input.deepbookMarketEvidence.fallbackReason ?? 'Market snapshot is not ready yet.',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'walrus',
      label: 'Walrus archive',
      status: input.auditArchived ? 'complete' : 'pending',
      summary: input.auditArchived ? 'Audit package was archived.' : 'Archive is created after prepare.',
      evidenceRef: 'storage',
    },
    {
      id: 'receipt',
      label: 'Receipt',
      status: input.receiptEnabled ? (input.auditArchived ? 'pending' : 'warning') : 'warning',
      summary: input.receiptEnabled ? 'Receipt mint is available after Walrus archive.' : 'Receipt package is optional or not configured.',
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
