'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';
import Link from 'next/link';

import { AppShell, type DemoSection } from './app-shell';
import { AgentCouncilPanel } from './agent-council-panel';
import { AuditLogPanel } from './audit-log-panel';
import { AuditPackageExplorer } from './audit-package-explorer';
import { DemoFlowPanel } from './demo-flow-panel';
import { EvidenceTimeline } from './evidence-timeline';
import { IncidentRoomPanel } from './incident-room-panel';
import { PortfolioOverview } from './portfolio-overview';
import { PolicyReview } from './policy-review';
import { ResultPanel } from './result-panel';
import { ReceiptMintPanel } from './receipt-mint-panel';
import { RiskBreakdown } from './risk-breakdown';
import { RiskScoreCard } from './risk-score-card';
import { ScenarioSelector } from './scenario-selector';
import { StrategyPanel } from './strategy-panel';
import { MonitorPanel } from './monitor-panel';
import { VisualMotifPanel } from './visual-motif-panel';
import { WalletConnectButton } from './wallet-connect';
import { WalletSourcePanel } from './wallet-source-panel';
import { WhatIfSimulatorPanel } from './what-if-simulator-panel';
import { WhatIfStrategyDiff } from './what-if-strategy-diff';

import { buildMockExplanation } from '@/lib/ai/explain';
import { buildAgentCouncilDecision, type AgentCouncilDecision } from '@/lib/agents/decision-council';
import { buildIncidentRoomDecision, type IncidentRoomDecision } from '@/lib/agents/incident-room';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  DEMO_SCENARIOS,
  createDemoPortfolio,
  type DemoScenarioId,
} from '@/lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '@/lib/risk/risk-engine';
import { buildWhatIfSimulation } from '@/lib/risk/what-if-engine';
import {
  DEFAULT_WHAT_IF_SCENARIO_ID,
  type WhatIfScenarioId,
} from '@/lib/risk/what-if-scenarios';
import { MAINNET_RPC_URL } from '@/lib/sui/client';
import {
  buildWalletAssetsPortfolio,
  readMainnetWalletAssets,
  readMainnetWalletScan,
} from '@/lib/sui/portfolio';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildMonitorRules, type MonitorRule } from '@/lib/strategy/monitor';
import {
  buildStrategyRecommendation,
  type DeepBookPredictSettings,
} from '@/lib/strategy/strategy-builder';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { createAuditPackage, createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';
import { formatAddress, formatUsd } from '@/lib/utils/format';
import type { AssetBalance, WalletScanSummary } from '@/lib/risk/types';
import {
  buildDeepBookLiveTradePlan,
  buildDeepBookLiveTransaction,
  buildLiveDeepBookFailureWarning,
  getDeepBookLiveGate,
  type DeepBookLiveMarketSnapshot,
} from '@/lib/sui/deepbook-live';
import { prepareDeepBookTransaction, simulateDeepBookAction } from '@/lib/sui/deepbook';

type ExplanationStatus = 'idle' | 'ready' | 'loading' | 'fallback';
type SelectedExecutionMode = 'simulation' | 'prepare_mainnet' | 'mainnet';
const ARCHIVE_AI_TIMEOUT_MS = 4500;

function selectedModeLabel(mode: SelectedExecutionMode) {
  if (mode === 'prepare_mainnet') {
    return 'Prepare mainnet';
  }

  if (mode === 'mainnet') {
    return 'Live mainnet';
  }

  return 'Local simulation';
}

function formatTradeAmount(value: number, asset: string): string {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: asset === 'USDC' ? 2 : 6,
  })} ${asset}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function archivePaymentLabel(storage: AuditStorageResult | null): string {
  return storage?.paymentLabel ?? 'Connected wallet required';
}

function archiveSignerLabel(storage: AuditStorageResult | null): string {
  return storage?.signerLabel ?? 'Connected wallet required';
}

type RiskPilotAppProps = {
  initialJudgeDemo?: boolean;
  initialSection?: DemoSection;
};

