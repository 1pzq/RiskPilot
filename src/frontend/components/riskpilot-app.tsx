'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';

import { AppShell, type DemoSection } from './app-shell';
import { AuditLogPanel } from './audit-log-panel';
import { DemoFlowPanel } from './demo-flow-panel';
import { PortfolioOverview } from './portfolio-overview';
import { PolicyReview } from './policy-review';
import { ResultPanel } from './result-panel';
import { ReceiptMintPanel } from './receipt-mint-panel';
import { RiskBreakdown } from './risk-breakdown';
import { RiskScoreCard } from './risk-score-card';
import { ScenarioSelector } from './scenario-selector';
import { StrategyPanel } from './strategy-panel';
import { VisualMotifPanel } from './visual-motif-panel';
import { WalletConnectButton } from './wallet-connect';
import { WalletSourcePanel } from './wallet-source-panel';

import { buildMockExplanation } from '@/lib/ai/explain';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  DEMO_SCENARIOS,
  createDemoPortfolio,
  type DemoScenarioId,
} from '@/lib/risk/fixtures';
import { calculateRiskReport, estimatePostStrategyRisk } from '@/lib/risk/risk-engine';
import { MAINNET_RPC_URL } from '@/lib/sui/client';
import {
  buildWalletAssetsPortfolio,
  readMainnetWalletAssets,
  readMainnetWalletScan,
} from '@/lib/sui/portfolio';
import type { ExecutionPolicy } from '@/lib/strategy/policy';
import { createDefaultPolicy, validateExecutionPolicy } from '@/lib/strategy/policy';
import {
  buildStrategyRecommendation,
  type DeepBookPredictSettings,
} from '@/lib/strategy/strategy-builder';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import { createAuditPackage } from '@/lib/walrus/audit-package';
import { formatAddress } from '@/lib/utils/format';
import type { AssetBalance, WalletScanSummary } from '@/lib/risk/types';
import {
  buildDeepBookLiveTransaction,
  isLiveDeepBookEligible,
  type DeepBookLiveMarketSnapshot,
} from '@/lib/sui/deepbook-live';

type ExplanationStatus = 'idle' | 'ready' | 'loading' | 'fallback';
type SelectedExecutionMode = 'simulation' | 'prepare_mainnet' | 'mainnet';

function selectedModeLabel(mode: SelectedExecutionMode) {
  if (mode === 'prepare_mainnet') {
    return 'Prepare mainnet';
  }

  if (mode === 'mainnet') {
    return 'Live mainnet';
  }

  return 'Local simulation';
}

