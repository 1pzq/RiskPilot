import { stableHash } from '../utils/ids';

export type DeepBookExecutionMode = 'prepare_mainnet' | 'mainnet';

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
  error?: string;
  preparedTransactionSummary?: string;
  transactionBytes?: string;
  warning?: string;
  adapter: {
    venue: 'DeepBook mainnet' | 'DeepBook Predict mainnet';
    requestedMode: DeepBookExecutionMode;
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

function summarizeRequest(request: DeepBookExecutionRequest): string {
  const kind = request.kind === 'predict_binary' ? 'DeepBook Predict binary' : 'DeepBook spot';
  return `${kind}: ${request.side.toUpperCase()} ${request.amountUsd.toFixed(2)} USD of ${request.assetIn} into ${request.assetOut} on ${request.market}`;
}

function venueForRequest(request: DeepBookExecutionRequest): 'DeepBook mainnet' | 'DeepBook Predict mainnet' {
  return request.kind === 'predict_binary' ? 'DeepBook Predict mainnet' : 'DeepBook mainnet';
}

function normalizeExecutionMode(value?: string | null): DeepBookExecutionMode {
  if (value === 'prepare_mainnet' || value === 'mainnet') {
    return value;
  }

  if (value === 'live') {
    return 'mainnet';
  }

  return 'prepare_mainnet';
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
    authority: {
      signer: 'none',
      payer: 'none',
      signerLabel: 'No wallet signature',
      payerLabel: 'No on-chain payment',
      walletAddress,
      note: 'Prepared mainnet action only records intent; the connected wallet signs only after live mode is explicitly selected.',
    },
  };
}

export async function executeDeepBookTransaction(
  request: DeepBookExecutionRequest,
  walletAddress: string,
  options?: {
    requestedMode?: string | null;
  },
): Promise<DeepBookExecutionResult> {
  const requestedMode = normalizeExecutionMode(options?.requestedMode);

  try {
    if (requestedMode === 'mainnet') {
      return {
        ...prepareDeepBookTransaction(request, walletAddress, requestedMode),
        warning:
          'This action is not connected to live mainnet submission yet, so it was converted to a prepared mainnet action.',
      };
    }

    return prepareDeepBookTransaction(request, walletAddress, requestedMode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepBook execution failed';

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
}

export function executionModeFromEnvironment(value?: string): DeepBookExecutionMode {
  return normalizeExecutionMode(value);
}
