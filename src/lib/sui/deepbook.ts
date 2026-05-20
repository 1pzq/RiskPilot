import { createRunId, makePrefixedId, stableHash } from '../utils/ids';

export type DeepBookExecutionMode = 'simulation' | 'prepare_mainnet' | 'mainnet';

export type DeepBookExecutionRequest = {
  market: string;
  side: 'buy' | 'sell';
  assetIn: string;
  assetOut: string;
  amountUsd: number;
  kind?: 'spot' | 'predict_binary';
  description?: string;
};

export type DeepBookExecutionResult = {
  mode: DeepBookExecutionMode;
  status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
  digest?: string;
  simulationId?: string;
  error?: string;
  preparedTransactionSummary?: string;
  transactionBytes?: string;
  warning?: string;
  adapter: {
    venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet' | 'local simulation';
    requestedMode: DeepBookExecutionMode;
    mainnetOnly: true;
  };
};

function summarizeRequest(request: DeepBookExecutionRequest): string {
  const kind = request.kind === 'predict_binary' ? 'DeepBook Predict binary' : 'DeepBook spot';
  return `${kind}: ${request.side.toUpperCase()} ${request.amountUsd.toFixed(2)} USD of ${request.assetIn} into ${request.assetOut} on ${request.market}`;
}

function venueForRequest(request: DeepBookExecutionRequest): 'DeepBook mainnet' | 'DeepBook Predict mainnet' {
  return request.kind === 'predict_binary' ? 'DeepBook Predict mainnet' : 'DeepBook mainnet';
}

function normalizeExecutionMode(value?: string | null): DeepBookExecutionMode {
  if (value === 'simulation' || value === 'prepare_mainnet' || value === 'mainnet') {
    return value;
  }

  if (value === 'simulate') {
    return 'simulation';
  }

  if (value === 'live') {
    return 'mainnet';
  }

  return 'prepare_mainnet';
}

export function simulateDeepBookAction(request: DeepBookExecutionRequest): DeepBookExecutionResult {
  const digest = makePrefixedId('sim', JSON.stringify(request));

  return {
    mode: 'simulation',
    status: 'prepared',
    simulationId: createRunId('sim'),
    digest,
    preparedTransactionSummary: `Local simulation only: ${summarizeRequest(request)}.`,
    adapter: {
      venue: 'local simulation',
      requestedMode: 'simulation',
      mainnetOnly: true,
    },
  };
}

export function prepareDeepBookTransaction(
  request: DeepBookExecutionRequest,
  walletAddress: string,
  requestedMode: DeepBookExecutionMode = 'prepare_mainnet',
): DeepBookExecutionResult {
  const fingerprint = stableHash(`${walletAddress}:${JSON.stringify(request)}`);
  const summary = summarizeRequest(request);

  return {
    mode: 'prepare_mainnet',
    status: 'prepared',
    digest: `prep_${fingerprint.slice(0, 12)}`,
    preparedTransactionSummary: `Prepared mainnet action for ${walletAddress}: ${summary}.`,
    transactionBytes: `0x${fingerprint}`,
    adapter: {
      venue: venueForRequest(request),
      requestedMode,
      mainnetOnly: true,
    },
  };
}

export async function executeDeepBookTransaction(
  request: DeepBookExecutionRequest,
  walletAddress: string,
  options?: {
    requestedMode?: string | null;
    enableRealDeepBook?: boolean;
    allowLocalFallback?: boolean;
  },
): Promise<DeepBookExecutionResult> {
  const requestedMode = normalizeExecutionMode(options?.requestedMode);
  const allowLocalFallback = options?.allowLocalFallback ?? true;
  const enableRealDeepBook = options?.enableRealDeepBook ?? true;

  try {
    if (requestedMode === 'simulation' || !enableRealDeepBook) {
      return {
        ...simulateDeepBookAction(request),
        warning: 'Local simulation fallback used. No funds were submitted.',
      };
    }

    if (requestedMode === 'mainnet') {
      return {
        ...prepareDeepBookTransaction(request, walletAddress, requestedMode),
        warning:
          'Live mainnet submission is not wired in this demo build. A mainnet action was prepared instead.',
      };
    }

    return prepareDeepBookTransaction(request, walletAddress, requestedMode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepBook execution failed';

    if (!allowLocalFallback) {
      return {
        mode: requestedMode,
        status: 'failed',
        error: message,
        adapter: {
          venue: venueForRequest(request),
          requestedMode,
          mainnetOnly: true,
        },
      };
    }

    return {
      ...simulateDeepBookAction(request),
      error: message,
      warning: `${message} Local simulation fallback used. No funds were submitted.`,
    };
  }
}

export function executionModeFromEnvironment(value?: string): DeepBookExecutionMode {
  return normalizeExecutionMode(value);
}
