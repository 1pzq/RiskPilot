import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import type { PortfolioSnapshot, RiskReport } from '@/lib/risk/types';
import type { StrategyRecommendation } from '@/lib/strategy/strategy-builder';

export type AuditPackage = {
  id: string;
  createdAt: string;
  walletAddress: string;
  portfolioSnapshot: PortfolioSnapshot;
  riskReportBefore: RiskReport;
  recommendation: StrategyRecommendation;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  aiExplanation: string;
  execution: {
    mode: 'simulation' | 'prepare_mainnet' | 'mainnet';
    status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
    digest?: string;
    simulationId?: string;
    error?: string;
    warning?: string;
    preparedTransactionSummary?: string;
    transactionBytes?: string;
    adapter?: {
      venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet' | 'local simulation';
      requestedMode: 'simulation' | 'prepare_mainnet' | 'mainnet';
      mainnetOnly: true;
    };
  };
  riskReportAfter?: RiskReport;
};

export type AuditStorageResult = {
  mode: 'local' | 'walrus';
  id: string;
  url?: string;
  error?: string;
  warning?: string;
  provider?: 'walrus-mainnet-cli' | 'walrus-mainnet-publisher' | 'local-file' | 'memory';
  fallback?: boolean;
  checksum?: string;
  sizeBytes?: number;
  localPath?: string;
};
