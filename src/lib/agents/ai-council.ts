import OpenAI from 'openai';
import { z } from 'zod';

import type { RiskReport } from '@/lib/risk/types';
import { getAiProviderConfig, missingAiProviderMessage } from '@/lib/ai/provider';
import type { AiProviderMode } from '@/lib/ai/provider';
import type { DeepBookLiveGate } from '@/lib/sui/deepbook-live';
import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { MonitorRule } from '@/lib/strategy/monitor';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import {
  buildAgentCouncilDecision,
  type AgentCouncilDecision,
  type BuildAgentCouncilInput,
  type CouncilAgentId,
} from './decision-council';

type AiDeepBookMarketEvidence = BuildAgentCouncilInput['deepbookMarketEvidence'] & {
  midPrice?: number;
  error?: string;
};

export type BuildAiAgentCouncilInput = {
  riskReport: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  monitorRules: MonitorRule[];
  deepbookMarketEvidence: AiDeepBookMarketEvidence;
  explanationMode: AiProviderMode;
  walletConnected: boolean;
  auditArchived: boolean;
  receiptEnabled: boolean;
  liveGate?: DeepBookLiveGate;
  policyObject?: BuildAgentCouncilInput['policyObject'];
};

type AiCouncilDraft = {
  managerSummary: string;
  agents: {
    id: CouncilAgentId;
    summary: string;
    evidence?: string[];
    handoff: string;
    confidence?: number;
  }[];
};

const AiCouncilDraftSchema = z.object({
  managerSummary: z.string().min(12).max(420),
  agents: z.array(
    z.object({
      id: z.enum(['risk_analyst', 'strategy_agent', 'policy_guard', 'audit_agent', 'manager']),
      summary: z.string().min(8).max(360),
      evidence: z.array(z.string().min(1).max(220)).max(6).optional(),
      handoff: z.string().min(6).max(260),
      confidence: z.number().min(0).max(100).optional(),
    }),
  ),
});

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u);

  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('AI council response did not contain JSON.');
}

function sanitizeWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : 'AI council unavailable.';
  return `AI council fallback used: ${message.replace(/sk-[A-Za-z0-9_-]+/gu, '[redacted]').slice(0, 220)}`;
}

function buildCouncilInstructions(deterministic: AgentCouncilDecision): string {
  return [
    'You are RiskPilot Agent Council, an AI-backed review layer for a Sui DeFi risk desk.',
    'Return only compact JSON with keys managerSummary and agents.',
    'Do not include markdown.',
    'You may improve wording for the five existing agents only.',
    `The final posture is locked as ${deterministic.posture}; do not contradict it.`,
    'Do not invent trades, transaction digests, policy approvals, wallet data, or protocol facts.',
    'AI never submits transactions, never overrides policyCheck, and never changes prepare_mainnet as the default.',
    'If the policy is blocked, say the manager blocks execution until policy is fixed.',
    'If the recommendation is wallet_review, keep the decision audit-only and do not suggest a live or prepared trade.',
  ].join(' ');
}

