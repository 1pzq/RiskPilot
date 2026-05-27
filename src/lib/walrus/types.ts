import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import type { MonitorRule } from '@/lib/strategy/monitor';
import type { AgentCouncilDecision } from '@/lib/agents/decision-council';
import type { IncidentRoomDecision } from '@/lib/agents/incident-room';

export type DeepBookMarketEvidence = {
  source: '/api/deepbook-market';
  status: 'ready' | 'unavailable';
  routeStatus?: 'idle' | 'loading' | 'ready' | 'error';
  walletAddress?: string;
  poolKey: string;
  poolAddress?: string;
  baseCoin?: string;
  quoteCoin?: string;
  midPrice?: number;
  quoteOutForOneBase?: number;
  baseOutForOneQuote?: number;
  vaultBalances?: {
    base: number;
    quote: number;
    deep: number;
  };
  tradeParams?: {
    takerFee: number;
    makerFee: number;
    stakeRequired: number;
  };
  registeredPool?: boolean;
  whitelisted?: boolean;
  poolStatus?: 'registered' | 'unregistered' | 'unknown';
  whitelistStatus?: 'whitelisted' | 'open' | 'unknown';
  fetchedAt?: string;
  error?: string;
  fallbackReason?: string;
};

export type AuditPackage = {
  id: string;
  createdAt: string;
  walletAddress: string;
  portfolioSnapshot: PortfolioSnapshot;
  riskReportBefore: RiskReport;
  recommendation: StrategyRecommendation;
  monitorRules: MonitorRule[];
  deepbookMarketEvidence: DeepBookMarketEvidence;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  agentCouncil?: AgentCouncilDecision;
  incidentRoom?: IncidentRoomDecision;
  aiExplanation: string;
  execution: {
    mode: 'simulation' | 'prepare_mainnet' | 'mainnet';
    status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
    digest?: string;
    simulationId?: string;
    effectsStatus?: 'success' | 'failure';
    effectsError?: string;
    error?: string;
    warning?: string;
    preparedTransactionSummary?: string;
    transactionBytes?: string;
    adapter?: {
      venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet' | 'local simulation';
      requestedMode: 'simulation' | 'prepare_mainnet' | 'mainnet';
      mainnetOnly: true;
    };
    authority?: {
      signer: 'connected_wallet' | 'none';
      payer: 'connected_wallet' | 'none';
      signerLabel: string;
      payerLabel: string;
      walletAddress?: string;
      note: string;
    };
  };
  riskReportAfter?: RiskReport;
};

export type AuditArchiveActor = 'connected_wallet' | 'none';

export type AuditStorageResult = {
  mode: 'walrus';
  id: string;
  url?: string;
  error?: string;
  warning?: string;
  provider?: 'walrus-mainnet-wallet';
  fallback?: boolean;
  checksum?: string;
  sizeBytes?: number;
  archivePayer?: AuditArchiveActor;
  archiveSigner?: AuditArchiveActor;
  paymentLabel?: string;
  signerLabel?: string;
  walletPaysArchive?: boolean;
  custodyNote?: string;
  walletAddress?: string;
  blobObjectId?: string;
  registerDigest?: string;
  certifyDigest?: string;
  uploadRelayUrl?: string;
};
