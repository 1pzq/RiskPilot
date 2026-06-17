import OpenAI from 'openai';
import { z } from 'zod';

import { getAiProviderConfig, missingAiProviderMessage } from '@/lib/ai/provider';
import {
  buildIncidentRoomDecision,
  type BuildIncidentRoomInput,
  type IncidentAgentId,
  type IncidentRoomDecision,
} from './incident-room';

type AiIncidentDraft = {
  managerBriefing: string;
  finalCommand: string;
  tasks: {
    id: IncidentAgentId;
    findings?: string[];
    handoff: string;
  }[];
};

const AiIncidentDraftSchema = z.object({
  managerBriefing: z.string().min(12).max(520),
  finalCommand: z.string().min(12).max(420),
  tasks: z.array(
    z.object({
      id: z.enum([
        'manager',
        'risk_analyst',
        'liquidity_scout',
        'policy_guard',
        'execution_planner',
        'audit_agent',
      ]),
      findings: z.array(z.string().min(1).max(220)).max(4).optional(),
      handoff: z.string().min(6).max(260),
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

  throw new Error('AI incident response did not contain JSON.');
}

function sanitizeWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : 'AI incident room unavailable.';
  return `AI incident room fallback used: ${message.replace(/sk-[A-Za-z0-9_-]+/gu, '[redacted]').slice(0, 220)}`;
}

function buildIncidentInstructions(deterministic: IncidentRoomDecision): string {
  return [
    'You are RiskPilot Agentic Incident Room, a narrative coordination layer for a Sui DeFi risk desk.',
    'Return only compact JSON with keys managerBriefing, finalCommand, and tasks.',
    'Do not include markdown.',
    `The final posture is locked as ${deterministic.posture}; do not contradict it.`,
    `The incident severity is locked as ${deterministic.severity}; do not change it.`,
    'You may improve wording for existing task findings and handoffs only.',
    'Do not invent trades, transaction bytes, digests, wallet assets, protocol facts, or new policy approvals.',
    'AI never submits transactions, never overrides policyCheck, never changes DeepBook eligibility, and never changes prepare_mainnet as the default.',
    'If policy is blocked, finalCommand must hold execution until policy is fixed.',
    'If posture is audit_only, finalCommand must be no-trade review and must not suggest a live or prepared trade.',
  ].join(' ');
}

function buildIncidentPayload(input: BuildIncidentRoomInput, deterministic: IncidentRoomDecision): string {
  return JSON.stringify({
    locked: {
      posture: deterministic.posture,
      severity: deterministic.severity,
      consensus: deterministic.consensus.map((item) => ({
        id: item.id,
        status: item.status,
        evidenceRef: item.evidenceRef,
      })),
      handoffs: deterministic.handoffs.map((handoff) => ({
        id: handoff.id,
        status: handoff.status,
        evidenceRef: handoff.evidenceRef,
      })),
      evidenceTimeline: deterministic.evidenceTimeline.map((step) => ({
        id: step.id,
        status: step.status,
        evidenceRef: step.evidenceRef,
      })),
    },
    risk: {
      score: input.riskReport.overallScore,
      level: input.riskReport.overallLevel,
      signals: input.riskReport.signals.slice(0, 5).map((signal) => ({
        id: signal.id,
        title: signal.title,
        level: signal.level,
        summary: signal.summary,
      })),
    },
    recommendation: {
      type: input.recommendation.type,
      title: input.recommendation.title,
      summary: input.recommendation.summary,
      deepbookAction: input.recommendation.deepbookAction,
      prepareOnlyReason: input.recommendation.prepareOnlyReason,
      fallback: input.recommendation.fallback,
    },
    policy: {
      ok: input.policyCheck.ok,
      errors: input.policyCheck.errors,
      maxBudgetUsd: input.policy.maxBudgetUsd,
      allowedAssets: input.policy.allowedAssets,
      allowedMarkets: input.policy.allowedMarkets,
      requireManualApproval: input.policy.requireManualApproval,
    },
    policyObject: input.policyObject,
    deepbookMarketEvidence: input.deepbookMarketEvidence,
    monitorRules: input.monitorRules.map((rule) => ({
      label: rule.label,
      severity: rule.severity,
      enabled: rule.enabled,
      action: rule.recommendedAction.kind,
    })),
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
    deterministicTasks: deterministic.tasks.map((task) => ({
      id: task.id,
      objective: task.objective,
      status: task.status,
      findings: task.findings,
      handoff: task.handoff,
      locked: task.locked,
    })),
  });
}

function mergeAiDraft(
  deterministic: IncidentRoomDecision,
  draft: AiIncidentDraft,
  model: string,
  provider: IncidentRoomDecision['mode'],
): IncidentRoomDecision {
  const draftById = new Map(draft.tasks.map((task) => [task.id, task]));

  return {
    ...deterministic,
    mode: provider,
    model,
    warning: undefined,
    managerBriefing: draft.managerBriefing,
    finalCommand: deterministic.finalCommand,
    tasks: deterministic.tasks.map((task) => {
      const aiTask = draftById.get(task.id);

      if (!aiTask) {
        return task;
      }

      return {
        ...task,
        findings: aiTask.findings && aiTask.findings.length > 0 ? aiTask.findings.slice(0, 4) : task.findings,
        handoff: task.handoff,
      };
    }),
  };
}

async function createAiIncidentDraft(input: BuildIncidentRoomInput, deterministic: IncidentRoomDecision) {
  const config = getAiProviderConfig();

  if (!config.apiKey) {
    throw new Error(missingAiProviderMessage(config));
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  const apiMode = config.apiMode;
  const instructions = buildIncidentInstructions(deterministic);
  const payload = buildIncidentPayload(input, deterministic);

  if (apiMode === 'responses') {
    const response = await client.responses.create({
      model: config.model,
      instructions,
      input: payload,
      max_output_tokens: 1400,
      store: false,
      reasoning: config.reasoningEffort ? { effort: config.reasoningEffort } : undefined,
    });

    return {
      model: config.model,
      parsed: AiIncidentDraftSchema.parse(extractJsonObject(response.output_text ?? '')),
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
    parsed: AiIncidentDraftSchema.parse(extractJsonObject(content)),
  };
}

export async function buildAiIncidentRoomDecision(
  input: BuildIncidentRoomInput,
): Promise<IncidentRoomDecision> {
  const deterministic = buildIncidentRoomDecision(input);

  const config = getAiProviderConfig();

  if (!config.apiKey) {
    return {
      ...deterministic,
      warning: `AI incident room fallback used: ${missingAiProviderMessage(config)}`,
    };
  }

  try {
    const draft = await createAiIncidentDraft(input, deterministic);
    return mergeAiDraft(deterministic, draft.parsed, draft.model, getAiProviderConfig().provider);
  } catch (error) {
    return {
      ...deterministic,
      warning: sanitizeWarning(error),
    };
  }
}
