'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';

import { AppShell, scrollToDemoStage, type DemoSection } from './app-shell';
import { AgentPolicyPanel } from './agent-policy-panel';
import { ArchiveHistoryPanel } from './archive-history-panel';
import { ArchivePreflightPanel, type ArchiveProgressPhase } from './archive-preflight-panel';
import { AuditLogPanel } from './audit-log-panel';
import { BoundaryCheckPanel } from './boundary-check-panel';
import { PortfolioOverview } from './portfolio-overview';
import { PolicyReview } from './policy-review';
import { PreparedPtbPanel } from './prepared-ptb-panel';
import { ProofOfAgentActionPanel } from './proof-of-agent-action-panel';
import { ResultPanel } from './result-panel';
import { ReceiptMintPanel } from './receipt-mint-panel';
import { RiskBreakdown } from './risk-breakdown';
import { RiskScoreCard } from './risk-score-card';
import { StrategyPanel } from './strategy-panel';
import { VerificationPanel } from './verification-panel';
import { WalletConnectButton } from './wallet-connect';
import { WalletHealthSummary } from './wallet-health-summary';
import { WalletRequiredPanel } from './wallet-required-panel';
import { WalletSourcePanel } from './wallet-source-panel';
import { WhatIfSimulatorPanel } from './what-if-simulator-panel';

import { buildMockExplanation } from '@/lib/ai/explain';
import { buildAgentCouncilDecision, type AgentCouncilDecision } from '@/lib/agents/decision-council';
import { buildIncidentRoomDecision, type IncidentRoomDecision } from '@/lib/agents/incident-room';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  createDemoPortfolio,
} from '@/lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '@/lib/risk/risk-engine';
import { buildWhatIfSimulation } from '@/lib/risk/what-if-engine';
import {
  DEFAULT_WHAT_IF_SCENARIO_ID,
  type WhatIfScenarioId,
} from '@/lib/risk/what-if-scenarios';
import { MAINNET_RPC_URL } from '@/lib/sui/client';
import { createExecutionIntent, verifyExecutionIntent, type ExecutionIntent } from '@/lib/security/execution-intent';
import {
  buildWalletAssetsPortfolio,
  readMainnetWalletAssets,
  readMainnetWalletScan,
} from '@/lib/sui/portfolio';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import { buildMonitorRules } from '@/lib/strategy/monitor';
import {
  buildStrategyRecommendation,
  type DeepBookPredictSettings,
  type StrategyRecommendation,
} from '@/lib/strategy/strategy-builder';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { createAuditPackage, createDeepBookMarketEvidence } from '@/lib/walrus/audit-package';
import {
  clearArchiveHistory,
  createArchiveHistoryEntry,
  readArchiveHistory,
  saveArchiveReceiptProof,
  saveArchiveHistoryEntry,
  type ArchiveHistoryEntry,
} from '@/lib/walrus/archive-history';
import { formatAddress, formatUsd } from '@/lib/utils/format';
import type { AssetBalance, WalletScanSummary } from '@/lib/risk/types';
import {
  getDeepBookLiveGate,
  type DeepBookLiveMarketSnapshot,
} from '@/lib/sui/deepbook-live';
import { prepareDeepBookTransaction } from '@/lib/sui/deepbook';
import {
  buildPreparedDeepBookPtb,
  buildPreparedPtbEvidenceMessage,
  createSignedPreparedPtb,
  encodePreparedPtbEvidenceMessage,
  type SignedPreparedPtb,
} from '@/lib/sui/prepared-ptb';
import {
  AGENT_POLICY_PACKAGE_ID,
  buildAgentPolicyObjectFromPolicy,
  buildCreateAgentPolicyTransaction,
  extractAgentPolicyObjectId,
  validateAgentPolicyObject,
  type AgentPolicyObject,
} from '@/lib/sui/agent-policy';

type ExplanationStatus = 'idle' | 'ready' | 'loading' | 'fallback';
type ExplanationMode = 'mock' | 'deepseek' | 'openai';
type SelectedExecutionMode = 'prepare_mainnet' | 'mainnet';
const ARCHIVE_AI_TIMEOUT_MS = 4500;
const PENDING_PREPARE_STORAGE_KEY = 'riskpilot.pendingPrepare.v1';

type PendingPrepareSession = {
  walletAddress: string;
  savedAt: string;
  agentPolicyObject: AgentPolicyObject;
  executionIntent: ExecutionIntent;
  signedPreparedPtb?: SignedPreparedPtb;
};

function selectedModeLabel(mode: SelectedExecutionMode) {
  if (mode === 'prepare_mainnet') {
    return 'Prepare mainnet';
  }

  if (mode === 'mainnet') {
    return 'Live mainnet';
  }

  return 'Prepare mainnet';
}

function isAiProviderMode(mode: string): boolean {
  return mode === 'openai' || mode === 'deepseek';
}

function readPendingPrepareSession(): PendingPrepareSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PENDING_PREPARE_STORAGE_KEY);

    return raw ? (JSON.parse(raw) as PendingPrepareSession) : null;
  } catch {
    return null;
  }
}

function savePendingPrepareSession(session: PendingPrepareSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PENDING_PREPARE_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Local persistence is a convenience; the wallet flow remains usable without it.
  }
}

function clearPendingPrepareSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(PENDING_PREPARE_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
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
  return storage?.paymentLabel ?? 'Connect wallet required';
}

type RiskPilotAppProps = {
  initialSection?: DemoSection;
};

