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
    return '当前没有活跃的已定价风险信号。';
  }

  return report.signals
    .slice(0, 3)
    .map((signal) => `${signal.title}（${signal.level}）`)
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
    return `Manager 阻断执行，直到 Policy 修复：${input.policyCheck.errors[0] ?? 'Policy 检查失败'}`;
  }

  if (posture === 'live_ready') {
    return 'Manager 仅在钱包、Policy、路线和市场闸门全部通过时允许 Live Spot。';
  }

  if (posture === 'audit_only') {
    return 'Manager 将该钱包保持为仅审计，因为不能虚构已定价的可执行路线。';
  }

  return 'Manager 批准仅 Prepare 的包：风险、策略、Policy 和市场证据已可归档。';
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
      role: '评估确定性钱包风险与情景风险。',
      status: statusFromRisk(input.riskReport.overallScore),
      confidence: clampConfidence(74 + Math.min(16, activeSignals * 4)),
      summary:
        activeSignals > 0
          ? `${activeSignals} 个信号活跃；评分为 ${input.riskReport.overallScore}/${input.riskReport.overallLevel}。`
          : `评分为 ${input.riskReport.overallScore}/${input.riskReport.overallLevel}；没有活跃的已定价信号。`,
      evidence: [
        signalSummary(input.riskReport),
        `情景检查：${input.riskReport.scenarioResults.map((scenario) => scenario.scenario).join(', ')}`,
      ],
      handoff: topSignal ? `将 ${topSignal.id} 升级给 Strategy Agent。` : '将钱包上下文送入仅审计复核。',
    },
    {
      id: 'strategy_agent',
      name: 'Strategy Agent',
      role: '把风险映射为有边界的 DeepBook 动作。',
      status: input.recommendation.type === 'wallet_review' ? 'watch' : 'ready',
      confidence: clampConfidence(input.recommendation.deepbookAction.amountUsd > 0 ? 86 : 72),
      summary: `${input.recommendation.title} 针对 ${input.recommendation.targetRiskSignalIds.length || '仅复核'} 个信号。`,
      evidence: [
        `模式：${input.recommendation.deepbookAction.mode}`,
        `市场：${input.recommendation.deepbookAction.market}`,
        `预估成本：$${input.recommendation.estimatedCostUsd.toFixed(2)}`,
      ],
      handoff:
        input.recommendation.deepbookAction.amountUsd > 0
          ? '将已准备动作交给 Policy Guard。'
          : '将无交易复核包交给 Audit Agent。',
    },
    {
      id: 'policy_guard',
      name: 'Policy Guard',
      role: '执行预算、资产、市场、过期时间和审批闸门。',
      status: policyStatus(input.policyCheck),
      confidence: clampConfidence(input.policyCheck.ok ? 94 : 88),
      summary: input.policyCheck.ok
        ? `Policy 允许最高 $${input.policy.maxBudgetUsd.toFixed(2)}，人工确认${input.policy.requireManualApproval ? '必需' : '非必需'}。`
        : `${input.policyCheck.errors.length} 个 Policy 问题需要修复。`,
      evidence: input.policyCheck.ok
        ? [
            `允许资产：${input.policy.allowedAssets.join(', ')}`,
            `允许市场：${input.policy.allowedMarkets.join(', ')}`,
          ]
        : input.policyCheck.errors,
      handoff: input.policyCheck.ok ? '将通过闸门的包交给 Audit Agent。' : '在 Policy 修正前阻断 Prepare/归档。',
    },
    {
      id: 'audit_agent',
      name: 'Audit Agent',
      role: '为 Walrus 和 receipt 交接打包证据。',
      status: input.deepbookMarketEvidence.status === 'ready' || input.auditArchived ? 'ready' : 'watch',
      confidence: clampConfidence(input.deepbookMarketEvidence.status === 'ready' ? 90 : 70),
      summary: input.auditArchived
        ? '归档已完成；包内已包含执行与存储证据。'
        : `归档预览中 ${enabledRules}/${input.monitorRules.length} 条监控规则已启用，DeepBook 证据状态为 ${input.deepbookMarketEvidence.status}。`,
      evidence: [
        `DeepBook：${input.deepbookMarketEvidence.status} ${input.deepbookMarketEvidence.poolKey}`,
        `解释模式：${input.explanationMode}`,
        `Receipt：${input.receiptEnabled ? 'Walrus 归档后可用' : '未配置'}`,
      ],
      handoff: input.auditArchived ? '展示存储结果和可选 receipt mint。' : '等待用户点击 Prepare/归档。',
    },
    {
      id: 'manager',
      name: 'Manager',
      role: '汇总各 Agent 结论，形成一个执行姿态。',
      status: posture === 'policy_blocked' ? 'blocked' : posture === 'live_ready' ? 'ready' : 'watch',
      confidence: clampConfidence(input.policyCheck.ok ? 89 : 80),
      summary: postureSummary(posture, input),
      evidence: [
        `钱包模式：${input.walletConnected ? '已连接 mainnet 钱包' : '本地样例上下文'}`,
        input.policyObject?.objectId ? `Policy object：${input.policyObject.objectId}` : 'Policy object 尚未 mint。',
        liveReasons.length > 0 ? `Live 闸门备注：${liveReasons.join(' ')}` : '所选上下文没有 Live 闸门阻断备注。',
      ],
      handoff: posture === 'live_ready' ? '用户可以选择钱包签名的 Spot 提交。' : '默认动作仍为 Prepare/归档。',
    },
  ];

  const evidenceTimeline: EvidenceTimelineStep[] = [
    {
      id: 'wallet-scan',
      label: '钱包扫描',
      status: input.walletConnected ? 'complete' : 'pending',
      summary: input.walletConnected
        ? 'Live mainnet 钱包上下文已加载。'
        : '连接钱包后，本地样例上下文会替换为 Live mainnet 数据。',
      evidenceRef: 'portfolioSnapshot',
    },
    {
      id: 'risk-signals',
      label: '风险信号',
      status: 'complete',
      summary: `${activeSignals} 个信号评分为 ${input.riskReport.overallScore}/${input.riskReport.overallLevel}。`,
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
      label: 'Policy 闸门',
      status: input.policyCheck.ok ? 'complete' : 'blocked',
      summary: input.policyCheck.ok ? 'Policy 闸门已通过。' : input.policyCheck.errors[0] ?? 'Policy 闸门失败。',
      evidenceRef: 'policyCheck',
    },
    {
      id: 'deepbook',
      label: 'DeepBook 证据',
      status: marketStatus(input.deepbookMarketEvidence),
      summary:
        input.deepbookMarketEvidence.status === 'ready'
          ? `${input.deepbookMarketEvidence.poolKey} 市场快照已就绪。`
          : input.deepbookMarketEvidence.fallbackReason ?? '市场快照尚未就绪。',
      evidenceRef: 'deepbookMarketEvidence',
    },
    {
      id: 'walrus',
      label: 'Walrus 归档',
      status: input.auditArchived ? 'complete' : 'pending',
      summary: input.auditArchived ? '审计包已归档。' : '归档会在 Prepare 后创建。',
      evidenceRef: 'storage',
    },
    {
      id: 'receipt',
      label: 'Receipt',
      status: input.receiptEnabled ? (input.auditArchived ? 'pending' : 'warning') : 'warning',
      summary: input.receiptEnabled ? 'Walrus 归档后可 mint Receipt。' : 'Receipt 包为可选或尚未配置。',
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