export function RiskPilotApp() {
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
  const [selectedExecutionMode, setSelectedExecutionMode] = useState<SelectedExecutionMode>('prepare_mainnet');
  const [deepbookMarketSnapshot, setDeepbookMarketSnapshot] = useState<DeepBookLiveMarketSnapshot | null>(null);
  const [deepbookMarketStatus, setDeepbookMarketStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deepbookMarketError, setDeepbookMarketError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<DemoScenarioId>(DEFAULT_DEMO_SCENARIO_ID);
  const [activeSection, setActiveSection] = useState<DemoSection>('overview');
  const defaultBudgetCap = Number(process.env.NEXT_PUBLIC_DEFAULT_MAX_BUDGET_USD ?? 5);
  const receiptPackageId = process.env.NEXT_PUBLIC_RECEIPT_PACKAGE_ID?.trim() ?? '';
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

  useEffect(() => {
    policyRef.current = effectivePolicy;
  }, [effectivePolicy]);

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
  }, [account, client]);

  const policyCheck = useMemo(
    () => validateExecutionPolicy(effectivePolicy, recommendation, new Date()),
    [effectivePolicy, recommendation],
  );

  const liveDeepBookEligible = useMemo(
    () => Boolean(account) && isLiveDeepBookEligible(recommendation),
    [account, recommendation],
  );
  const effectiveSelectedExecutionMode =
    selectedExecutionMode === 'mainnet' && !liveDeepBookEligible ? 'prepare_mainnet' : selectedExecutionMode;

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
        const response = await fetch('/api/explain', {
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
        });

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
      setExecutionMode('pending');
      setExecutionStatus('awaiting approval');
      setExecuteWarning('');
    },
    [setPolicy],
  );

  const handlePredictSettingsChange = useCallback((nextSettings: DeepBookPredictSettings) => {
    setPredictSettings(nextSettings);
    setAuditPackage(null);
    setAuditStorage(null);
    setExecutionMode('pending');
    setExecutionStatus('awaiting approval');
    setExecuteWarning('');
  }, []);

  const handleScenarioChange = useCallback((scenarioId: DemoScenarioId) => {
    setSelectedScenarioId(scenarioId);
    setPolicyTouched(false);
    setAuditPackage(null);
    setAuditStorage(null);
    setExecutionMode('pending');
    setExecutionStatus('awaiting approval');
    setExecuteWarning('');
  }, []);

  const prepareAndArchive = useCallback(async () => {
    if (!policyCheck.ok || executionBusy) {
      return;
    }

    setExecutionBusy(true);
    setExecuteWarning('');

    try {
      const currentExplanation = await refreshExplanation(policyRef.current ?? effectivePolicy);
      let execution: {
        mode: 'simulation' | 'prepare_mainnet' | 'mainnet';
        status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
        digest?: string;
        simulationId?: string;
        error?: string;
        preparedTransactionSummary?: string;
        warning?: string;
        adapter?: {
          venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet' | 'local simulation';
          requestedMode: 'simulation' | 'prepare_mainnet' | 'mainnet';
          mainnetOnly: true;
        };
      };

      if (effectiveSelectedExecutionMode === 'mainnet' && liveDeepBookEligible) {
        try {
          const marketSnapshot = deepbookMarketSnapshot ?? (await loadDeepBookMarketSnapshot());
          const liveExecution = buildDeepBookLiveTransaction(
            account?.address ?? walletAddress,
            recommendation,
            marketSnapshot,
          );
          const liveResult = await signAndExecute.mutateAsync({ transaction: liveExecution.transaction });

          execution = {
            mode: 'mainnet',
            status: liveResult.effects?.status?.status === 'success' ? 'confirmed' : 'submitted',
            digest: liveResult.digest,
            preparedTransactionSummary: liveExecution.plan.summary,
            adapter: {
              venue: 'DeepBook mainnet',
              requestedMode: 'mainnet',
              mainnetOnly: true,
            },
          };
        } catch (liveError) {
          setExecuteWarning(
            liveError instanceof Error
              ? `Live DeepBook execution failed, so RiskPilot fell back to prepare-only mode: ${liveError.message}`
              : 'Live DeepBook execution failed, so RiskPilot fell back to prepare-only mode.',
          );

          const executeResponse = await fetch('/api/execute', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              recommendation,
              policy: effectivePolicy,
              policyCheck,
              walletAddress,
              executionMode: 'prepare_mainnet',
            }),
          });

          if (!executeResponse.ok) {
            const payload = (await executeResponse.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? `Execution failed with ${executeResponse.status}`);
          }

          execution = (await executeResponse.json()) as {
            mode: 'simulation' | 'prepare_mainnet' | 'mainnet';
            status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
            digest?: string;
            simulationId?: string;
            error?: string;
            preparedTransactionSummary?: string;
            warning?: string;
            adapter?: {
              venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet' | 'local simulation';
              requestedMode: 'simulation' | 'prepare_mainnet' | 'mainnet';
              mainnetOnly: true;
            };
          };
        }
      } else {
        const executeResponse = await fetch('/api/execute', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            recommendation,
            policy: effectivePolicy,
            policyCheck,
            walletAddress,
              executionMode: effectiveSelectedExecutionMode === 'mainnet' ? 'prepare_mainnet' : effectiveSelectedExecutionMode,
          }),
        });

        if (!executeResponse.ok) {
          const payload = (await executeResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Execution failed with ${executeResponse.status}`);
        }

        execution = (await executeResponse.json()) as {
          mode: 'simulation' | 'prepare_mainnet' | 'mainnet';
          status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
          digest?: string;
          simulationId?: string;
          error?: string;
          preparedTransactionSummary?: string;
          warning?: string;
          adapter?: {
            venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet' | 'local simulation';
            requestedMode: 'simulation' | 'prepare_mainnet' | 'mainnet';
            mainnetOnly: true;
          };
        };
      }

      if (execution.warning) {
        setExecuteWarning(execution.warning);
      }

      const auditPayload = createAuditPackage({
        walletAddress,
        portfolioSnapshot: portfolio,
        riskReportBefore: riskReport,
        recommendation,
        policy: effectivePolicy,
        policyCheck,
        aiExplanation: currentExplanation,
        execution,
        riskReportAfter: estimatedAfterRisk,
      });

      const auditResponse = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(auditPayload),
      });

      if (!auditResponse.ok) {
        const payload = (await auditResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Audit upload failed with ${auditResponse.status}`);
      }

      const payload = (await auditResponse.json()) as {
        auditPackage: AuditPackage;
        storage: AuditStorageResult;
      };

      setAuditPackage(payload.auditPackage);
      setAuditStorage(payload.storage);
      setExecutionMode(execution.mode);
      setExecutionStatus(execution.status);
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
    deepbookMarketSnapshot,
    liveDeepBookEligible,
    loadDeepBookMarketSnapshot,
    policyCheck,
    portfolio,
    recommendation,
    refreshExplanation,
    riskReport,
    signAndExecute,
    walletAddress,
  ]);

  const liveModeFallbackWarning =
    selectedExecutionMode === 'mainnet' && !liveDeepBookEligible
      ? 'Live mainnet is only available for spot SUI/USDC or USDC/SUI swaps in this build. RiskPilot will prepare the action without live submission.'
      : null;
  const warnings = [
    walletWarning,
    policyTouched && !policyCheck.ok ? 'Policy edits are currently blocking execution.' : null,
    liveModeFallbackWarning,
    executeWarning,
  ].filter(Boolean) as string[];

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
      copy: 'RiskPilot keeps the agent legible with a short explanation, storage status, and audit trail preview.',
    },
    prepare: {
      eyebrow: 'Stage 05',
      title: 'Prepare the action without live submission',
      copy: 'This final stage keeps execution mode, the CTA, and the prepared result in one controlled place.',
    },
  };

  function renderActiveSection() {
    if (activeSection === 'overview') {
      return (
        <div className="stageGrid stageGridOverview">
          <div className="stageColumn">
            <DemoFlowPanel walletConnected={Boolean(account)} />
            <VisualMotifPanel />
          </div>
          <div className="stageColumn">
            {account ? (
              <WalletSourcePanel address={walletAddress} assets={walletAssets ?? []} walletScan={walletScan} />
            ) : (
              <ScenarioSelector
                scenarios={DEMO_SCENARIOS}
                selectedScenarioId={selectedScenarioId}
                onChange={handleScenarioChange}
              />
            )}
            <PortfolioOverview portfolio={portfolio} sourceLabel={sourceLabel} walletStatus={connectionStatus} />
          </div>
        </div>
      );
    }

    if (activeSection === 'risk') {
      return (
        <div className="stageGrid">
          <RiskScoreCard report={riskReport} />
          <RiskBreakdown signals={riskReport.signals} />
        </div>
      );
    }

    if (activeSection === 'strategy') {
      return (
        <div className="stageGrid">
          <StrategyPanel
            recommendation={recommendation}
            predictSettings={predictSettings}
            onPredictSettingsChange={handlePredictSettingsChange}
            marketSnapshot={deepbookMarketSnapshot}
            marketSnapshotStatus={deepbookMarketStatus}
            marketSnapshotError={deepbookMarketError}
          />
          <PolicyReview policy={effectivePolicy} policyCheck={policyCheck} onChange={handlePolicyChange} />
        </div>
      );
    }

    if (activeSection === 'audit') {
      return (
        <div className="stageGrid">
          <AuditLogPanel
            explanation={explanation}
            explanationMode={explanationMode}
            explanationStatus={explanationStatus}
            storageMode={auditStorage?.mode ?? 'pending'}
            storageId={auditStorage?.id ?? ''}
            storageUrl={auditStorage?.url}
            onRefresh={() => void refreshExplanation(policyRef.current ?? effectivePolicy)}
            refreshing={explanationStatus === 'loading' || executionBusy}
          />
          {auditPackage && auditStorage ? (
            <>
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
      );
    }

    const policyState = policyCheck.ok ? 'Ready' : 'Blocked';
    const selectedMode = selectedModeLabel(effectiveSelectedExecutionMode);

    return (
      <div className="stageGrid stageGridPrepare">
        <div className="stageColumn preparePrimaryColumn">
          <PolicyReview policy={effectivePolicy} policyCheck={policyCheck} onChange={handlePolicyChange} />
          <div className="field executionModeControl">
            <span className="fieldLabel">Action mode</span>
            <div className="optionGroup optionGroupWide" role="radiogroup" aria-label="Action mode">
              {[
                { value: 'prepare_mainnet' as const, label: 'Prepare mainnet', detail: 'default' },
                { value: 'simulation' as const, label: 'Local simulation', detail: 'fallback' },
                {
                  value: 'mainnet' as const,
                  label: 'Live mainnet',
                  detail: liveDeepBookEligible ? 'wallet approval' : 'spot only',
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
                  }}
                >
                  <span>{mode.label}</span>
                  <small>{mode.detail}</small>
                </button>
              ))}
            </div>
          </div>

          <button
            className="button buttonPrimary prepareButton"
            type="button"
            onClick={() => void prepareAndArchive()}
            disabled={!policyCheck.ok || executionBusy}
          >
            {executionBusy ? 'Preparing…' : 'Prepare and archive action'}
          </button>

          <section className="prepareSafetyPanel" aria-label="Prepare safety locks">
            <div className="prepareSafetyCard prepareSafetyCardBlue">
              <span>No live submit</span>
              <strong>Prepared record only</strong>
            </div>
            <div className="prepareSafetyCard prepareSafetyCardYellow">
              <span>Mainnet path</span>
              <strong>Sui + DeepBook context</strong>
            </div>
            <div className="prepareSafetyCard prepareSafetyCardMint">
              <span>Audit storage</span>
              <strong>{auditStorage ? auditStorage.mode : 'Walrus fallback-ready'}</strong>
            </div>
            <div className="prepareSafetyCard prepareSafetyCardPurple">
              <span>Receipt contract</span>
              <strong>{receiptPackageId ? 'Published on mainnet' : 'Optional'}</strong>
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
                <small>{auditStorage ? auditStorage.mode : 'pending'}</small>
              </div>
            </div>

            <div className="ticketRows">
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
                <strong>${effectivePolicy.maxBudgetUsd.toFixed(2)}</strong>
              </div>
              <div className="ticketRow">
                <span>Manual approval</span>
                <strong>{effectivePolicy.requireManualApproval ? 'Required' : 'Not required'}</strong>
              </div>
              <div className="ticketRow">
                <span>Receipt package</span>
                <strong>{receiptPackageId ? formatAddress(receiptPackageId) : 'Not configured'}</strong>
              </div>
            </div>

            <p className="panelCopy">
              The action is staged as a prepared record first. No live transaction is submitted unless live mode is explicitly eligible and selected.
            </p>
          </section>

          {auditPackage && auditStorage ? (
            <>
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