function buildCouncilPayload(input: BuildAiAgentCouncilInput, deterministic: AgentCouncilDecision): string {
  return JSON.stringify({
    lockedPosture: deterministic.posture,
    lockedTimeline: deterministic.evidenceTimeline.map((step) => ({
      id: step.id,
      status: step.status,
      evidenceRef: step.evidenceRef,
    })),
    risk: {
      score: input.riskReport.overallScore,
      level: input.riskReport.overallLevel,
      signals: input.riskReport.signals.slice(0, 5).map((signal) => ({
        id: signal.id,
        title: signal.title,
        level: signal.level,
        summary: signal.summary,
        evidence: signal.evidence,
      })),
      scenarios: input.riskReport.scenarioResults,
    },
    recommendation: {
      type: input.recommendation.type,
      title: input.recommendation.title,
      summary: input.recommendation.summary,
      targetRiskSignalIds: input.recommendation.targetRiskSignalIds,
      estimatedCostUsd: input.recommendation.estimatedCostUsd,
      expectedRiskReduction: input.recommendation.expectedRiskReduction,
      deepbookAction: input.recommendation.deepbookAction,
      prepareOnlyReason: input.recommendation.prepareOnlyReason,
      fallback: input.recommendation.fallback,
    },
    policy: {
      ok: input.policyCheck.ok,
      errors: input.policyCheck.errors,
      maxBudgetUsd: input.policy.maxBudgetUsd,
      maxSingleTradeUsd: input.policy.maxSingleTradeUsd,
      allowedAssets: input.policy.allowedAssets,
      allowedMarkets: input.policy.allowedMarkets,
      expiresAt: input.policy.expiresAt,
      requireManualApproval: input.policy.requireManualApproval,
    },
    policyObject: input.policyObject,
    monitorRules: input.monitorRules.map((rule) => ({
      label: rule.label,
      severity: rule.severity,
      enabled: rule.enabled,
      action: rule.recommendedAction.kind,
    })),
    deepbookMarketEvidence: input.deepbookMarketEvidence,
    liveGate: input.liveGate
      ? {
          canSubmitLive: input.liveGate.canSubmitLive,
          eligible: input.liveGate.eligible,
          reasons: input.liveGate.reasons,
        }
      : undefined,
    walletConnected: input.walletConnected,
    auditArchived: input.auditArchived,
    receiptEnabled: input.receiptEnabled,
    deterministicAgents: deterministic.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      summary: agent.summary,
      evidence: agent.evidence,
      handoff: agent.handoff,
      confidence: agent.confidence,
    })),
  });
}

function mergeAiDraft(
  deterministic: AgentCouncilDecision,
  draft: AiCouncilDraft,
  model: string,
  provider: AgentCouncilDecision['mode'],
): AgentCouncilDecision {
  const draftById = new Map(draft.agents.map((agent) => [agent.id, agent]));

  return {
    ...deterministic,
    mode: provider,
    model,
    warning: undefined,
    managerSummary: draft.managerSummary,
    agents: deterministic.agents.map((agent) => {
      const aiAgent = draftById.get(agent.id);

      if (!aiAgent) {
        return agent;
      }

      return {
        ...agent,
        summary: aiAgent.summary,
        evidence: aiAgent.evidence && aiAgent.evidence.length > 0 ? aiAgent.evidence.slice(0, 3) : agent.evidence,
        confidence: aiAgent.confidence == null ? agent.confidence : Math.round(aiAgent.confidence),
      };
    }),
  };
}

async function createAiCouncilDraft(input: BuildAiAgentCouncilInput, deterministic: AgentCouncilDecision) {
  const config = getAiProviderConfig();

  if (!config.apiKey) {
    throw new Error(missingAiProviderMessage(config));
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const apiMode = config.apiMode;
  const instructions = buildCouncilInstructions(deterministic);
  const payload = buildCouncilPayload(input, deterministic);

  if (apiMode === 'responses') {
    const response = await client.responses.create({
      model: config.model,
      instructions,
      input: payload,
      max_output_tokens: 1200,
      store: false,
      reasoning: config.reasoningEffort ? { effort: config.reasoningEffort } : undefined,
    });

    return {
      model: config.model,
      parsed: AiCouncilDraftSchema.parse(extractJsonObject(response.output_text ?? '')),
    };
  }

  const completion = await client.chat.completions.create({
    model: config.model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: instructions,
      },
      {
        role: 'user',
        content: payload,
      },
    ],
  });
  const content = completion.choices[0]?.message?.content ?? '';

  return {
    model: config.model,
    parsed: AiCouncilDraftSchema.parse(extractJsonObject(content)),
  };
}

export async function buildAiAgentCouncilDecision(
  input: BuildAiAgentCouncilInput,
): Promise<AgentCouncilDecision> {
  const deterministic = buildAgentCouncilDecision(input);

  const config = getAiProviderConfig();

  if (!config.apiKey) {
    return {
      ...deterministic,
      warning: `AI council fallback used: ${missingAiProviderMessage(config)}`,
    };
  }

  try {
    const draft = await createAiCouncilDraft(input, deterministic);
    return mergeAiDraft(deterministic, draft.parsed, draft.model, getAiProviderConfig().provider);
  } catch (error) {
    return {
      ...deterministic,
      warning: sanitizeWarning(error),
    };
  }
}