export function RiskPilotApp({ initialSection = 'overview' }: RiskPilotAppProps) {
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
  const signPersonalMessage = useSignPersonalMessage();

  const walletAddress = account?.address ?? '0xDEMO';
  const connectionStatus = account ? `Connected ${formatAddress(account.address)}` : 'Wallet required';
  const sourceLabel = account ? 'mainnet wallet' : 'local sample';

  const [walletAssets, setWalletAssets] = useState<AssetBalance[] | null>(null);
  const [walletScan, setWalletScan] = useState<WalletScanSummary | null>(null);
  const [walletWarning, setWalletWarning] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>('mock');
  const [explanationStatus, setExplanationStatus] = useState<ExplanationStatus>('idle');
  const [executeWarning, setExecuteWarning] = useState<string>('');
  const [executionBusy, setExecutionBusy] = useState(false);
  const [auditPackage, setAuditPackage] = useState<AuditPackage | null>(null);
  const [auditStorage, setAuditStorage] = useState<AuditStorageResult | null>(null);
  const [executionIntent, setExecutionIntent] = useState<ExecutionIntent | null>(null);
  const [executionIntentStatus, setExecutionIntentStatus] = useState<'locking' | 'locked' | 'error'>('locking');
  const [executionIntentError, setExecutionIntentError] = useState('');
  const [signedPreparedPtb, setSignedPreparedPtb] = useState<SignedPreparedPtb | null>(null);
  const [preparedPtbError, setPreparedPtbError] = useState('');
  const [agentPolicyObject, setAgentPolicyObject] = useState<AgentPolicyObject | null>(null);
  const [agentPolicyMinting, setAgentPolicyMinting] = useState(false);
  const [agentPolicyWarning, setAgentPolicyWarning] = useState('');
  const [archiveHistory, setArchiveHistory] = useState<ArchiveHistoryEntry[]>([]);
  const [archiveProgressPhase, setArchiveProgressPhase] = useState<ArchiveProgressPhase>('idle');
  const [executionMode, setExecutionMode] = useState('pending');
  const [executionStatus, setExecutionStatus] = useState('awaiting approval');
  const [aiAgentCouncil, setAiAgentCouncil] = useState<AgentCouncilDecision | null>(null);
  const [, setAgentCouncilStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [, setAiIncidentRoom] = useState<IncidentRoomDecision | null>(null);
  const [, setIncidentRoomStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [aiWhatIfIncidentRoom, setAiWhatIfIncidentRoom] = useState<IncidentRoomDecision | null>(null);
  const [selectedExecutionMode] = useState<SelectedExecutionMode>('prepare_mainnet');
  const [deepbookMarketSnapshot, setDeepbookMarketSnapshot] = useState<DeepBookLiveMarketSnapshot | null>(null);
  const [deepbookMarketStatus, setDeepbookMarketStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deepbookMarketError, setDeepbookMarketError] = useState<string | null>(null);
  const [selectedWhatIfScenarioId, setSelectedWhatIfScenarioId] = useState<WhatIfScenarioId>(
    DEFAULT_WHAT_IF_SCENARIO_ID,
  );
  const [activeSection, setActiveSection] = useState<DemoSection>(initialSection);
  const visibleSection: DemoSection = activeSection;
  const defaultBudgetCap = Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_BUDGET_USD ?? 5);
  const receiptPackageId = process.env.NEXT_PUBLIC_RECEIPT_PACKAGE_ID?.trim() ?? '';
  const liveDeepBookFeatureEnabled = (process.env.NEXT_PUBLIC_ENABLE_DEEPBOOK_REAL ?? 'true').toLowerCase() !== 'false';
  const defaultPolicyNow = useMemo(() => new Date('2026-06-15T00:00:00.000Z'), []);
  const monitorNow = defaultPolicyNow;
  const [predictSettings, setPredictSettings] = useState<DeepBookPredictSettings>({
    thresholdPct: -10,
    expiryDays: 7,
    budgetUsd: Number.isFinite(defaultBudgetCap) ? defaultBudgetCap : 5,
  });
  const policyRef = useRef<ExecutionPolicy | null>(null);

  const portfolio = useMemo(() => {
    const demoPortfolio = createDemoPortfolio(walletAddress, {
      scenarioId: DEFAULT_DEMO_SCENARIO_ID,
    });
    const mergedPortfolio = account ? buildWalletAssetsPortfolio(demoPortfolio, walletAssets ?? []) : demoPortfolio;

    return account && walletScan
      ? {
          ...mergedPortfolio,
          walletScan,
        }
      : mergedPortfolio;
  }, [account, walletAddress, walletAssets, walletScan]);

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

  const [policy, setPolicy] = useState<ExecutionPolicy>(() => createDefaultPolicy(recommendation, defaultPolicyNow));
  const [policyTouched, setPolicyTouched] = useState(false);

  const openDemoSection = useCallback((section: DemoSection) => {
    setActiveSection(section);

    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('stage', section);
    url.hash = 'risk-dashboard';
    window.history.replaceState(null, '', url);
    window.requestAnimationFrame(() => {
      scrollToDemoStage();
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.has('demo')) {
      currentUrl.searchParams.delete('demo');
      window.history.replaceState(null, '', currentUrl);
    }

    const frame = window.requestAnimationFrame(() => {
      setArchiveHistory(readArchiveHistory());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const effectivePolicy = useMemo(
    () => (policyTouched ? policy : createDefaultPolicy(recommendation, defaultPolicyNow)),
    [defaultPolicyNow, policy, policyTouched, recommendation],
  );
  const whatIfPolicy = useMemo(() => {
    const basePolicy = createDefaultPolicy(whatIfRecommendation, defaultPolicyNow);

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
  }, [defaultPolicyNow, whatIfRecommendation, whatIfSimulation.policyOverride]);

  useEffect(() => {
    policyRef.current = effectivePolicy;
  }, [effectivePolicy]);

  useEffect(() => {
    let cancelled = false;

    async function lockExecutionIntent() {
      setExecutionIntentStatus('locking');
      setExecutionIntentError('');

      try {
        const expectedPolicyObjectId = agentPolicyObject?.objectId;
        const expectedSource = account ? 'base_wallet' : 'local_sample';

        if (
          executionIntent &&
          executionIntent.policyObjectId === expectedPolicyObjectId &&
          executionIntent.intentSource === expectedSource
        ) {
          const existingIntentCheck = await verifyExecutionIntent({
            intent: executionIntent,
            portfolioSnapshot: portfolio,
            riskReport,
            recommendation,
            policy: effectivePolicy,
            now: new Date(),
          });

          if (existingIntentCheck.ok) {
            if (!cancelled) {
              setExecutionIntentStatus('locked');
            }
            return;
          }
        }

        const intent = await createExecutionIntent({
        portfolioSnapshot: portfolio,
        riskReport,
        recommendation,
        policy: effectivePolicy,
        policyObjectId: agentPolicyObject?.objectId,
        source: account ? 'base_wallet' : 'local_sample',
      });

        if (!cancelled) {
          setExecutionIntent(intent);
          setExecutionIntentStatus('locked');
        }
      } catch (error) {
        if (!cancelled) {
          setExecutionIntent(null);
          setExecutionIntentStatus('error');
          setExecutionIntentError(error instanceof Error ? error.message : 'Could not lock execution intent.');
        }
      }
    }

    void lockExecutionIntent();

    return () => {
      cancelled = true;
    };
  }, [account, agentPolicyObject?.objectId, effectivePolicy, executionIntent, portfolio, recommendation, riskReport]);

  useEffect(() => {
    let cancelled = false;

    async function restorePendingPrepareSession() {
      const pending = readPendingPrepareSession();

      if (!pending || !account?.address) {
        return;
      }

      if (pending.walletAddress.toLowerCase() !== account.address.toLowerCase()) {
        return;
      }

      const verification = await verifyExecutionIntent({
        intent: pending.executionIntent,
        portfolioSnapshot: portfolio,
        riskReport,
        recommendation,
        policy: effectivePolicy,
        now: new Date(),
        rejectLocalSample: true,
      });

      if (cancelled || !verification.ok) {
        return;
      }

      setAgentPolicyObject(pending.agentPolicyObject);
      setExecutionIntent(pending.executionIntent);
      setExecutionIntentStatus('locked');
      setExecutionIntentError('');

      if (pending.signedPreparedPtb) {
        setSignedPreparedPtb(pending.signedPreparedPtb);
      }
    }

    void restorePendingPrepareSession();

    return () => {
      cancelled = true;
    };
  }, [account?.address, effectivePolicy, portfolio, recommendation, riskReport]);

  useEffect(() => {
    if (!account?.address || !agentPolicyObject || !executionIntent) {
      return;
    }

    const pending = readPendingPrepareSession();
    const signedForIntent =
      signedPreparedPtb?.policyObjectId === agentPolicyObject.objectId &&
      signedPreparedPtb.executionIntentId === executionIntent.executionIntentId
        ? signedPreparedPtb
        : pending?.walletAddress.toLowerCase() === account.address.toLowerCase() &&
            pending.agentPolicyObject.objectId === agentPolicyObject.objectId &&
            pending.signedPreparedPtb
          ? pending.signedPreparedPtb
          : undefined;

    savePendingPrepareSession({
      walletAddress: account.address,
      savedAt: new Date().toISOString(),
      agentPolicyObject,
      executionIntent,
      signedPreparedPtb: signedForIntent,
    });
  }, [account?.address, agentPolicyObject, executionIntent, signedPreparedPtb]);

  const resetAiPreviewState = useCallback(() => {
    setAiAgentCouncil(null);
    setAgentCouncilStatus('idle');
    setAiIncidentRoom(null);
    setIncidentRoomStatus('idle');
    setAiWhatIfIncidentRoom(null);
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
        setArchiveProgressPhase('idle');
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
          setArchiveProgressPhase('idle');
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
  const agentPolicyObjectCheck = useMemo(
    () => validateAgentPolicyObject(agentPolicyObject, effectivePolicy, recommendation, new Date()),
    [agentPolicyObject, effectivePolicy, recommendation],
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
        now: monitorNow,
      }),
    [
      deepbookMarketError,
      deepbookMarketStatus,
      effectivePolicy,
      monitorNow,
      policyCheck,
      portfolio,
      recommendation,
      riskReport,
      walletScan,
    ],
  );

  const monitorRules = defaultMonitorRules;

  const spotPtbRecommendation = useMemo<Pick<StrategyRecommendation, 'deepbookAction' | 'title' | 'type'>>(
    () => ({
      title: 'DeepBook Spot PTB proof path',
      type: 'sui_downside_protection' as const,
      deepbookAction: {
        mode: 'prepare_mainnet' as const,
        kind: 'spot' as const,
        market: 'SUI/USDC',
        side: 'sell' as const,
        assetIn: 'SUI' as const,
        assetOut: 'USDC' as const,
        amountUsd: Math.max(1, Math.min(effectivePolicy.maxSingleTradeUsd, recommendation.estimatedCostUsd || 5)),
        description:
          'Judge-facing prepared DeepBook Spot PTB proof path. Wallet signs bytes for authorization evidence; RiskPilot does not submit.',
      },
    }),
    [effectivePolicy.maxSingleTradeUsd, recommendation.estimatedCostUsd],
  );
  const preparedPtb = useMemo(
    () =>
      buildPreparedDeepBookPtb({
        recommendation: spotPtbRecommendation,
        marketSnapshot: deepbookMarketSnapshot,
      }),
    [deepbookMarketSnapshot, spotPtbRecommendation],
  );
  const signedPreparedPtbForCurrentIntent =
    signedPreparedPtb &&
    signedPreparedPtb.policyObjectId === agentPolicyObject?.objectId &&
    signedPreparedPtb.executionIntentId === executionIntent?.executionIntentId
      ? signedPreparedPtb
      : null;
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
        policyObject: agentPolicyObject
          ? {
              objectId: agentPolicyObject.objectId,
              status: agentPolicyObjectCheck.status,
              source: agentPolicyObject.source,
            }
          : null,
      }),
    [
      account,
      agentPolicyObject,
      agentPolicyObjectCheck.status,
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
        policyObject: agentPolicyObject
          ? {
              objectId: agentPolicyObject.objectId,
              status: agentPolicyObjectCheck.status,
              source: agentPolicyObject.source,
            }
          : null,
      }),
    [
      account,
      agentCouncilDecision,
      agentPolicyObject,
      agentPolicyObjectCheck.status,
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
        policyObject: null,
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
      policyObject: agentPolicyObject
        ? {
            objectId: agentPolicyObject.objectId,
            status: agentPolicyObjectCheck.status,
            source: agentPolicyObject.source,
          }
        : null,
    }),
    [
      account,
      agentPolicyObject,
      agentPolicyObjectCheck.status,
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
        setAgentCouncilStatus(isAiProviderMode(payload.decision.mode) ? 'ready' : 'fallback');
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
      policyObject: agentPolicyObject
        ? {
            objectId: agentPolicyObject.objectId,
            status: agentPolicyObjectCheck.status,
            source: agentPolicyObject.source,
          }
        : null,
    }),
    [
      account,
      agentCouncilDecision,
      agentPolicyObject,
      agentPolicyObjectCheck.status,
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
        setIncidentRoomStatus(isAiProviderMode(payload.incidentRoom.mode) ? 'ready' : 'fallback');
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
          mode: ExplanationMode;
          model?: string;
        };

        setExplanation(payload.explanation);
        setExplanationMode(payload.mode);
        setExplanationStatus('ready');
        return payload.explanation;
      } catch {
        const fallback = buildMockExplanation(portfolio, riskReport, recommendation, currentPolicy);
        setExplanation(fallback);
        setExplanationMode('mock');
        setExplanationStatus('fallback');
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
      setArchiveProgressPhase('idle');
      setSignedPreparedPtb(null);
      clearPendingPrepareSession();
      setPreparedPtbError('');
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
    setArchiveProgressPhase('idle');
    setSignedPreparedPtb(null);
    clearPendingPrepareSession();
    setPreparedPtbError('');
    resetAiPreviewState();
    setExecutionMode('pending');
    setExecutionStatus('Awaiting confirmation');
    setExecuteWarning('');
  }, [resetAiPreviewState]);

  const handleWhatIfScenarioChange = useCallback((scenarioId: WhatIfScenarioId) => {
    setSelectedWhatIfScenarioId(scenarioId);
    setAiWhatIfIncidentRoom(null);
  }, []);

  const mintAgentPolicyObject = useCallback(async () => {
    if (!account?.address) {
      setAgentPolicyWarning('Connect a Sui mainnet wallet before minting AgentPolicy.');
      return;
    }

    if (!AGENT_POLICY_PACKAGE_ID) {
      setAgentPolicyWarning('NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID or NEXT_PUBLIC_RECEIPT_PACKAGE_ID is not configured.');
      return;
    }

    if (!policyCheck.ok) {
      setAgentPolicyWarning('The current app/server Policy Gate has not passed, so the on-chain authorization object cannot be minted.');
      return;
    }

    setAgentPolicyMinting(true);
    setAgentPolicyWarning('');

    try {
      const tx = buildCreateAgentPolicyTransaction({ policy: effectivePolicy });
      const result = await signAndExecute.mutateAsync({ transaction: tx, chain: 'sui:mainnet' });
      const objectId = extractAgentPolicyObjectId(result.objectChanges);

      if (!objectId) {
        throw new Error('No newly created AgentPolicy object was found in the wallet response.');
      }

      const mintedPolicyObject = buildAgentPolicyObjectFromPolicy({
        objectId,
        policy: effectivePolicy,
        owner: account.address,
        packageId: AGENT_POLICY_PACKAGE_ID,
      });

      setAgentPolicyObject(mintedPolicyObject);
      if (executionIntent) {
        savePendingPrepareSession({
          walletAddress: account.address,
          savedAt: new Date().toISOString(),
          agentPolicyObject: mintedPolicyObject,
          executionIntent,
        });
      }
      setAuditPackage(null);
      setAuditStorage(null);
      setArchiveProgressPhase('idle');
      resetAiPreviewState();
    } catch (error) {
      setAgentPolicyWarning(error instanceof Error ? error.message : 'AgentPolicy mint failed.');
    } finally {
      setAgentPolicyMinting(false);
    }
  }, [
    account,
    effectivePolicy,
    policyCheck.ok,
    resetAiPreviewState,
    executionIntent,
    signAndExecute,
  ]);

  const signPreparedPtb = useCallback(async () => {
    if (!account?.address) {
      setPreparedPtbError('Connect a Sui mainnet wallet before signing the prepared PTB.');
      return;
    }

    if (!executionIntent || !preparedPtb.eligible || !preparedPtb.plan) {
      setPreparedPtbError(preparedPtb.reason ?? 'Prepared PTB is not ready yet.');
      return;
    }

    if (!agentPolicyObjectCheck.ok) {
      setPreparedPtbError('AgentPolicy object must be aligned before signing the prepared PTB.');
      return;
    }

    if (!agentPolicyObject?.objectId) {
      setPreparedPtbError('AgentPolicy object is required before signing the evidence message.');
      return;
    }

    setPreparedPtbError('');

    try {
      const evidenceMessage = buildPreparedPtbEvidenceMessage({
        walletAddress: account.address,
        policyObjectId: agentPolicyObject.objectId,
        executionIntent,
        preparedPtb,
      });
      const { bytes, signature } = await signPersonalMessage.mutateAsync({
        message: encodePreparedPtbEvidenceMessage(evidenceMessage),
        chain: 'sui:mainnet',
      });
      const signed = await createSignedPreparedPtb({
        bytes,
        signature,
        signer: account.address,
        policyObjectId: agentPolicyObject?.objectId,
        executionIntentId: executionIntent.executionIntentId,
      });
      setSignedPreparedPtb(signed);
      savePendingPrepareSession({
        walletAddress: account.address,
        savedAt: new Date().toISOString(),
        agentPolicyObject,
        executionIntent,
        signedPreparedPtb: signed,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Prepared PTB signing unavailable.';
      setPreparedPtbError(message);
      setSignedPreparedPtb(null);
    }
  }, [
    account,
    agentPolicyObject,
    agentPolicyObjectCheck.ok,
    executionIntent,
    preparedPtb,
    signPersonalMessage,
  ]);

  const prepareAndArchive = useCallback(async () => {
    if (!policyCheck.ok || executionBusy || !executionIntent) {
      return;
    }

    setExecutionBusy(true);
    setExecuteWarning('');
    setArchiveProgressPhase('package');

    try {
      if (!account?.address) {
        throw new Error('Connect a Sui mainnet wallet before preparing and archiving. Paid archive storage must be signed by the connected wallet.');
      }

      if (!preparedPtb.eligible || !preparedPtb.plan) {
        throw new Error(preparedPtb.reason ?? 'Prepared PTB is not eligible yet.');
      }

      let signedPreparedEvidence = signedPreparedPtbForCurrentIntent;
      let currentExecutionIntent = executionIntent;
      let currentAgentPolicyObject = agentPolicyObject;
      const pendingPrepare = readPendingPrepareSession();

      if (
        !signedPreparedEvidence &&
        pendingPrepare?.walletAddress.toLowerCase() === account.address.toLowerCase() &&
        pendingPrepare.agentPolicyObject.objectId === agentPolicyObject?.objectId &&
        pendingPrepare.signedPreparedPtb
      ) {
        const restoredIntentCheck = await verifyExecutionIntent({
          intent: pendingPrepare.executionIntent,
          portfolioSnapshot: portfolio,
          riskReport,
          recommendation,
          policy: effectivePolicy,
          now: new Date(),
          rejectLocalSample: true,
        });

        if (restoredIntentCheck.ok) {
          signedPreparedEvidence = pendingPrepare.signedPreparedPtb;
          currentExecutionIntent = pendingPrepare.executionIntent;
          currentAgentPolicyObject = pendingPrepare.agentPolicyObject;
          setAgentPolicyObject(pendingPrepare.agentPolicyObject);
          setExecutionIntent(pendingPrepare.executionIntent);
          setExecutionIntentStatus('locked');
          setSignedPreparedPtb(pendingPrepare.signedPreparedPtb);
        }
      }

      if (!signedPreparedEvidence) {
        throw new Error('Please sign the prepared PTB before archiving evidence.');
      }

      const currentPolicy = policyRef.current ?? effectivePolicy;

      if (new Date(currentExecutionIntent.intentExpiresAt).getTime() <= Date.now()) {
        throw new Error('Execution intent expired. Re-check the strategy to refresh locked digests.');
      }

      const currentExplanation =
        explanation.trim() || buildMockExplanation(portfolio, riskReport, recommendation, currentPolicy);
      const auditMarketSnapshot = deepbookMarketSnapshot;
      let execution: AuditPackage['execution'];

      execution = prepareDeepBookTransaction(
        recommendation.deepbookAction,
        account.address,
        'prepare_mainnet',
      );

      if (execution.warning) {
        setExecuteWarning(execution.warning);
      }

      execution = {
        ...execution,
        mode: 'prepare_mainnet',
        status: 'prepared',
        preparedPtb: {
          ...preparedPtb,
          status: 'signed',
        },
        signedPreparedPtb: signedPreparedEvidence,
        digest: signedPreparedEvidence.bytesDigest,
        preparedTransactionSummary: preparedPtb.plan.summary,
        authority: {
          signer: 'connected_wallet',
          payer: 'none',
          signerLabel: 'Connected wallet signed the evidence message',
          payerLabel: 'Not submitted, no gas paid',
          walletAddress: account.address,
          note: 'Wallet signs an evidence message only; RiskPilot does not submit a transaction or move assets. Walrus archives the signed proof.',
        },
      };

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
        policyObjectId: currentAgentPolicyObject?.objectId,
        policyObject: currentAgentPolicyObject
          ? {
              objectId: currentAgentPolicyObject.objectId,
              owner: currentAgentPolicyObject.owner,
              packageId: currentAgentPolicyObject.packageId,
              status: agentPolicyObjectCheck.status,
              source: currentAgentPolicyObject.source,
            }
          : undefined,
        executionIntent: currentExecutionIntent,
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
      const { storeAuditPackageWithConnectedWallet } = await import('@/lib/walrus/wallet-archive');
      const storage = await storeAuditPackageWithConnectedWallet({
        auditPackage: auditPayload,
        walletAddress: account.address,
        signAndExecute: ({ transaction, chain }) => signAndExecute.mutateAsync({ transaction, chain }),
        onProgress: ({ phase }) => {
          setArchiveProgressPhase(phase);
        },
      });

      setAuditPackage(auditPayload);
      setAuditStorage(storage);
      const historyEntry = createArchiveHistoryEntry(auditPayload, storage);
      setArchiveHistory(saveArchiveHistoryEntry(historyEntry));
      clearPendingPrepareSession();
      setExecutionMode(execution.mode);
      setExecutionStatus(execution.status);
      setArchiveProgressPhase('certified');
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
      setArchiveProgressPhase('failed');
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
    executionBusy,
    executionIntent,
    account,
    agentPolicyObject,
    agentPolicyObjectCheck.status,
    deepbookMarketError,
    deepbookMarketSnapshot,
    deepbookMarketStatus,
    explanation,
    explanationMode,
    liveDeepBookGate,
    monitorRules,
    preparedPtb,
    policyCheck,
    portfolio,
    receiptPackageId,
    recommendation,
    refreshAgentCouncil,
    refreshIncidentRoom,
    riskReport,
    signAndExecute,
    signedPreparedPtbForCurrentIntent,
  ]);

  const liveModeFallbackWarning =
    selectedExecutionMode === 'mainnet' && !liveDeepBookGate.canSubmitLive
      ? `Live mainnet blocked: ${liveDeepBookGate.reasons
          .filter((reason) => reason !== 'Select live mainnet explicitly.')
          .join(' ')} RiskPilot prepares the action but does not submit Live.`
      : null;
  const warnings = [
    walletWarning,
    agentPolicyWarning,
    executionIntentStatus === 'error' ? `Execution intent lock failed: ${executionIntentError}` : null,
    liveModeFallbackWarning,
    executeWarning,
  ].filter(Boolean) as string[];
  const selectedMode = selectedModeLabel(effectiveSelectedExecutionMode);
  const liveSubmitSelected = false;

  const clearLocalArchiveHistory = useCallback(() => {
    setArchiveHistory(clearArchiveHistory());
  }, []);

  const handleReceiptMinted = useCallback(
    (proof: NonNullable<AuditPackage['receiptProof']>) => {
      if (!auditPackage || !auditStorage) {
        return;
      }

      setAuditPackage((current) => (current ? { ...current, receiptProof: proof } : current));
      setArchiveHistory(
        saveArchiveReceiptProof({
          auditId: auditPackage.id,
          storageId: auditStorage.id,
          receiptProof: proof,
        }),
      );
    },
    [auditPackage, auditStorage],
  );

  const sectionMeta: Record<DemoSection, { eyebrow: string; title: string; copy: string }> = {
    overview: {
      eyebrow: 'Observe',
      title: 'Read wallet risk',
      copy: 'Reads Sui mainnet wallet assets and objects, then turns exposure into checkable evidence. No signature is requested and no assets move.',
    },
    risk: {
      eyebrow: 'Plan',
      title: 'Generate risk response',
      copy: 'When Sui risk rises, AI proposes a response but has no execution authority. RiskPilot keeps the recommendation bound by Policy and wallet confirmation.',
    },
    strategy: {
      eyebrow: 'Verify Policy',
      title: 'Check authorization boundaries',
      copy: 'Policy checks budget, market, asset, and expiry boundaries before action. The Agent must prove it stays inside the authorized lane.',
    },
    audit: {
      eyebrow: 'Act',
      title: 'Prepare PTB proof',
      copy: 'Prepares reviewable PTB proof, monitor rules, and audit notes. The action package can be signed as evidence, but no transaction is submitted.',
    },
    prepare: {
      eyebrow: 'Remember',
      title: 'Archive audit memory',
      copy: 'Archives decisions, signatures, and Walrus proof into replayable audit memory so reviewers can verify why the Agent acted.',
    },
  };

  const stageCue: Record<DemoSection, { proof: string; evidence: string; boundary: string }> = {
    overview: {
      proof: account ? 'Shows real wallet risk context' : 'Shows real wallet data is read only after connection',
      evidence: account ? 'Mainnet balances, owned objects, risk signals' : 'Sample Walrus proof rail + safe local checks',
      boundary: 'No signature request. No asset movement.',
    },
    risk: {
      proof: 'Shows the Agent only proposes a response when risk rises',
      evidence: `Score ${riskReport.overallScore}/100 · ${riskReport.signals.length} signals · What-if preview`,
      boundary: 'AI has no execution authority and does not trade directly.',
    },
    strategy: {
      proof: agentPolicyObject ? 'Shows the on-chain authorization object exists' : 'Shows Policy blocks overreach before action',
      evidence: agentPolicyObject ? formatAddress(agentPolicyObject.objectId) : `${recommendation.deepbookAction.market} · ${formatUsd(recommendation.estimatedCostUsd)}`,
      boundary: agentPolicyObjectCheck.ok ? 'Only Policy-bound actions are allowed' : 'No execution before Policy passes',
    },
    audit: {
      proof: 'Shows the action package is reviewable but not submitted',
      evidence: `${activeWhatIfIncidentRoomDecision.tasks.length} review tasks · prepared PTB`,
      boundary: 'Prepares PTB proof only. Does not submit for the user.',
    },
    prepare: {
      proof: 'Shows this decision can be replayed',
      evidence: auditStorage ? 'Walrus blob, register/certify, StrategyReceipt' : 'Awaiting wallet signature and Walrus archive',
      boundary: signedPreparedPtbForCurrentIntent ? 'Archives signed evidence as not-submitted proof' : 'No final memory without a signature',
    },
  };

  const stageOutcome: Record<DemoSection, { label: string; value: string; tone: 'safe' | 'watch' | 'proof' }> = {
    overview: {
      label: 'Current answer',
      value: account ? 'Real wallet context is connected' : 'Without a wallet, only sample data and safe checks are shown',
      tone: account ? 'safe' : 'watch',
    },
    risk: {
      label: 'Core result',
      value: 'Sui risk rose. AI proposed a response, but has no execution authority.',
      tone: 'proof',
    },
    strategy: {
      label: 'Safety gate',
      value: policyCheck.ok ? 'Policy passed. Prepare can continue.' : 'Policy blocked. The Agent cannot overreach.',
      tone: policyCheck.ok ? 'safe' : 'watch',
    },
    audit: {
      label: 'Execution boundary',
      value: signedPreparedPtbForCurrentIntent ? 'Evidence signed. Transaction still not submitted.' : 'Prepared only. Not submitted.',
      tone: 'proof',
    },
    prepare: {
      label: 'Verifiable memory',
      value: auditStorage ? 'Walrus archive created. Audit can be replayed.' : 'Awaiting wallet signature before writing to Walrus.',
      tone: auditStorage ? 'safe' : 'watch',
    },
  };

  function renderActiveSection() {
    if (visibleSection === 'overview') {
      if (account) {
        return (
          <div className="stageGrid stageGridOverview stageGridConnectedWallet">
            <div className="stageColumn stageColumnWalletContext">
              <WalletHealthSummary
                address={walletAddress}
                assets={walletAssets ?? []}
                walletScan={walletScan}
                riskReport={riskReport}
                recommendation={recommendation}
              />
              <WalletSourcePanel address={walletAddress} assets={walletAssets ?? []} walletScan={walletScan} />
            </div>
            <div className="stageColumn stageColumnWalletPortfolio">
              <PortfolioOverview portfolio={portfolio} sourceLabel={sourceLabel} walletStatus={connectionStatus} />
            </div>
          </div>
        );
      }

      return (
        <div className="stageGrid stageGridOverview">
          <div className="stageColumn">
            <VerificationPanel
              auditPackage={auditPackage}
              storageResult={auditStorage}
              onOpenAudit={() => openDemoSection(auditPackage && auditStorage ? 'prepare' : 'audit')}
            />
          </div>
          <div className="stageColumn">
            <WalletRequiredPanel />
            <BoundaryCheckPanel />
          </div>
        </div>
      );
    }

    if (visibleSection === 'risk') {
      return (
        <div className="stageGrid stageGridRisk">
          <div className="stageColumn riskPrimaryColumn">
            <WhatIfSimulatorPanel
              simulation={whatIfSimulation}
              selectedScenarioId={selectedWhatIfScenarioId}
              onScenarioChange={handleWhatIfScenarioChange}
            />
          </div>
          <div className="stageColumn riskSignalColumn">
            <RiskScoreCard report={riskReport} />
            <RiskBreakdown signals={riskReport.signals} />
          </div>
        </div>
      );
    }

    if (visibleSection === 'strategy') {
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
            <PolicyReview
              policy={effectivePolicy}
              policyCheck={policyCheck}
              onChange={handlePolicyChange}
              assetOptions={[recommendation.deepbookAction.assetIn, recommendation.deepbookAction.assetOut]}
              marketOptions={[recommendation.deepbookAction.market]}
            />
            <AgentPolicyPanel
              accountAddress={account?.address}
              policy={effectivePolicy}
              policyCheck={policyCheck}
              policyObject={agentPolicyObject}
              policyObjectCheck={agentPolicyObjectCheck}
              minting={agentPolicyMinting}
              onMint={() => void mintAgentPolicyObject()}
            />
          </div>
        </div>
      );
    }

    if (visibleSection === 'audit') {
      return (
        <div className="stageGrid stageGridAudit">
          <div className="stageColumn auditPrimaryColumn">
            <ProofOfAgentActionPanel
              policyObjectId={agentPolicyObject?.objectId}
              executionIntent={executionIntent}
              preparedPtb={preparedPtb}
              signedPreparedPtb={signedPreparedPtbForCurrentIntent}
              auditPackage={auditPackage}
              storageResult={auditStorage}
              receiptPackageId={receiptPackageId}
            />
          </div>
          <div className="stageColumn auditCommandColumn">
            <PreparedPtbPanel
              accountAddress={account?.address}
              preparedPtb={preparedPtb}
              signedPreparedPtb={signedPreparedPtbForCurrentIntent}
              signing={signPersonalMessage.isPending}
              error={preparedPtbError}
              policyObjectId={agentPolicyObject?.objectId}
              executionIntent={executionIntent}
              onSign={() => void signPreparedPtb()}
            />
          </div>
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
            compact
          />
        </div>
      );
    }

    const prepareButtonLabel = liveSubmitSelected
      ? 'Submit real Sui mainnet transaction and archive'
      : 'Archive signed prepared PTB';
    return (
      <div className="stageGrid stageGridPrepare">
        <div className="stageColumn preparePrimaryColumn">
          <div className="prepareActionSpine" aria-label="Prepare main action path">
            <div className="prepareStepCard prepareStepCardPolicy">
              <div className="prepareStepMarker" aria-hidden="true">01</div>
              <AgentPolicyPanel
                accountAddress={account?.address}
                policy={effectivePolicy}
                policyCheck={policyCheck}
                policyObject={agentPolicyObject}
                policyObjectCheck={agentPolicyObjectCheck}
                minting={agentPolicyMinting}
                onMint={() => void mintAgentPolicyObject()}
                compact
                showActions={false}
                simplified
              />
            </div>

            <div className="prepareStepCard prepareStepCardPtb">
              <div className="prepareStepMarker" aria-hidden="true">02</div>
              <PreparedPtbPanel
                accountAddress={account?.address}
                preparedPtb={preparedPtb}
                signedPreparedPtb={signedPreparedPtbForCurrentIntent}
                signing={signPersonalMessage.isPending}
                error={preparedPtbError}
                policyObjectId={agentPolicyObject?.objectId}
                executionIntent={executionIntent}
                onSign={() => void signPreparedPtb()}
                compact
                showActions={false}
                simplified
              />
            </div>

            <div className="prepareStepCard prepareStepCardArchive">
              <div className="prepareStepMarker" aria-hidden="true">03</div>
              <ArchivePreflightPanel
                accountAddress={account?.address}
                selectedMode={selectedMode}
                liveSubmitSelected={liveSubmitSelected}
                policyOk={policyCheck.ok}
                executionBusy={executionBusy}
                archiveProgressPhase={archiveProgressPhase}
                auditStorage={auditStorage}
                executionIntent={executionIntent}
                executionIntentStatus={executionIntentStatus}
              />

              <button
                className="button buttonPrimary prepareButton"
                type="button"
                onClick={() => void prepareAndArchive()}
                disabled={
                  !policyCheck.ok ||
                  !agentPolicyObjectCheck.ok ||
                  executionBusy ||
                  !account ||
                  !executionIntent ||
                  executionIntentStatus !== 'locked'
                }
              >
                {executionBusy ? 'Preparing...' : prepareButtonLabel}
              </button>
            </div>
          </div>

          {!account ? (
            <div className="warningStrip inline">
              Connect a Sui mainnet wallet before Prepare / archive. Walrus storage has no backend or local-wallet payer.
            </div>
          ) : null}

          {auditPackage && auditStorage ? (
            <ResultPanel
              auditPackage={auditPackage}
              storageResult={auditStorage}
              executionMode={executionMode}
              executionStatus={executionStatus}
              riskBefore={riskReport}
              riskAfter={estimatedAfterRisk}
            />
          ) : null}
        </div>

        <div className="stageColumn prepareRailColumn">
          <ProofOfAgentActionPanel
            policyObjectId={agentPolicyObject?.objectId}
            executionIntent={executionIntent}
            preparedPtb={preparedPtb}
            signedPreparedPtb={signedPreparedPtbForCurrentIntent}
            auditPackage={auditPackage}
            storageResult={auditStorage}
            receiptPackageId={receiptPackageId}
            compact
          />

          <ArchiveHistoryPanel
            entries={archiveHistory}
            activeAuditId={auditPackage?.id}
            compact
            onClear={clearLocalArchiveHistory}
          />

          {auditPackage && auditStorage ? (
            <ReceiptMintPanel
              key={`${auditPackage.id}-${auditStorage.id}`}
              auditPackage={auditPackage}
              storageResult={auditStorage}
              onReceiptMinted={handleReceiptMinted}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <AppShell
      networkBadge={`Sui mainnet · ${MAINNET_RPC_URL.replace('https://', '')}`}
      walletLabel={connectionStatus}
      walletButton={<WalletConnectButton />}
      warnings={warnings}
      activeSection={visibleSection}
      onSectionChange={setActiveSection}
    >
      <div className="workspaceDeck">
        <div className={`stageIntro ${visibleSection === 'prepare' ? 'stageIntroPrepare' : ''}`}>
          <div className="stageIntroText">
            <p className="eyebrow">{sectionMeta[visibleSection].eyebrow}</p>
            <h2>{sectionMeta[visibleSection].title}</h2>
            <p>{sectionMeta[visibleSection].copy}</p>
            <div className={`stageOutcome stageOutcome-${stageOutcome[visibleSection].tone}`}>
              <span>{stageOutcome[visibleSection].label}</span>
              <strong>{stageOutcome[visibleSection].value}</strong>
            </div>
            <div className="stageCue" aria-label="Demo proof points">
              <div className="stageCueItem stageCueProof">
                <span>What this proves</span>
                <strong>{stageCue[visibleSection].proof}</strong>
              </div>
              <div className="stageCueItem stageCueEvidence">
                <span>Evidence used</span>
                <strong>{stageCue[visibleSection].evidence}</strong>
              </div>
              <div className="stageCueItem stageCueBoundary">
                <span>What it will not do</span>
                <strong>{stageCue[visibleSection].boundary}</strong>
              </div>
            </div>
          </div>

        </div>

        <div className="stageSurface" key={activeSection}>
          {renderActiveSection()}
        </div>
      </div>
    </AppShell>
  );
}