export function RiskPilotApp({ initialJudgeDemo = false, initialSection = 'overview' }: RiskPilotAppProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const signAndExecute = useSignAndExecuteTransaction<SuiTransactionBlockResponse>({
    execute: ({ bytes, signature }) =>
      client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      }),
  });

  const walletAddress = account?.address ?? '0xDEMO';
  const connectionStatus = account ? `Connected ${formatAddress(account.address)}` : 'Demo mode';
  const sourceLabel = account ? 'mainnet wallet' : 'judge scenario';

  const [walletAssets, setWalletAssets] = useState<AssetBalance[] | null>(null);
  const [walletScan, setWalletScan] = useState<WalletScanSummary | null>(null);
  const [walletWarning, setWalletWarning] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [explanationMode, setExplanationMode] = useState<'mock' | 'openai'>('mock');
  const [explanationStatus, setExplanationStatus] = useState<ExplanationStatus>('idle');
  const [executeWarning, setExecuteWarning] = useState<string>('');
  const [executionBusy, setExecutionBusy] = useState(false);
  const [auditPackage, setAuditPackage] = useState<AuditPackage | null>(null);
  const [auditStorage, setAuditStorage] = useState<AuditStorageResult | null>(null);
  const [executionMode, setExecutionMode] = useState('pending');
  const [executionStatus, setExecutionStatus] = useState('awaiting approval');
  const [walletArchiveStatus, setWalletArchiveStatus] = useState('');
  const [aiAgentCouncil, setAiAgentCouncil] = useState<AgentCouncilDecision | null>(null);
  const [, setAgentCouncilStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [, setAiIncidentRoom] = useState<IncidentRoomDecision | null>(null);
  const [, setIncidentRoomStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [aiWhatIfAgentCouncil, setAiWhatIfAgentCouncil] = useState<AgentCouncilDecision | null>(null);
  const [whatIfAgentCouncilStatus, setWhatIfAgentCouncilStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [aiWhatIfIncidentRoom, setAiWhatIfIncidentRoom] = useState<IncidentRoomDecision | null>(null);
  const [whatIfIncidentRoomStatus, setWhatIfIncidentRoomStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [selectedExecutionMode, setSelectedExecutionMode] = useState<SelectedExecutionMode>('prepare_mainnet');
  const [deepbookMarketSnapshot, setDeepbookMarketSnapshot] = useState<DeepBookLiveMarketSnapshot | null>(null);
  const [deepbookMarketStatus, setDeepbookMarketStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deepbookMarketError, setDeepbookMarketError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<DemoScenarioId>(
    initialJudgeDemo ? 'leveraged_lending_user' : DEFAULT_DEMO_SCENARIO_ID,
  );
  const [selectedWhatIfScenarioId, setSelectedWhatIfScenarioId] = useState<WhatIfScenarioId>(
    initialJudgeDemo ? 'sui_drawdown_15' : DEFAULT_WHAT_IF_SCENARIO_ID,
  );
  const [activeSection, setActiveSection] = useState<DemoSection>(initialSection);
  const [judgeDemoActive, setJudgeDemoActive] = useState(initialJudgeDemo);
  const [monitorRuleEnabledOverrides, setMonitorRuleEnabledOverrides] = useState<Record<string, boolean>>({});
  const defaultBudgetCap = Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_BUDGET_USD ?? 5);
  const receiptPackageId = process.env.NEXT_PUBLIC_RECEIPT_PACKAGE_ID?.trim() ?? '';
  const liveDeepBookFeatureEnabled = (process.env.NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL ?? 'true').toLowerCase() !== 'false';
  const [predictSettings, setPredictSettings] = useState<DeepBookPredictSettings>({
    thresholdPct: -10,
    expiryDays: 7,
    budgetUsd: Number.isFinite(defaultBudgetCap) ? defaultBudgetCap : 5,
  });
  const policyRef = useRef<ExecutionPolicy | null>(null);

  const portfolio = useMemo(() => {
    const demoPortfolio = createDemoPortfolio(walletAddress, {
      scenarioId: selectedScenarioId,
    });
    const mergedPortfolio = account ? buildWalletAssetsPortfolio(demoPortfolio, walletAssets ?? []) : demoPortfolio;

    return account && walletScan
      ? {
          ...mergedPortfolio,
          walletScan,
        }
      : mergedPortfolio;
  }, [account, selectedScenarioId, walletAddress, walletAssets, walletScan]);

  const riskReport = useMemo(() => calculateRiskReport(portfolio), [portfolio]);
  const whatIfSimulation = useMemo(
    () => buildWhatIfSimulation(portfolio, selectedWhatIfScenarioId),
    [portfolio, selectedWhatIfScenarioId],
  );

  const recommendation = useMemo(
    () =>
      buildStrategyRecommendation(
        riskReport,
        portfolio,
        { maxBudgetUsd: defaultBudgetCap },
        {
          defaultBudgetUsd: defaultBudgetCap,
          allowDeepBookPredict: true,
          predictSettings,
        },
      ),
    [defaultBudgetCap, portfolio, predictSettings, riskReport],
  );
  const whatIfRecommendation = useMemo(
    () =>
      buildStrategyRecommendation(
        whatIfSimulation.simulatedRiskReport,
        whatIfSimulation.simulatedPortfolio,
        { maxBudgetUsd: defaultBudgetCap },
        {
          defaultBudgetUsd: defaultBudgetCap,
          allowDeepBookPredict: !account,
          predictSettings,
        },
      ),
    [account, defaultBudgetCap, predictSettings, whatIfSimulation],
  );

  const estimatedAfterRisk = useMemo(
    () => estimatePostStrategyRisk(riskReport, recommendation.expectedRiskReduction),
    [recommendation.expectedRiskReduction, riskReport],
  );

  const [policy, setPolicy] = useState<ExecutionPolicy>(() => createDefaultPolicy(recommendation));
  const [policyTouched, setPolicyTouched] = useState(false);
  const effectivePolicy = useMemo(
    () => (policyTouched ? policy : createDefaultPolicy(recommendation)),
    [policy, policyTouched, recommendation],
  );
  const whatIfPolicy = useMemo(() => {
    const basePolicy = createDefaultPolicy(whatIfRecommendation);

    if (!whatIfSimulation.policyOverride) {
      return basePolicy;
    }

    return {
      ...basePolicy,
      maxBudgetUsd: Math.max(0, basePolicy.maxBudgetUsd * (whatIfSimulation.policyOverride.maxBudgetMultiplier ?? 1)),
      maxSingleTradeUsd: Math.max(
        0,
        basePolicy.maxSingleTradeUsd * (whatIfSimulation.policyOverride.maxSingleTradeMultiplier ?? 1),
      ),
    };
  }, [whatIfRecommendation, whatIfSimulation.policyOverride]);

  useEffect(() => {
    policyRef.current = effectivePolicy;
  }, [effectivePolicy]);

  const resetAiPreviewState = useCallback(() => {
    setAiAgentCouncil(null);
    setAgentCouncilStatus('idle');
    setAiIncidentRoom(null);
    setIncidentRoomStatus('idle');
    setAiWhatIfAgentCouncil(null);
    setWhatIfAgentCouncilStatus('idle');
    setAiWhatIfIncidentRoom(null);
    setWhatIfIncidentRoomStatus('idle');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPortfolioAssets() {
      const accountAddress = account?.address;

      if (!accountAddress) {
        setWalletAssets(null);
        setWalletScan(null);
        setWalletWarning(null);
        setAuditPackage(null);
        setAuditStorage(null);
        resetAiPreviewState();
        setExecutionMode('pending');
        setExecutionStatus('awaiting approval');
        return;
      }

      try {
        setWalletWarning(null);
        setWalletAssets(null);
        setWalletScan(null);
        const [assetsResult, scanResult] = await Promise.allSettled([
          readMainnetWalletAssets(accountAddress, client),
          readMainnetWalletScan(accountAddress, client),
        ]);

        if (!cancelled) {
          const warnings: string[] = [];

          if (assetsResult.status === 'fulfilled') {
            setWalletAssets(assetsResult.value);
          } else {
            setWalletAssets(null);
            warnings.push(
              assetsResult.reason instanceof Error
                ? `Mainnet balance read failed: ${assetsResult.reason.message}.`
                : 'Mainnet balance read failed.',
            );
          }

          if (scanResult.status === 'fulfilled') {
            setWalletScan(scanResult.value);
          } else {
            setWalletScan(null);
            warnings.push(
              scanResult.reason instanceof Error
                ? `Mainnet object scan failed: ${scanResult.reason.message}.`
                : 'Mainnet object scan failed.',
            );
          }

          setWalletWarning(
            warnings.length > 0 ? `${warnings.join(' ')} Wallet data may be partial.` : null,
          );
          setAuditPackage(null);
          setAuditStorage(null);
          resetAiPreviewState();
          setExecutionMode('pending');
          setExecutionStatus('awaiting approval');
        }
      } catch (error) {
        if (!cancelled) {
          setWalletAssets(null);
          setWalletScan(null);
          setWalletWarning(
            error instanceof Error
              ? `Mainnet wallet read failed: ${error.message}. Wallet data may be partial.`
              : 'Mainnet wallet read failed. Wallet data may be partial.',
          );
        }
      }
    }

    void loadPortfolioAssets();

    return () => {
      cancelled = true;
    };
  }, [account, client, resetAiPreviewState]);

  const policyCheck = useMemo(
    () => validateExecutionPolicy(effectivePolicy, recommendation, new Date()),
    [effectivePolicy, recommendation],
  );
  const whatIfPolicyCheck = useMemo(
    () => validateExecutionPolicy(whatIfPolicy, whatIfRecommendation, new Date()),
    [whatIfPolicy, whatIfRecommendation],
  );

  const defaultMonitorRules = useMemo(
    () =>
      buildMonitorRules({
        portfolio,
        riskReport,
        recommendation,
        policy: effectivePolicy,
        policyCheck,
        walletScan: portfolio.walletScan ?? walletScan,
        deepbookMarketStatus,
        deepbookMarketError,
      }),
    [
      deepbookMarketError,
      deepbookMarketStatus,
      effectivePolicy,
      policyCheck,
      portfolio,
      recommendation,
      riskReport,
      walletScan,
    ],
  );

  const monitorRules = useMemo<MonitorRule[]>(
    () =>
      defaultMonitorRules.map((rule) => ({
        ...rule,
        enabled: monitorRuleEnabledOverrides[rule.id] ?? rule.enabled,
      })),
    [defaultMonitorRules, monitorRuleEnabledOverrides],
  );

  const liveTradePlan = useMemo(
    () =>
      deepbookMarketSnapshot
        ? buildDeepBookLiveTradePlan(recommendation, deepbookMarketSnapshot)
        : null,
    [deepbookMarketSnapshot, recommendation],
  );
  const liveDeepBookGate = useMemo(
    () =>
      getDeepBookLiveGate({
        accountAddress: account?.address,
        recommendation,
        policyOk: policyCheck.ok,
        selectedExecutionMode,
        marketSnapshot: deepbookMarketSnapshot,
        marketStatus: deepbookMarketStatus,
        featureEnabled: liveDeepBookFeatureEnabled,
      }),
    [
      account?.address,
      deepbookMarketSnapshot,
      deepbookMarketStatus,
      liveDeepBookFeatureEnabled,
      policyCheck.ok,
      recommendation,
      selectedExecutionMode,
    ],
  );
  const liveDeepBookEligible = liveDeepBookGate.eligible;
  const effectiveSelectedExecutionMode =
    selectedExecutionMode === 'mainnet' && !liveDeepBookEligible ? 'prepare_mainnet' : selectedExecutionMode;

  const deepbookMarketEvidencePreview = useMemo(
    () =>
      createDeepBookMarketEvidence({
        snapshot: deepbookMarketSnapshot,
        walletAddress: account?.address ?? '0x2',
        poolKey: 'SUI_USDC',
        routeStatus: deepbookMarketStatus,
        error: deepbookMarketError,
      }),
    [account?.address, deepbookMarketError, deepbookMarketSnapshot, deepbookMarketStatus],
  );
  const whatIfDeepbookMarketEvidencePreview = useMemo(() => {
    const override = whatIfSimulation.marketOverride;

    if (override?.deepbookStatus === 'unavailable') {
      return createDeepBookMarketEvidence({
        snapshot: null,
        walletAddress: account?.address ?? '0x2',
        poolKey: 'SUI_USDC',
        routeStatus: override.routeStatus ?? 'error',
        error: override.fallbackReason ?? 'What-if DeepBook evidence unavailable.',
      });
    }

    return {
      ...deepbookMarketEvidencePreview,
      routeStatus: override?.routeStatus ?? deepbookMarketEvidencePreview.routeStatus,
      fallbackReason: override?.fallbackReason ?? deepbookMarketEvidencePreview.fallbackReason,
    };
  }, [account?.address, deepbookMarketEvidencePreview, whatIfSimulation.marketOverride]);

  const deterministicAgentCouncilDecision = useMemo(
    () =>
      buildAgentCouncilDecision({
        riskReport,
        recommendation,
        policy: effectivePolicy,
        policyCheck,
        monitorRules,
        deepbookMarketEvidence: auditPackage?.deepbookMarketEvidence ?? deepbookMarketEvidencePreview,
        explanationMode,
        walletConnected: Boolean(account),
        auditArchived: Boolean(auditPackage && auditStorage),
        receiptEnabled: Boolean(receiptPackageId),
        liveGate: liveDeepBookGate,
      }),
    [
      account,
      auditPackage,
      auditStorage,
      deepbookMarketEvidencePreview,
      effectivePolicy,
      explanationMode,
      liveDeepBookGate,
      monitorRules,
      policyCheck,
      receiptPackageId,
      recommendation,
      riskReport,
    ],
  );
  const agentCouncilDecision = aiAgentCouncil ?? deterministicAgentCouncilDecision;

  const deterministicIncidentRoomDecision = useMemo(
    () =>
      buildIncidentRoomDecision({
        riskReport,
        recommendation,
        policy: effectivePolicy,
        policyCheck,
        monitorRules,
        deepbookMarketEvidence: auditPackage?.deepbookMarketEvidence ?? deepbookMarketEvidencePreview,
        explanationMode,
        walletConnected: Boolean(account),
        auditArchived: Boolean(auditPackage && auditStorage),
        receiptEnabled: Boolean(receiptPackageId),
        liveGate: liveDeepBookGate,
        agentCouncil: agentCouncilDecision,
      }),
    [
      account,
      agentCouncilDecision,
      auditPackage,
      auditStorage,
      deepbookMarketEvidencePreview,
      effectivePolicy,
      explanationMode,
      liveDeepBookGate,
      monitorRules,
      policyCheck,
      receiptPackageId,
      recommendation,
      riskReport,
    ],
  );
  const whatIfAgentCouncilDecision = useMemo(
    () =>
      buildAgentCouncilDecision({
        riskReport: whatIfSimulation.simulatedRiskReport,
        recommendation: whatIfRecommendation,
        policy: whatIfPolicy,
        policyCheck: whatIfPolicyCheck,
        monitorRules,
        deepbookMarketEvidence: whatIfDeepbookMarketEvidencePreview,
        explanationMode,
        walletConnected: Boolean(account),
        auditArchived: false,
        receiptEnabled: Boolean(receiptPackageId),
        liveGate: {
          ...liveDeepBookGate,
          canSubmitLive: false,
          eligible: false,
          reasons: ['What-if preview does not authorize live submission.', ...liveDeepBookGate.reasons],
        },
      }),
    [
      account,
      explanationMode,
      liveDeepBookGate,
      monitorRules,
      receiptPackageId,
      whatIfDeepbookMarketEvidencePreview,
      whatIfPolicy,
      whatIfPolicyCheck,
      whatIfRecommendation,
      whatIfSimulation.simulatedRiskReport,
    ],
  );
  const activeWhatIfAgentCouncilDecision = aiWhatIfAgentCouncil ?? whatIfAgentCouncilDecision;
  const whatIfIncidentRoomDecision = useMemo(
    () =>
      buildIncidentRoomDecision({
        riskReport: whatIfSimulation.simulatedRiskReport,
        recommendation: whatIfRecommendation,
        policy: whatIfPolicy,
        policyCheck: whatIfPolicyCheck,
        monitorRules,
        deepbookMarketEvidence: whatIfDeepbookMarketEvidencePreview,
        explanationMode,
        walletConnected: Boolean(account),
        auditArchived: false,
        receiptEnabled: Boolean(receiptPackageId),
        liveGate: {
          ...liveDeepBookGate,
          canSubmitLive: false,
          eligible: false,
          reasons: ['What-if preview does not authorize live submission.', ...liveDeepBookGate.reasons],
        },
        agentCouncil: whatIfAgentCouncilDecision,
      }),
    [
      account,
      explanationMode,
      liveDeepBookGate,
      monitorRules,
      receiptPackageId,
      whatIfAgentCouncilDecision,
      whatIfDeepbookMarketEvidencePreview,
      whatIfPolicy,
      whatIfPolicyCheck,
      whatIfRecommendation,
      whatIfSimulation.simulatedRiskReport,
    ],
  );
  const activeWhatIfIncidentRoomDecision = aiWhatIfIncidentRoom ?? whatIfIncidentRoomDecision;

  const buildAgentCouncilRequest = useCallback(
    (input?: { deepbookMarketEvidence?: typeof deepbookMarketEvidencePreview; auditArchived?: boolean }) => ({
      riskReport,
      recommendation,
      policy: effectivePolicy,
      policyCheck,
      monitorRules,
      deepbookMarketEvidence: input?.deepbookMarketEvidence ?? deepbookMarketEvidencePreview,
      explanationMode,
      walletConnected: Boolean(account),
      auditArchived: input?.auditArchived ?? Boolean(auditPackage && auditStorage),
      receiptEnabled: Boolean(receiptPackageId),
      liveGate: liveDeepBookGate,
    }),
    [
      account,
      auditPackage,
      auditStorage,
      deepbookMarketEvidencePreview,
      effectivePolicy,
      explanationMode,
      liveDeepBookGate,
      monitorRules,
      policyCheck,
      receiptPackageId,
      recommendation,
      riskReport,
    ],
  );

  const refreshAgentCouncil = useCallback(
    async (input?: {
      deepbookMarketEvidence?: typeof deepbookMarketEvidencePreview;
      auditArchived?: boolean;
      fallback?: AgentCouncilDecision;
    }) => {
      const fallbackDecision = input?.fallback ?? deterministicAgentCouncilDecision;
      setAgentCouncilStatus('loading');

      try {
        const response = await withTimeout(
          fetch('/api/agent-council', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(buildAgentCouncilRequest(input)),
          }),
          ARCHIVE_AI_TIMEOUT_MS,
          'Agent council',
        );

        if (!response.ok) {
          throw new Error(`Agent council endpoint returned ${response.status}`);
        }

        const payload = (await response.json()) as { decision: AgentCouncilDecision };
        setAiAgentCouncil(payload.decision);
        setAgentCouncilStatus(payload.decision.mode === 'openai' ? 'ready' : 'fallback');
        return payload.decision;
      } catch (error) {
        const warning = error instanceof Error ? error.message : 'AI council unavailable.';
        const nextFallback = {
          ...fallbackDecision,
          warning: `AI council fallback used: ${warning}`,
        };
        setAiAgentCouncil(nextFallback);
        setAgentCouncilStatus('fallback');
        return nextFallback;
      }
    },
    [buildAgentCouncilRequest, deterministicAgentCouncilDecision],
  );

  const buildIncidentRoomRequest = useCallback(
    (input?: {
      deepbookMarketEvidence?: typeof deepbookMarketEvidencePreview;
      auditArchived?: boolean;
      agentCouncil?: AgentCouncilDecision;
    }) => ({
      riskReport,
      recommendation,
      policy: effectivePolicy,
      policyCheck,
      monitorRules,
      deepbookMarketEvidence: input?.deepbookMarketEvidence ?? deepbookMarketEvidencePreview,
      explanationMode,
      walletConnected: Boolean(account),
      auditArchived: input?.auditArchived ?? Boolean(auditPackage && auditStorage),
      receiptEnabled: Boolean(receiptPackageId),
      liveGate: liveDeepBookGate,
      agentCouncil: input?.agentCouncil ?? agentCouncilDecision,
    }),
    [
      account,
      agentCouncilDecision,
      auditPackage,
      auditStorage,
      deepbookMarketEvidencePreview,
      effectivePolicy,
      explanationMode,
      liveDeepBookGate,
      monitorRules,
      policyCheck,
      receiptPackageId,
      recommendation,
      riskReport,
    ],
  );

  const refreshIncidentRoom = useCallback(
    async (input?: {
      deepbookMarketEvidence?: typeof deepbookMarketEvidencePreview;
      auditArchived?: boolean;
      agentCouncil?: AgentCouncilDecision;
      fallback?: IncidentRoomDecision;
    }) => {
      const fallbackDecision = input?.fallback ?? deterministicIncidentRoomDecision;
      setIncidentRoomStatus('loading');

      try {
        const response = await withTimeout(
          fetch('/api/incident-room', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(buildIncidentRoomRequest(input)),
          }),
          ARCHIVE_AI_TIMEOUT_MS,
          'Incident room',
        );

        if (!response.ok) {
          throw new Error(`Incident room endpoint returned ${response.status}`);
        }

        const payload = (await response.json()) as { incidentRoom: IncidentRoomDecision };
        setAiIncidentRoom(payload.incidentRoom);
        setIncidentRoomStatus(payload.incidentRoom.mode === 'openai' ? 'ready' : 'fallback');
        return payload.incidentRoom;
      } catch (error) {
        const warning = error instanceof Error ? error.message : 'AI incident room unavailable.';
        const nextFallback = {
          ...fallbackDecision,
          warning: `AI incident room fallback used: ${warning}`,
        };
        setAiIncidentRoom(nextFallback);
        setIncidentRoomStatus('fallback');
        return nextFallback;
      }
    },
    [buildIncidentRoomRequest, deterministicIncidentRoomDecision],
  );

  const whatIfLiveGate = useMemo(
    () => ({
      ...liveDeepBookGate,
      canSubmitLive: false,
      eligible: false,
      reasons: ['What-if preview does not authorize live submission.', ...liveDeepBookGate.reasons],
    }),
    [liveDeepBookGate],
  );

  const buildWhatIfAgentCouncilRequest = useCallback(
    () => ({
      riskReport: whatIfSimulation.simulatedRiskReport,
      recommendation: whatIfRecommendation,
      policy: whatIfPolicy,
      policyCheck: whatIfPolicyCheck,
      monitorRules,
      deepbookMarketEvidence: whatIfDeepbookMarketEvidencePreview,
      explanationMode,
      walletConnected: Boolean(account),
      auditArchived: false,
      receiptEnabled: Boolean(receiptPackageId),
      liveGate: whatIfLiveGate,
    }),
    [
      account,
      explanationMode,
      monitorRules,
      receiptPackageId,
      whatIfDeepbookMarketEvidencePreview,
      whatIfLiveGate,
      whatIfPolicy,
      whatIfPolicyCheck,
      whatIfRecommendation,
      whatIfSimulation.simulatedRiskReport,
    ],
  );

  const refreshWhatIfAgentCouncil = useCallback(async () => {
    setWhatIfAgentCouncilStatus('loading');

    try {
      const response = await fetch('/api/agent-council', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildWhatIfAgentCouncilRequest()),
      });

      if (!response.ok) {
        throw new Error(`Agent council endpoint returned ${response.status}`);
      }

      const payload = (await response.json()) as { decision: AgentCouncilDecision };
      setAiWhatIfAgentCouncil(payload.decision);
      setWhatIfAgentCouncilStatus(payload.decision.mode === 'openai' ? 'ready' : 'fallback');
      return payload.decision;
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'AI council unavailable.';
      const nextFallback = {
        ...whatIfAgentCouncilDecision,
        warning: `AI council fallback used: ${warning}`,
      };
      setAiWhatIfAgentCouncil(nextFallback);
      setWhatIfAgentCouncilStatus('fallback');
      return nextFallback;
    }
  }, [buildWhatIfAgentCouncilRequest, whatIfAgentCouncilDecision]);

  const buildWhatIfIncidentRoomRequest = useCallback(
    (agentCouncil: AgentCouncilDecision) => ({
      riskReport: whatIfSimulation.simulatedRiskReport,
      recommendation: whatIfRecommendation,
      policy: whatIfPolicy,
      policyCheck: whatIfPolicyCheck,
      monitorRules,
      deepbookMarketEvidence: whatIfDeepbookMarketEvidencePreview,
      explanationMode,
      walletConnected: Boolean(account),
      auditArchived: false,
      receiptEnabled: Boolean(receiptPackageId),
      liveGate: whatIfLiveGate,
      agentCouncil,
    }),
    [
      account,
      explanationMode,
      monitorRules,
      receiptPackageId,
      whatIfDeepbookMarketEvidencePreview,
      whatIfLiveGate,
      whatIfPolicy,
      whatIfPolicyCheck,
      whatIfRecommendation,
      whatIfSimulation.simulatedRiskReport,
    ],
  );

  const refreshWhatIfIncidentRoom = useCallback(async () => {
    setWhatIfIncidentRoomStatus('loading');

    try {
      const refreshedCouncil = await refreshWhatIfAgentCouncil();
      const response = await fetch('/api/incident-room', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildWhatIfIncidentRoomRequest(refreshedCouncil)),
      });

      if (!response.ok) {
        throw new Error(`Incident room endpoint returned ${response.status}`);
      }

      const payload = (await response.json()) as { incidentRoom: IncidentRoomDecision };
      setAiWhatIfIncidentRoom(payload.incidentRoom);
      setWhatIfIncidentRoomStatus(payload.incidentRoom.mode === 'openai' ? 'ready' : 'fallback');
      return payload.incidentRoom;
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'AI incident room unavailable.';
      const nextFallback = {
        ...whatIfIncidentRoomDecision,
        warning: `AI incident room fallback used: ${warning}`,
      };
      setAiWhatIfIncidentRoom(nextFallback);
      setWhatIfIncidentRoomStatus('fallback');
      return nextFallback;
    }
  }, [buildWhatIfIncidentRoomRequest, refreshWhatIfAgentCouncil, whatIfIncidentRoomDecision]);

  const loadDeepBookMarketSnapshot = useCallback(async () => {
    const snapshotWalletAddress = account?.address ?? '0x2';
    const response = await fetch(
      `/api/deepbook-market?poolKey=SUI_USDC&walletAddress=${encodeURIComponent(snapshotWalletAddress)}`,
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `DeepBook market lookup failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      snapshot: DeepBookLiveMarketSnapshot;
    };

    return payload.snapshot;
  }, [account?.address]);

  useEffect(() => {
    let cancelled = false;

    async function refreshMarketSnapshot() {
      setDeepbookMarketStatus('loading');
      setDeepbookMarketError(null);

      try {
        const snapshot = await loadDeepBookMarketSnapshot();

        if (!cancelled) {
          setDeepbookMarketSnapshot(snapshot);
          setDeepbookMarketStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setDeepbookMarketSnapshot(null);
          setDeepbookMarketStatus('error');
          setDeepbookMarketError(
            error instanceof Error
              ? `Live DeepBook market data unavailable: ${error.message}`
              : 'Live DeepBook market data unavailable.',
          );
        }
      }
    }

    void refreshMarketSnapshot();

    return () => {
      cancelled = true;
    };
  }, [loadDeepBookMarketSnapshot, recommendation.deepbookAction.market]);

  const refreshExplanation = useCallback(
    async (currentPolicy: ExecutionPolicy) => {
      setExplanationStatus('loading');

      try {
        const response = await withTimeout(
          fetch('/api/explain', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              portfolioSnapshot: portfolio,
              riskReport,
              recommendation,
              policy: currentPolicy,
            }),
          }),
          ARCHIVE_AI_TIMEOUT_MS,
          'Explanation',
        );

        if (!response.ok) {
          throw new Error(`Explain endpoint returned ${response.status}`);
        }

        const payload = (await response.json()) as {
          explanation: string;
          mode: 'mock' | 'openai';
        };

        setExplanation(payload.explanation);
        setExplanationMode(payload.mode);
        setExplanationStatus('ready');
        return payload.explanation;
      } catch (error) {
        const fallback = buildMockExplanation(portfolio, riskReport, recommendation, currentPolicy);
        setExplanation(fallback);
        setExplanationMode('mock');
        setExplanationStatus('fallback');
        setWalletWarning(
          error instanceof Error ? `Explanation fallback used: ${error.message}` : 'Explanation fallback used.',
        );
        return fallback;
      }
    },
    [portfolio, recommendation, riskReport],
  );

  useEffect(() => {
    void refreshExplanation(policyRef.current as ExecutionPolicy);
  }, [refreshExplanation]);

  const handlePolicyChange = useCallback(
    (nextPolicy: ExecutionPolicy) => {
      setPolicy(nextPolicy);
      setPolicyTouched(true);
      setAuditPackage(null);
      setAuditStorage(null);
      resetAiPreviewState();
      setExecutionMode('pending');
      setExecutionStatus('awaiting approval');
      setExecuteWarning('');
    },
    [resetAiPreviewState, setPolicy],
  );

  const handlePredictSettingsChange = useCallback((nextSettings: DeepBookPredictSettings) => {
    setPredictSettings(nextSettings);
    setAuditPackage(null);
    setAuditStorage(null);
    resetAiPreviewState();
    setExecutionMode('pending');
    setExecutionStatus('awaiting approval');
    setExecuteWarning('');
    setWalletArchiveStatus('');
  }, [resetAiPreviewState]);

  const handleScenarioChange = useCallback((scenarioId: DemoScenarioId) => {
    setSelectedScenarioId(scenarioId);
    setPolicyTouched(false);
    setAuditPackage(null);
    setAuditStorage(null);
    resetAiPreviewState();
    setExecutionMode('pending');
    setExecutionStatus('awaiting approval');
    setExecuteWarning('');
  }, [resetAiPreviewState]);

  const startJudgeDemo = useCallback(() => {
    setJudgeDemoActive(true);
    setSelectedScenarioId('leveraged_lending_user');
    setSelectedWhatIfScenarioId('sui_drawdown_15');
    setPolicyTouched(false);
    setAuditPackage(null);
    setAuditStorage(null);
    resetAiPreviewState();
    setExecutionMode('pending');
    setExecutionStatus('awaiting approval');
    setExecuteWarning('');
    setActiveSection('risk');

    const url = new URL(window.location.href);
    url.searchParams.set('stage', 'risk');
    url.searchParams.set('demo', 'judge');
    url.hash = 'risk-dashboard';
    window.history.replaceState(null, '', url);
    window.requestAnimationFrame(() => {
      document.getElementById('risk-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [resetAiPreviewState]);

  const exitJudgeDemo = useCallback(() => {
    setJudgeDemoActive(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.history.replaceState(null, '', url);
  }, []);

  const handleWhatIfScenarioChange = useCallback((scenarioId: WhatIfScenarioId) => {
    setSelectedWhatIfScenarioId(scenarioId);
    setAiWhatIfAgentCouncil(null);
    setWhatIfAgentCouncilStatus('idle');
    setAiWhatIfIncidentRoom(null);
    setWhatIfIncidentRoomStatus('idle');
  }, []);

  const handleMonitorRuleToggle = useCallback((ruleId: string, enabled: boolean) => {
    setMonitorRuleEnabledOverrides((current) => ({
      ...current,
      [ruleId]: enabled,
    }));
    setAuditPackage(null);
    setAuditStorage(null);
    resetAiPreviewState();
    setExecutionMode('pending');
    setExecutionStatus('awaiting approval');
    setExecuteWarning('');
  }, [resetAiPreviewState]);

  const prepareAndArchive = useCallback(async () => {
    if (!policyCheck.ok || executionBusy) {
      return;
    }

    setExecutionBusy(true);
    setExecuteWarning('');
    setWalletArchiveStatus('Preparing wallet-paid audit package.');

    try {
      if (!account?.address) {
        throw new Error('Connect a Sui mainnet wallet before preparing and archiving. Paid archive storage must be signed by the connected wallet.');
      }

      const currentPolicy = policyRef.current ?? effectivePolicy;
      const currentExplanation = buildMockExplanation(portfolio, riskReport, recommendation, currentPolicy);
      let auditMarketSnapshot = deepbookMarketSnapshot;
      let execution: AuditPackage['execution'];

      if (effectiveSelectedExecutionMode === 'mainnet' && liveDeepBookEligible) {
        try {
          const marketSnapshot = deepbookMarketSnapshot;

          if (!account?.address || !marketSnapshot) {
            throw new Error('Live DeepBook execution requires a connected wallet and ready market snapshot.');
          }

          auditMarketSnapshot = marketSnapshot;
          const liveExecution = buildDeepBookLiveTransaction(
            account.address,
            recommendation,
            marketSnapshot,
          );
          setWalletArchiveStatus('Waiting for connected wallet to sign live DeepBook transaction.');
          const liveResult = await signAndExecute.mutateAsync({
            transaction: liveExecution.transaction,
            chain: 'sui:mainnet',
          });
          const effectsStatus = liveResult.effects?.status?.status;
          const effectsError = liveResult.effects?.status?.error;
          const liveStatus =
            effectsStatus === 'success'
              ? 'confirmed'
              : effectsStatus === 'failure'
                ? 'failed'
                : 'submitted';

          if (liveStatus === 'failed') {
            setExecuteWarning(
              `Live DeepBook Spot transaction was submitted but failed on Sui mainnet: ${effectsError ?? 'effects status failure'}`,
            );
          }

          execution = {
            mode: 'mainnet',
            status: liveStatus,
            digest: liveResult.digest,
            effectsStatus,
            effectsError,
            error: liveStatus === 'failed' ? effectsError : undefined,
            warning:
              liveStatus === 'failed'
                ? `Submitted real Sui mainnet transaction failed: ${effectsError ?? 'effects status failure'}`
                : undefined,
            preparedTransactionSummary: liveExecution.plan.summary,
            adapter: {
              venue: 'DeepBook mainnet',
              requestedMode: 'mainnet',
              mainnetOnly: true,
            },
            authority: {
              signer: 'connected_wallet',
              payer: 'connected_wallet',
              signerLabel: 'Connected Sui wallet',
              payerLabel: 'Connected Sui wallet',
              walletAddress: account.address,
              note: 'The connected wallet signs and pays this live Sui transaction and then signs the Walrus archive transactions.',
            },
          };
        } catch (liveError) {
          const liveWarning = buildLiveDeepBookFailureWarning(liveError);
          setExecuteWarning(liveWarning);

          const prepareFallback = prepareDeepBookTransaction(
            recommendation.deepbookAction,
            account.address,
            'prepare_mainnet',
          );
          execution = {
            ...prepareFallback,
            warning: [liveWarning, prepareFallback.warning].filter(Boolean).join(' '),
          };
        }
      } else {
        execution =
          effectiveSelectedExecutionMode === 'simulation'
            ? {
                ...simulateDeepBookAction(recommendation.deepbookAction),
                warning:
                  'Local simulation mode selected. No DeepBook transaction is submitted; the connected wallet still pays Walrus archive storage.',
              }
            : prepareDeepBookTransaction(
                recommendation.deepbookAction,
                account.address,
                effectiveSelectedExecutionMode === 'mainnet' ? 'prepare_mainnet' : effectiveSelectedExecutionMode,
              );
      }

      if (execution.warning) {
        setExecuteWarning(execution.warning);
      }

      const deepbookMarketEvidence = createDeepBookMarketEvidence({
        snapshot: auditMarketSnapshot,
        walletAddress: account.address,
        poolKey: 'SUI_USDC',
        routeStatus: deepbookMarketStatus,
        error: deepbookMarketError,
      });
      const finalAgentCouncil = buildAgentCouncilDecision({
        riskReport,
        recommendation,
        policy: currentPolicy,
        policyCheck,
        monitorRules,
        deepbookMarketEvidence,
        explanationMode,
        walletConnected: Boolean(account),
        auditArchived: true,
        receiptEnabled: Boolean(receiptPackageId),
        liveGate: liveDeepBookGate,
      });
      const archivedAgentCouncil = finalAgentCouncil;
      const finalIncidentRoom = buildIncidentRoomDecision({
        riskReport,
        recommendation,
        policy: currentPolicy,
        policyCheck,
        monitorRules,
        deepbookMarketEvidence,
        explanationMode,
        walletConnected: Boolean(account),
        auditArchived: true,
        receiptEnabled: Boolean(receiptPackageId),
        liveGate: liveDeepBookGate,
        agentCouncil: archivedAgentCouncil,
      });
      const archivedIncidentRoom = finalIncidentRoom;

      const auditPayload = createAuditPackage({
        walletAddress: account.address,
        portfolioSnapshot: portfolio,
        riskReportBefore: riskReport,
        recommendation,
        monitorRules,
        deepbookMarketEvidence,
        policy: currentPolicy,
        policyCheck,
        agentCouncil: archivedAgentCouncil,
        incidentRoom: archivedIncidentRoom,
        aiExplanation: currentExplanation,
        execution,
        riskReportAfter: estimatedAfterRisk,
      });

      setAiAgentCouncil(archivedAgentCouncil);
      setAgentCouncilStatus('fallback');
      setAiIncidentRoom(archivedIncidentRoom);
      setIncidentRoomStatus('fallback');
      setWalletArchiveStatus('Loading wallet-paid Walrus archive module.');
      const { storeAuditPackageWithConnectedWallet } = await import('@/lib/walrus/wallet-archive');
      setWalletArchiveStatus('Audit package ready. Opening wallet for Walrus register.');
      const storage = await storeAuditPackageWithConnectedWallet({
        auditPackage: auditPayload,
        walletAddress: account.address,
        signAndExecute: ({ transaction, chain }) => signAndExecute.mutateAsync({ transaction, chain }),
        onProgress: ({ message }) => setWalletArchiveStatus(message),
      });

      setAuditPackage(auditPayload);
      setAuditStorage(storage);
      setExecutionMode(execution.mode);
      setExecutionStatus(execution.status);
      setWalletArchiveStatus('Wallet-paid Walrus archive certified.');
      void refreshAgentCouncil({
        deepbookMarketEvidence,
        auditArchived: true,
        fallback: archivedAgentCouncil,
      }).then((refreshedCouncil) =>
        refreshIncidentRoom({
          deepbookMarketEvidence,
          auditArchived: true,
          agentCouncil: refreshedCouncil,
          fallback: archivedIncidentRoom,
        }),
      );
    } catch (error) {
      setExecuteWarning(
        error instanceof Error ? error.message : 'Execution or audit preparation failed.',
      );
      setExecutionMode('failed');
      setExecutionStatus('failed');
    } finally {
      setExecutionBusy(false);
    }
  }, [
    estimatedAfterRisk,
    effectivePolicy,
    effectiveSelectedExecutionMode,
    executionBusy,
    account,
    deepbookMarketError,
    deepbookMarketSnapshot,
    deepbookMarketStatus,
    explanationMode,
    liveDeepBookEligible,
    liveDeepBookGate,
    monitorRules,
    policyCheck,
    portfolio,
    receiptPackageId,
    recommendation,
    refreshAgentCouncil,
    refreshIncidentRoom,
    riskReport,
    signAndExecute,
    setWalletArchiveStatus,
  ]);

  const liveModeFallbackWarning =
    selectedExecutionMode === 'mainnet' && !liveDeepBookGate.canSubmitLive
      ? `Live mainnet is blocked: ${liveDeepBookGate.reasons
          .filter((reason) => reason !== 'Select live mainnet explicitly.')
          .join(' ')} RiskPilot will prepare the action without live submission.`
      : null;
  const warnings = [
    walletWarning,
    policyTouched && !policyCheck.ok ? 'Policy edits are currently blocking execution.' : null,
    liveModeFallbackWarning,
    executeWarning,
  ].filter(Boolean) as string[];
  const policyState = policyCheck.ok ? 'Ready' : 'Blocked';
  const selectedMode = selectedModeLabel(effectiveSelectedExecutionMode);
  const liveSubmitSelected = effectiveSelectedExecutionMode === 'mainnet' && liveDeepBookGate.canSubmitLive;

  const sectionMeta: Record<DemoSection, { eyebrow: string; title: string; copy: string }> = {
    overview: {
      eyebrow: 'Stage 01',
      title: account ? 'Read the connected wallet first' : 'Choose the story, then let the workflow unfold',
      copy: account
        ? 'RiskPilot uses live Sui mainnet balances and owned-object scan results for the portfolio view.'
        : 'A judge can start from the visual primitive cards, pick a portfolio case, and see the exact mainnet-ready context before moving deeper.',
    },
    risk: {
      eyebrow: 'Stage 02',
      title: 'Risk reads like a board, not a spreadsheet',
      copy: 'The deterministic score, scenario losses, and evidence chips are grouped as a focused risk stage.',
    },
    strategy: {
      eyebrow: 'Stage 03',
      title: 'Turn risk into a bounded DeepBook action',
      copy: 'The recommendation and policy gate sit together so the safety boundary is visible before preparation.',
    },
    audit: {
      eyebrow: 'Stage 04',
      title: 'Explain and archive the agent decision',
      copy: 'RiskPilot keeps the agent legible with a short explanation, watch rules, storage status, and audit trail preview.',
    },
    prepare: {
      eyebrow: 'Stage 05',
      title: 'Prepare by default, submit Spot only by opt-in',
      copy: 'This final stage keeps prepare-only as the default while exposing a wallet-signed DeepBook Spot path only when every live gate is green.',
    },
  };

  const stageCue: Record<DemoSection, { proof: string; evidence: string; boundary: string }> = {
    overview: {
      proof: account ? 'Live wallet context' : 'Judge scenario context',
      evidence: account ? 'Mainnet balances + owned-object scan' : 'Curated portfolio cases with deterministic risk',
      boundary: account ? 'No synthetic demo positions after connect' : 'Wallet connection remains optional',
    },
    risk: {
      proof: 'Deterministic risk map',
      evidence: `Score ${riskReport.overallScore}/100 · ${riskReport.signals.length} signals · what-if preview ready`,
      boundary: 'What-if changes preview state only',
    },
    strategy: {
      proof: 'Bounded action route',
      evidence: `${recommendation.deepbookAction.market} · ${formatUsd(recommendation.estimatedCostUsd)} estimated cost`,
      boundary: policyCheck.ok ? 'Policy gate is open' : 'Policy gate is blocking execution',
    },
    audit: {
      proof: 'Agentic decision trail',
      evidence: `${activeWhatIfIncidentRoomDecision.tasks.length} room tasks · ${activeWhatIfAgentCouncilDecision.agents.length} council agents`,
      boundary: 'Preview room is separate from real archive payload',
    },
    prepare: {
      proof: 'Mainnet prepare desk',
      evidence: auditStorage ? 'wallet-paid Walrus archive ready' : 'Wallet-paid Walrus archive pending',
      boundary: liveSubmitSelected ? 'Every paid action requires wallet approval' : 'Prepare-only still requires wallet-paid archive',
    },
  };

  function renderActiveSection() {
    if (activeSection === 'overview') {
      if (account) {
        return (
          <div className="stageGrid stageGridOverview stageGridConnectedWallet">
            <div className="stageColumn stageColumnWalletContext">
              <WalletSourcePanel address={walletAddress} assets={walletAssets ?? []} walletScan={walletScan} />
              <DemoFlowPanel walletConnected />
            </div>
            <div className="stageColumn stageColumnWalletPortfolio">
              <PortfolioOverview portfolio={portfolio} sourceLabel={sourceLabel} walletStatus={connectionStatus} />
              <VisualMotifPanel />
            </div>
          </div>
        );
      }

      return (
        <div className="stageGrid stageGridOverview">
          <div className="stageColumn">
            <DemoFlowPanel walletConnected={Boolean(account)} />
            <VisualMotifPanel />
          </div>
          <div className="stageColumn">
            <ScenarioSelector
              scenarios={DEMO_SCENARIOS}
              selectedScenarioId={selectedScenarioId}
              onChange={handleScenarioChange}
            />
            <PortfolioOverview portfolio={portfolio} sourceLabel={sourceLabel} walletStatus={connectionStatus} />
          </div>
        </div>
      );
    }

    if (activeSection === 'risk') {
      return (
        <div className="stageGrid stageGridRisk">
          <div className="stageColumn riskPrimaryColumn">
            <RiskScoreCard report={riskReport} />
            <WhatIfSimulatorPanel
              simulation={whatIfSimulation}
              selectedScenarioId={selectedWhatIfScenarioId}
              onScenarioChange={handleWhatIfScenarioChange}
            />
          </div>
          <div className="stageColumn riskSignalColumn">
            <RiskBreakdown signals={riskReport.signals} />
            <WhatIfStrategyDiff
              simulation={whatIfSimulation}
              baseRecommendation={recommendation}
              simulatedRecommendation={whatIfRecommendation}
              simulatedPolicyCheck={whatIfPolicyCheck}
            />
          </div>
        </div>
      );
    }

    if (activeSection === 'strategy') {
      return (
        <div className="stageGrid stageGridStrategy">
          <div className="stageColumn strategyPrimaryColumn">
            <StrategyPanel
              recommendation={recommendation}
              predictSettings={predictSettings}
              onPredictSettingsChange={handlePredictSettingsChange}
              marketSnapshot={deepbookMarketSnapshot}
              marketSnapshotStatus={deepbookMarketStatus}
              marketSnapshotError={deepbookMarketError}
            />
          </div>
          <div className="stageColumn strategyPreviewColumn">
            <WhatIfStrategyDiff
              simulation={whatIfSimulation}
              baseRecommendation={recommendation}
              simulatedRecommendation={whatIfRecommendation}
              simulatedPolicyCheck={whatIfPolicyCheck}
            />
            <PolicyReview policy={effectivePolicy} policyCheck={policyCheck} onChange={handlePolicyChange} />
          </div>
        </div>
      );
    }

    if (activeSection === 'audit') {
      return (
        <div className="stageGrid stageGridAudit">
          <div className="whatIfAuditPreview">
            <span className="pill pillAccent">what-if preview</span>
            <strong>{whatIfSimulation.scenario.label}</strong>
            <p>
              Incident Room and council preview use simulated risk. Prepare/archive still uses the real wallet or judge scenario.
            </p>
          </div>
          <div className="stageColumn auditPrimaryColumn">
            <AuditLogPanel
              explanation={explanation}
              explanationMode={explanationMode}
              explanationStatus={explanationStatus}
              storageMode={auditStorage?.mode ?? 'pending'}
              storageId={auditStorage?.id ?? ''}
              storageUrl={auditStorage?.url}
              storagePaymentLabel={archivePaymentLabel(auditStorage)}
              onRefresh={() => void refreshExplanation(policyRef.current ?? effectivePolicy)}
              refreshing={explanationStatus === 'loading' || executionBusy}
            />
            <AgentCouncilPanel
              decision={activeWhatIfAgentCouncilDecision}
              refreshing={whatIfAgentCouncilStatus === 'loading'}
            />
            <button
              className="button buttonGhost auditRefreshButton"
              type="button"
              onClick={() => void refreshWhatIfAgentCouncil()}
              disabled={whatIfAgentCouncilStatus === 'loading'}
            >
              {whatIfAgentCouncilStatus === 'loading' ? 'Refreshing what-if council' : 'Refresh what-if council'}
            </button>
            <EvidenceTimeline steps={activeWhatIfAgentCouncilDecision.evidenceTimeline} />
          </div>
          <div className="stageColumn auditCommandColumn">
            <IncidentRoomPanel
              incidentRoom={activeWhatIfIncidentRoomDecision}
              refreshing={whatIfIncidentRoomStatus === 'loading'}
              onRefresh={() => void refreshWhatIfIncidentRoom()}
            />
            <MonitorPanel rules={monitorRules} onToggleRule={handleMonitorRuleToggle} />
            {auditPackage && auditStorage ? (
              <>
                <AuditPackageExplorer auditPackage={auditPackage} storageResult={auditStorage} />
                <ResultPanel
                  auditPackage={auditPackage}
                  storageResult={auditStorage}
                  executionMode={executionMode}
                  executionStatus={executionStatus}
                riskBefore={riskReport}
                riskAfter={estimatedAfterRisk}
                warning={auditStorage.warning ?? auditStorage.error}
              />
              <ReceiptMintPanel
                key={`${auditPackage.id}-${auditStorage.id}`}
                  auditPackage={auditPackage}
                  storageResult={auditStorage}
                />
              </>
            ) : null}
          </div>
        </div>
      );
    }

    const liveGateReasons = liveDeepBookGate.reasons.filter(
      (reason) => reason !== 'Select live mainnet explicitly.',
    );
    const prepareButtonLabel = liveSubmitSelected
      ? 'Submit real Sui mainnet transaction and archive'
      : 'Prepare and wallet-paid archive';

    return (
      <div className="stageGrid stageGridPrepare">
        <div className="stageColumn preparePrimaryColumn">
          <PolicyReview policy={effectivePolicy} policyCheck={policyCheck} onChange={handlePolicyChange} />
          <div className="field executionModeControl">
            <span className="fieldLabel">Action mode</span>
            <div className="optionGroup optionGroupWide" role="radiogroup" aria-label="Action mode">
              {[
                { value: 'prepare_mainnet' as const, label: 'Prepare mainnet', detail: 'wallet archive' },
                { value: 'simulation' as const, label: 'Local simulation', detail: 'wallet archive' },
                {
                  value: 'mainnet' as const,
                  label: 'Live Spot mainnet',
                  detail: liveDeepBookEligible ? 'real tx opt-in' : 'SUI/USDC only',
                },
              ].map((mode) => (
                <button
                  className={`optionChip ${effectiveSelectedExecutionMode === mode.value ? 'optionChipActive' : ''}`}
                  key={mode.value}
                  type="button"
                  disabled={mode.value === 'mainnet' && !liveDeepBookEligible}
                  onClick={() => {
                    setSelectedExecutionMode(mode.value);
                    setAuditPackage(null);
                    setAuditStorage(null);
                    setExecutionMode('pending');
                    setExecutionStatus('awaiting approval');
                    setExecuteWarning('');
                    setWalletArchiveStatus('');
                  }}
                >
                  <span>{mode.label}</span>
                  <small>{mode.detail}</small>
                </button>
              ))}
            </div>
          </div>

          {liveSubmitSelected && liveTradePlan ? (
            <section className="liveExecutionPreview" aria-label="Live DeepBook Spot safety preview">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Live Spot opt-in</p>
                  <h2 className="panelTitle">Real Sui mainnet transaction preview</h2>
                </div>
                <span className="pill pillDanger">real submit</span>
              </div>

              <div className="ticketRows">
                <div className="ticketRow">
                  <span>Market</span>
                  <strong>{liveTradePlan.marketLabel}</strong>
                </div>
                <div className="ticketRow">
                  <span>Side</span>
                  <strong>{liveTradePlan.side}</strong>
                </div>
                <div className="ticketRow">
                  <span>Amount in</span>
                  <strong>{formatTradeAmount(liveTradePlan.amountIn, liveTradePlan.assetIn)}</strong>
                </div>
                <div className="ticketRow">
                  <span>Estimated out</span>
                  <strong>{formatTradeAmount(liveTradePlan.estimatedOut, liveTradePlan.assetOut)}</strong>
                </div>
                <div className="ticketRow">
                  <span>Minimum out</span>
                  <strong>
                    {formatTradeAmount(liveTradePlan.minimumOut, liveTradePlan.assetOut)} · {liveTradePlan.slippagePct}% max slippage
                  </strong>
                </div>
                <div className="ticketRow">
                  <span>Wallet</span>
                  <strong>{account ? formatAddress(account.address) : 'Not connected'}</strong>
                </div>
              </div>

              <div className="warningStrip inline">
                This button submits a real Sui mainnet DeepBook Spot transaction. Your connected wallet must sign and confirm it.
                Walrus archive storage is also signed and paid by the connected wallet.
              </div>
            </section>
          ) : selectedExecutionMode === 'mainnet' && liveGateReasons.length > 0 ? (
            <div className="warningStrip inline">
              Live Spot mainnet is blocked: {liveGateReasons.join(' ')}
            </div>
          ) : liveDeepBookEligible && liveTradePlan ? (
            <div className="noteRow">
              <span>Live Spot mainnet is available for this SUI/USDC route, but it only runs after selecting Live Spot mainnet and confirming in the wallet.</span>
            </div>
          ) : null}

          <div className="walletBoundaryNotice" role="note" aria-label="Payment and signer boundary">
            <div>
              <span>Subject wallet</span>
              <strong>{account ? formatAddress(account.address) : 'Judge scenario wallet'}</strong>
              <small>Read for balances, objects, and risk context.</small>
            </div>
            <div>
              <span>Wallet signer</span>
              <strong>Connected wallet</strong>
              <small>{liveSubmitSelected ? 'Signs live Spot plus Walrus archive.' : 'Signs Walrus register and certify.'}</small>
            </div>
            <div>
              <span>Archive payer</span>
              <strong>{archivePaymentLabel(auditStorage)}</strong>
              <small>Walrus archive is blocked unless this wallet pays.</small>
            </div>
          </div>

          {walletArchiveStatus ? <div className="noteRow">{walletArchiveStatus}</div> : null}

          <button
            className="button buttonPrimary prepareButton"
            type="button"
            onClick={() => void prepareAndArchive()}
            disabled={!policyCheck.ok || executionBusy || !account}
          >
            {executionBusy ? 'Preparing…' : prepareButtonLabel}
          </button>

          {!account ? (
            <div className="warningStrip inline">
              Connect a Sui mainnet wallet before Prepare/archive. Walrus storage has no backend or local-wallet payer.
            </div>
          ) : null}

          <section className="prepareSafetyPanel" aria-label="Prepare safety locks">
            <div className="prepareSafetyCard prepareSafetyCardBlue">
              <span>Wallet signer</span>
              <strong>Required for archive</strong>
            </div>
            <div className="prepareSafetyCard prepareSafetyCardYellow">
              <span>Mainnet action payer</span>
              <strong>{liveSubmitSelected ? 'Connected wallet' : 'No trade payment'}</strong>
            </div>
            <div className="prepareSafetyCard prepareSafetyCardMint">
              <span>Archive payer</span>
              <strong>{archivePaymentLabel(auditStorage)}</strong>
            </div>
            <div className="prepareSafetyCard prepareSafetyCardPurple">
              <span>Receipt signer</span>
              <strong>{receiptPackageId ? 'Wallet only if minted' : 'Optional'}</strong>
            </div>
          </section>
        </div>

        <div className="stageColumn prepareRailColumn">
          <section className="panel prepareCompanionPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Prepare ticket</p>
                <h2 className="panelTitle">Mainnet action preview</h2>
              </div>
              <span className={`pill ${policyCheck.ok ? 'pillSuccess' : 'pillDanger'}`}>
                {policyCheck.ok ? 'ready' : 'fix policy'}
              </span>
            </div>

            <div className="preparePoster">
              <div className="posterGrid" aria-hidden="true" />
              <div className="posterBlock posterBlockOne">SUI</div>
              <div className="posterBlock posterBlockTwo">AI</div>
              <div className="posterArrow">↗</div>
            </div>

            <div className="prepareRoute" aria-label="Prepare route">
              <div className={`prepareRouteStep ${policyCheck.ok ? 'prepareRouteReady' : 'prepareRouteBlocked'}`}>
                <span>01</span>
                <strong>Policy</strong>
                <small>{policyState}</small>
              </div>
              <div className="prepareRouteStep prepareRouteReady">
                <span>02</span>
                <strong>Mode</strong>
                <small>{selectedMode}</small>
              </div>
              <div className="prepareRouteStep">
                <span>03</span>
                <strong>Archive</strong>
                <small>{auditStorage ? archivePaymentLabel(auditStorage) : 'wallet payer required'}</small>
              </div>
            </div>

            <div className="ticketRows">
              <div className="ticketRow">
                <span>Subject wallet</span>
                <strong>{formatAddress(walletAddress)}</strong>
              </div>
              <div className="ticketRow">
                <span>Mode</span>
                <strong>{selectedMode}</strong>
              </div>
              <div className="ticketRow">
                <span>Market</span>
                <strong>{recommendation.deepbookAction.market}</strong>
              </div>
              <div className="ticketRow">
                <span>Budget</span>
                <strong>{formatUsd(effectivePolicy.maxBudgetUsd)}</strong>
              </div>
              <div className="ticketRow">
                <span>Manual approval</span>
                <strong>{effectivePolicy.requireManualApproval ? 'Required' : 'Not required'}</strong>
              </div>
              <div className="ticketRow">
                <span>Receipt package</span>
                <strong>{receiptPackageId ? formatAddress(receiptPackageId) : 'Not configured'}</strong>
              </div>
              <div className="ticketRow">
                <span>Walrus payer</span>
                <strong>{archivePaymentLabel(auditStorage)}</strong>
              </div>
              <div className="ticketRow">
                <span>Archive signer</span>
                <strong>{archiveSignerLabel(auditStorage)}</strong>
              </div>
            </div>

            <p className="panelCopy">
              {liveSubmitSelected
                ? 'Live Spot mode is selected. The connected wallet signs the Sui transaction, then signs and pays Walrus register and certify.'
                : 'The action is staged as a prepared record first, then the connected wallet signs and pays Walrus register and certify. No off-browser wallet is used.'}
            </p>
          </section>

          {auditPackage && auditStorage ? (
            <>
              <AuditPackageExplorer auditPackage={auditPackage} storageResult={auditStorage} />
              <ResultPanel
                auditPackage={auditPackage}
                storageResult={auditStorage}
                executionMode={executionMode}
                executionStatus={executionStatus}
                riskBefore={riskReport}
                riskAfter={estimatedAfterRisk}
                warning={auditStorage?.warning ?? auditStorage?.error}
              />
              <ReceiptMintPanel
                key={`${auditPackage.id}-${auditStorage.id}`}
                auditPackage={auditPackage}
                storageResult={auditStorage}
              />
            </>
          ) : (
            <section className="panel prepareResultPlaceholder">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Next output</p>
                  <h2 className="panelTitle">Prepared record lands here</h2>
                </div>
                <span className="pill pillWarn">waiting</span>
              </div>

              <div className="placeholderLedger" aria-hidden="true">
                <span className="ledgerLine ledgerLineWide" />
                <span className="ledgerLine" />
                <span className="ledgerLine ledgerLineMint" />
                <span className="ledgerStamp">WAL</span>
              </div>

              <div className="ticketRows">
                <div className="ticketRow">
                  <span>Before risk</span>
                  <strong>{riskReport.overallScore}</strong>
                </div>
                <div className="ticketRow">
                  <span>After est.</span>
                  <strong>{estimatedAfterRisk.overallScore}</strong>
                </div>
                <div className="ticketRow">
                  <span>Status</span>
                  <strong>{policyCheck.ok ? 'Ready to prepare' : policyCheck.errors[0]}</strong>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppShell
      networkBadge={`Sui mainnet · ${MAINNET_RPC_URL.replace('https://', '')}`}
      executionBadge={effectiveSelectedExecutionMode}
      walletLabel={connectionStatus}
      walletButton={<WalletConnectButton />}
      warnings={warnings}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      <div className="workspaceDeck">
        <div className={`stageIntro ${activeSection === 'prepare' ? 'stageIntroPrepare' : ''}`}>
          <div className="stageIntroText">
            <p className="eyebrow">{sectionMeta[activeSection].eyebrow}</p>
            <h2>{sectionMeta[activeSection].title}</h2>
            <p>{sectionMeta[activeSection].copy}</p>
            <div className="stageCue" aria-label="Demo proof points">
              <div className="stageCueItem stageCueProof">
                <span>Proof</span>
                <strong>{stageCue[activeSection].proof}</strong>
              </div>
              <div className="stageCueItem stageCueEvidence">
                <span>Evidence</span>
                <strong>{stageCue[activeSection].evidence}</strong>
              </div>
              <div className="stageCueItem stageCueBoundary">
                <span>Boundary</span>
                <strong>{stageCue[activeSection].boundary}</strong>
              </div>
            </div>
            <div className="judgeDemoCue" aria-label="One-click judge demo mode">
              <div>
                <span>{judgeDemoActive ? 'Judge demo active' : 'Completeness mode'}</span>
                <strong>
                  {judgeDemoActive
                    ? 'Risk stage is primed with leveraged lending + SUI -15% what-if.'
                    : 'One click primes the highest-signal demo path without submitting or archiving.'}
                </strong>
              </div>
              <Link
                className="button buttonGhost"
                href="/?stage=risk&demo=judge#risk-dashboard"
                onClick={judgeDemoActive ? exitJudgeDemo : startJudgeDemo}
              >
                {judgeDemoActive ? 'Exit demo cue' : 'Start judge demo'}
              </Link>
            </div>
          </div>

          {activeSection === 'prepare' ? (
            <div className="stageIntroAside" aria-label="Prepare stage summary">
              <div className="stageAsideTile stageAsideTileBlue">
                <span>Mode</span>
                <strong>{selectedModeLabel(effectiveSelectedExecutionMode)}</strong>
              </div>
              <div className={`stageAsideTile ${policyCheck.ok ? 'stageAsideTileMint' : 'stageAsideTilePink'}`}>
                <span>Policy</span>
                <strong>{policyCheck.ok ? 'Open' : 'Blocked'}</strong>
              </div>
              <div className="stageAsideTile stageAsideTileWide">
                <span>Risk path</span>
                <strong>
                  {riskReport.overallScore} → {estimatedAfterRisk.overallScore}
                </strong>
              </div>
            </div>
          ) : null}
        </div>

        <div className="stageSurface" key={activeSection}>
          {renderActiveSection()}
        </div>
      </div>
    </AppShell>
  );
}
