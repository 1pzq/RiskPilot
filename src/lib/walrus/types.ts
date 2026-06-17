import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import type { MonitorRule } from '@/lib/strategy/monitor';
import type { AgentCouncilDecision } from '@/lib/agents/decision-council';
import type { IncidentRoomDecision } from '@/lib/agents/incident-room';
import type { ExecutionIntent } from '@/lib/security/execution-intent';
import type { PreparedDeepBookPtb, SignedPreparedPtb } from '@/lib/sui/prepared-ptb';

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
  policyObjectId?: string;
  policyObject?: {
    objectId: string;
    owner?: string;
    packageId: string;
    status: 'not_minted' | 'minted' | 'selected' | 'revoked' | 'expired' | 'mismatch';
    source: 'wallet_mint' | 'manual_selection' | 'archive_history';
  };
  executionIntent?: ExecutionIntent;
  receiptProof?: {
    strategyId: string;
    policyObjectId?: string;
    auditBlobId: string;
    executionDigest: string;
    receiptDigest: string;
    receiptObjectId?: string;
    signer: string;
    mintedAt: string;
  };
  agentCouncil?: AgentCouncilDecision;
  incidentRoom?: IncidentRoomDecision;
  aiExplanation: string;
  execution: {
    mode: 'prepare_mainnet' | 'mainnet';
    status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
    digest?: string;
    effectsStatus?: 'success' | 'failure';
    effectsError?: string;
    error?: string;
    warning?: string;
    preparedTransactionSummary?: string;
    transactionBytes?: string;
    preparedPtb?: PreparedDeepBookPtb;
    signedPreparedPtb?: SignedPreparedPtb;
    adapter?: {
      venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet';
      requestedMode: 'prepare_mainnet' | 'mainnet';
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
