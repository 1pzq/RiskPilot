import { fromBase64 } from '@mysten/bcs';
import type { WriteBlobStepRegistered } from '@mysten/walrus';
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';

import { MAINNET_RPC_URL, SUI_COIN_TYPE } from '@/lib/sui/client';
import type { AuditPackage, AuditStorageResult } from './types';
import { assertNoWhatIfPreviewPayload } from './preview-guard';

export const WALRUS_WALLET_ARCHIVE_EPOCHS = 1;
export const MAINNET_WAL_COIN_TYPE =
  '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL';
export const WALRUS_WALLET_UPLOAD_RELAY_URL =
  process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_URL ?? 'https://upload-relay.mainnet.walrus.space';
export const WALRUS_WASM_URL =
  process.env.NEXT_PUBLIC_WALRUS_WASM_URL ??
  'https://unpkg.com/@mysten/walrus-wasm@0.2.2/web/walrus_wasm_bg.wasm';
const DEFAULT_UPLOAD_RELAY_MAX_TIP_MIST = 10_000_000;
const configuredUploadRelayMaxTipMist = Number.parseInt(
  process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_MAX_TIP_MIST ?? '',
  10,
);
export const WALRUS_WALLET_UPLOAD_RELAY_MAX_TIP_MIST =
  Number.isFinite(configuredUploadRelayMaxTipMist) && configuredUploadRelayMaxTipMist > 0
    ? configuredUploadRelayMaxTipMist
    : DEFAULT_UPLOAD_RELAY_MAX_TIP_MIST;
const REGISTER_RECOVERY_LOOKBACK_MS = 10 * 60 * 1000;
const REGISTER_RECOVERY_QUERY_LIMIT = 20;
const CERTIFY_RECOVERY_ATTEMPTS = 5;
const CERTIFY_RECOVERY_DELAY_MS = 1_500;
const WALRUS_BLOB_REGISTERED_EVENT_SUFFIX = '::events::BlobRegistered';
const WALRUS_MIN_SUI_BALANCE_MIST = 20_000_000n;

type WalletArchivePhase = 'encoded' | 'registered' | 'uploaded' | 'certified';

type WalletArchiveProgress = {
  phase: WalletArchivePhase;
  message: string;
};

type WalletChain = `${string}:${string}`;

type SignAndExecute = (input: { transaction: Transaction; chain?: WalletChain }) => Promise<SuiTransactionBlockResponse>;

type WalletArchiveOptions = {
  auditPackage: AuditPackage;
  walletAddress: string;
  signAndExecute: SignAndExecute;
  onProgress?: (progress: WalletArchiveProgress) => void;
};

type WalrusSdk = typeof import('@mysten/walrus');
type WalrusClientInstance = InstanceType<WalrusSdk['WalrusClient']>;
type WriteBlobStepEncoded = Awaited<ReturnType<ReturnType<WalrusClientInstance['writeBlobFlow']>['encode']>>;
type WriteBlobStepUploaded = Awaited<ReturnType<ReturnType<WalrusClientInstance['writeBlobFlow']>['upload']>>;

type WalletWalrusClient = {
  client: WalrusClientInstance;
  suiClient: SuiJsonRpcClient;
  sdk: WalrusSdk;
};

type WalletArchivePreflight = {
  requiredWalMist: bigint;
  availableWalMist: bigint;
  availableSuiMist: bigint;
  walCoinObjectId: string;
};

type RecoveredRegister = {
  digest: string;
  blobObjectId: string;
  warning: string;
};

type RecoveredCertify = {
  digest?: string;
  warning: string;
};

function serializeAuditPackage(auditPackage: AuditPackage): string {
  return JSON.stringify(auditPackage, null, 2);
}

async function sha256Hex(bytes: Uint8Array): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) {
    return undefined;
  }

  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function createWalletWalrusClient(): Promise<WalletWalrusClient> {
  const sdk = await import('@mysten/walrus');
  const suiClient = new SuiJsonRpcClient({ network: 'mainnet', url: MAINNET_RPC_URL });
  const client = new sdk.WalrusClient({
    network: 'mainnet',
    packageConfig: sdk.MAINNET_WALRUS_PACKAGE_CONFIG,
    suiClient,
    wasmUrl: WALRUS_WASM_URL,
    uploadRelay: {
      host: WALRUS_WALLET_UPLOAD_RELAY_URL,
      sendTip: {
        max: WALRUS_WALLET_UPLOAD_RELAY_MAX_TIP_MIST,
      },
    },
  });

  return { client, suiClient, sdk };
}

async function preflightWalletWalrusArchive({
  client,
  suiClient,
  walletAddress,
  payloadBytes,
}: {
  client: WalrusClientInstance;
  suiClient: SuiJsonRpcClient;
  walletAddress: string;
  payloadBytes: Uint8Array;
}): Promise<WalletArchivePreflight> {
  const [{ totalCost, storageCost, writeCost }, walBalance, suiBalance, largestWalCoin] = await Promise.all([
    client.storageCost(payloadBytes.byteLength, WALRUS_WALLET_ARCHIVE_EPOCHS),
    suiClient.getBalance({ owner: walletAddress, coinType: MAINNET_WAL_COIN_TYPE }),
    suiClient.getBalance({ owner: walletAddress, coinType: SUI_COIN_TYPE }),
    findLargestWalCoinObject(suiClient, walletAddress),
  ]);
  const requiredWalMist = totalCost;
  const availableWalMist = BigInt(walBalance.totalBalance);
  const availableSuiMist = BigInt(suiBalance.totalBalance);
  const largestWalCoinBalance = largestWalCoin?.balanceMist ?? 0n;

  if (availableWalMist < requiredWalMist) {
    throw new Error(
      `Walrus archive needs about ${formatMistToken(requiredWalMist, 9, 'WAL')}, but the current wallet only has ${formatMistToken(
        availableWalMist,
        9,
        'WAL',
      )}. The evidence proof is already signed; add WAL, then return to Remember and click archive again.`,
    );
  }

  if (!largestWalCoin || largestWalCoinBalance < requiredWalMist) {
    throw new Error(
      [
        `Walrus archive needs about ${formatMistToken(requiredWalMist, 9, 'WAL')} total, including storage ${formatMistToken(
          storageCost,
          9,
          'WAL',
        )} and write ${formatMistToken(writeCost, 9, 'WAL')}.`,
        `The wallet has ${formatMistToken(availableWalMist, 9, 'WAL')} total WAL, but the largest single WAL coin is only ${formatMistToken(
          largestWalCoinBalance,
          9,
          'WAL',
        )}.`,
        'Merge WAL coins in the wallet first, or use a wallet with one large enough WAL coin before archiving again.',
      ].join(' '),
    );
  }

  if (availableSuiMist < WALRUS_MIN_SUI_BALANCE_MIST) {
    throw new Error(
      `Walrus archive also needs a small SUI balance for register/certify gas. Keep at least ${formatMistToken(
        WALRUS_MIN_SUI_BALANCE_MIST,
        9,
        'SUI',
      )}. The current wallet only has ${formatMistToken(availableSuiMist, 9, 'SUI')}.`,
    );
  }

  return {
    requiredWalMist,
    availableWalMist,
    availableSuiMist,
    walCoinObjectId: largestWalCoin.coinObjectId,
  };
}

async function buildRegisterTransaction({
  client,
  encoded,
  owner,
  payloadBytes,
  walCoinObjectId,
}: {
  client: WalrusClientInstance;
  encoded: WriteBlobStepEncoded;
  owner: string;
  payloadBytes: Uint8Array;
  walCoinObjectId: string;
}): Promise<Transaction> {
  const transaction = new Transaction();
  const rootHash = fromBase64(encoded.rootHash);
  const nonce = encoded.nonce ? fromBase64(encoded.nonce) : new Uint8Array();
  const blobDigest = async () => {
    const buffer = new ArrayBuffer(payloadBytes.byteLength);
    new Uint8Array(buffer).set(payloadBytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(digest);
  };

  transaction.setSenderIfNotSet(owner);
  transaction.add(
    client.sendUploadRelayTip({
      size: encoded.unencodedSize,
      blobDigest,
      nonce,
    }),
  );
  const walCoin = transaction.object(walCoinObjectId) as TransactionObjectArgument;

  transaction.transferObjects(
    [
      client.registerBlob({
        size: encoded.unencodedSize,
        epochs: WALRUS_WALLET_ARCHIVE_EPOCHS,
        blobId: encoded.blobId,
        rootHash,
        deletable: false,
        walCoin,
      }),
    ],
    owner,
  );

  return transaction;
}

function effectsFailed(result: SuiTransactionBlockResponse): string | null {
  const status = result.effects?.status;

  if (status?.status === 'failure') {
    return status.error ?? 'Sui transaction effects reported failure.';
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatMistToken(amount: bigint, decimals: number, symbol: string): string {
  const sign = amount < 0n ? '-' : '';
  const absolute = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = absolute % scale;
  const fractionText = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')
    .slice(0, 6);

  return `${sign}${whole.toString()}${fractionText ? `.${fractionText}` : ''} ${symbol}`;
}

function isWalrusCoinSplitFailure(message: string): boolean {
  return (
    /MoveAbort/i.test(message) &&
    /balance/i.test(message) &&
    /split/i.test(message)
  );
}

function toReadableWalrusArchiveError(error: string): string {
  if (isWalrusCoinSplitFailure(error)) {
    return [
      'Walrus register payment failed: wallet total balance may be enough, but the WAL/SUI coin object used for payment did not split successfully.',
      'The evidence proof is already signed and no transaction was submitted. Merge WAL coins in the wallet or retry with a wallet that has one larger WAL coin.',
    ].join(' ');
  }

  return error;
}

async function findLargestWalCoinObject(
  suiClient: SuiJsonRpcClient,
  walletAddress: string,
): Promise<{ coinObjectId: string; balanceMist: bigint } | null> {
  let cursor: string | null | undefined;
  let largest: { coinObjectId: string; balanceMist: bigint } | null = null;

  do {
    const page = await suiClient.getCoins({
      owner: walletAddress,
      coinType: MAINNET_WAL_COIN_TYPE,
      cursor,
      limit: 50,
    });

    for (const coin of page.data) {
      const balanceMist = BigInt(coin.balance);

      if (!largest || balanceMist > largest.balanceMist) {
        largest = {
          coinObjectId: coin.coinObjectId,
          balanceMist,
        };
      }
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return largest;
}

function isRecoverableWalletResponseError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();

  if (/(reject|rejected|denied|cancel|cancelled|user denied|user rejected)/i.test(message)) {
    return false;
  }

  return /(failed to fetch|networkerror|load failed|fetch|timeout|network request failed)/i.test(message);
}

function normalizedAddress(address: string): string {
  return address.trim().toLowerCase();
}

function isRecentTransaction(timestampMs?: string | null): boolean {
  if (!timestampMs) {
    return true;
  }

  const timestamp = Number(timestampMs);

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return Date.now() - timestamp <= REGISTER_RECOVERY_LOOKBACK_MS;
}

function readRegisteredBlobEvent(
  tx: SuiTransactionBlockResponse,
  encoded: WriteBlobStepEncoded,
  sdk: WalrusSdk,
): { blobObjectId: string } | null {
  const encodedBlobIdInt = sdk.blobIdToInt(encoded.blobId).toString();
  const event = tx.events?.find((candidate) => {
    const parsed = candidate.parsedJson as
      | {
          blob_id?: string | number;
          object_id?: string;
          size?: string | number;
        }
      | undefined;

    return (
      candidate.type.endsWith(WALRUS_BLOB_REGISTERED_EVENT_SUFFIX) &&
      String(parsed?.blob_id ?? '') === encodedBlobIdInt &&
      String(parsed?.size ?? '') === String(encoded.unencodedSize) &&
      typeof parsed?.object_id === 'string' &&
      parsed.object_id.length > 0
    );
  });

  if (!event) {
    return null;
  }

  const parsed = event.parsedJson as { object_id: string };
  return { blobObjectId: parsed.object_id };
}

async function readRegisteredBlobObjectId({
  tx,
  encoded,
  client,
  sdk,
}: {
  tx: SuiTransactionBlockResponse;
  encoded: WriteBlobStepEncoded;
  client: WalrusClientInstance;
  sdk: WalrusSdk;
}): Promise<string | null> {
  const blobType = await client.getBlobType();
  const createdBlob = tx.objectChanges?.find(
    (change) => change.type === 'created' && change.objectType === blobType,
  );

  if (createdBlob?.type === 'created') {
    return createdBlob.objectId;
  }

  return readRegisteredBlobEvent(tx, encoded, sdk)?.blobObjectId ?? null;
}

async function recoverLatestWalrusRegister({
  suiClient,
  walletAddress,
  encoded,
  sdk,
}: {
  suiClient: SuiJsonRpcClient;
  walletAddress: string;
  encoded: WriteBlobStepEncoded;
  sdk: WalrusSdk;
}): Promise<RecoveredRegister | null> {
  const wallet = normalizedAddress(walletAddress);
  const response = await suiClient.queryTransactionBlocks({
    filter: { FromAddress: walletAddress },
    limit: REGISTER_RECOVERY_QUERY_LIMIT,
    order: 'descending',
    options: {
      showEffects: true,
      showEvents: true,
      showInput: true,
      showObjectChanges: true,
    },
  });

  for (const tx of response.data) {
    if (tx.effects?.status?.status !== 'success' || !isRecentTransaction(tx.timestampMs)) {
      continue;
    }

    const sender = tx.transaction?.data.sender;
    if (sender && normalizedAddress(sender) !== wallet) {
      continue;
    }

    const registered = readRegisteredBlobEvent(tx, encoded, sdk);
    if (!registered) {
      continue;
    }

    return {
      digest: tx.digest,
      blobObjectId: registered.blobObjectId,
      warning: `Recovered Walrus register digest after the wallet response was lost: ${tx.digest}.`,
    };
  }

  return null;
}

async function loadBlobObjectPreviousTransaction(
  suiClient: SuiJsonRpcClient,
  blobObjectId: string,
): Promise<string | undefined> {
  const object = await suiClient.getObject({
    id: blobObjectId,
    options: {
      showPreviousTransaction: true,
    },
  });

  return object.data?.previousTransaction ?? undefined;
}

async function recoverWalrusCertifyOnce({
  client,
  suiClient,
  encoded,
  uploaded,
}: {
  client: WalrusClientInstance;
  suiClient: SuiJsonRpcClient;
  encoded: WriteBlobStepEncoded;
  uploaded: WriteBlobStepUploaded;
}): Promise<RecoveredCertify | null> {
  const blobObject = await client.getBlobObject(uploaded.blobObjectId);

  if (blobObject.certified_epoch == null) {
    const verifiedStatus = await client.getVerifiedBlobStatus({ blobId: encoded.blobId }).catch(() => null);
    const certifiedFromStorage =
      verifiedStatus?.type === 'permanent' && verifiedStatus.initialCertifiedEpoch != null;

    if (!certifiedFromStorage) {
      return null;
    }
  }

  const digest = await loadBlobObjectPreviousTransaction(suiClient, uploaded.blobObjectId).catch(() => undefined);

  return {
    digest,
    warning: digest
      ? `Recovered Walrus certify completion after the wallet response was lost: ${digest}.`
      : 'Recovered Walrus certify completion after the wallet response was lost.',
  };
}

async function recoverWalrusCertify({
  client,
  suiClient,
  encoded,
  uploaded,
}: {
  client: WalrusClientInstance;
  suiClient: SuiJsonRpcClient;
  encoded: WriteBlobStepEncoded;
  uploaded: WriteBlobStepUploaded;
}): Promise<RecoveredCertify | null> {
  for (let attempt = 0; attempt < CERTIFY_RECOVERY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(CERTIFY_RECOVERY_DELAY_MS);
    }

    const recovered = await recoverWalrusCertifyOnce({ client, suiClient, encoded, uploaded }).catch(() => null);

    if (recovered) {
      return recovered;
    }
  }

  return null;
}

export async function storeAuditPackageWithConnectedWallet({
  auditPackage,
  walletAddress,
  signAndExecute,
  onProgress,
}: WalletArchiveOptions): Promise<AuditStorageResult> {
  assertNoWhatIfPreviewPayload(
    auditPackage,
    'What-if preview payload cannot be submitted to wallet-paid Walrus archive.',
  );

  const payload = serializeAuditPackage(auditPackage);
  const payloadBytes = new TextEncoder().encode(payload);
  const checksum = await sha256Hex(payloadBytes);
  const { client, suiClient, sdk } = await createWalletWalrusClient();
  const flow = client.writeBlobFlow({ blob: payloadBytes });
  let registerRecoveryWarning: string | undefined;
  let certifyRecoveryWarning: string | undefined;

  onProgress?.({ phase: 'encoded', message: 'Encoding Walrus blob before wallet register.' });
  const encoded = await flow.encode();
  const preflight = await preflightWalletWalrusArchive({
    client,
    suiClient,
    walletAddress,
    payloadBytes,
  });

  onProgress?.({ phase: 'registered', message: 'Wallet confirmation 1/2: register Walrus storage.' });
  let registerResult: SuiTransactionBlockResponse;

  try {
    registerResult = await signAndExecute({
      transaction: await buildRegisterTransaction({
        client,
        encoded,
        owner: walletAddress,
        payloadBytes,
        walCoinObjectId: preflight.walCoinObjectId,
      }),
      chain: 'sui:mainnet',
    });
  } catch (error) {
    if (!isRecoverableWalletResponseError(error)) {
      throw error;
    }

    onProgress?.({
      phase: 'registered',
      message: 'Wallet response was lost. Checking Sui mainnet for the paid Walrus register transaction.',
    });
    const recovered = await recoverLatestWalrusRegister({ suiClient, walletAddress, encoded, sdk });

    if (!recovered) {
      throw new Error(
        `Wallet-paid Walrus register may have succeeded, but the browser did not receive the result and no matching register transaction was found. ${errorMessage(error)}`,
      );
    }

    registerRecoveryWarning = recovered.warning;
    registerResult = {
      digest: recovered.digest,
      effects: {
        status: { status: 'success' },
      },
    } as SuiTransactionBlockResponse;
  }

  const registerError = effectsFailed(registerResult);

  if (registerError) {
    throw new Error(`Wallet-paid Walrus register failed: ${toReadableWalrusArchiveError(registerError)}`);
  }

  const registeredBlobObjectId = await readRegisteredBlobObjectId({
    tx: registerResult,
    encoded,
    client,
    sdk,
  });

  if (!registeredBlobObjectId) {
    throw new Error(
      `Walrus register succeeded, but the wallet response did not include the created Walrus blob object. Register digest: ${registerResult.digest}`,
    );
  }

  const registeredStep: WriteBlobStepRegistered = {
    step: 'registered',
    blobId: encoded.blobId,
    blobObjectId: registeredBlobObjectId,
    txDigest: registerResult.digest,
    ...(encoded.nonce ? { nonce: encoded.nonce } : {}),
  };
  const uploadFlow = client.writeBlobFlow({
    blob: payloadBytes,
    resume: registeredStep,
  });
  await uploadFlow.encode();

  onProgress?.({ phase: 'uploaded', message: 'Registered. Uploading audit package to Walrus relay.' });
  const uploaded = await uploadFlow.upload({
    deletable: false,
  });

  onProgress?.({ phase: 'certified', message: 'Wallet confirmation 2/2: certify Walrus blob.' });
  let certifyDigest: string | undefined;

  try {
    const certifyResult = await signAndExecute({
      transaction: uploadFlow.certify(),
      chain: 'sui:mainnet',
    });
    const certifyError = effectsFailed(certifyResult);

    if (certifyError) {
      throw new Error(`Wallet-paid Walrus certify failed: ${toReadableWalrusArchiveError(certifyError)}`);
    }

    certifyDigest = certifyResult.digest;
  } catch (error) {
    if (!isRecoverableWalletResponseError(error)) {
      throw error;
    }

    onProgress?.({
      phase: 'certified',
      message: 'Wallet certify response was lost. Checking Walrus and Sui mainnet completion state.',
    });
    const recovered = await recoverWalrusCertify({ client, suiClient, encoded, uploaded });

    if (!recovered) {
      throw new Error(
        `Wallet-paid Walrus certify may have succeeded, but the browser did not receive the result and no certified blob state was found. ${errorMessage(error)}`,
      );
    }

    certifyDigest = recovered.digest;
    certifyRecoveryWarning = recovered.warning;
  }

  const certified = await uploadFlow.getBlob();

  return {
    mode: 'walrus',
    id: certified.blobId,
    provider: 'walrus-mainnet-wallet',
    fallback: false,
    sizeBytes: payloadBytes.byteLength,
    archivePayer: 'connected_wallet',
    archiveSigner: 'connected_wallet',
    paymentLabel: 'Connected wallet',
    signerLabel: 'Connected wallet',
    walletPaysArchive: true,
    custodyNote: 'Connected wallet signed and paid the Walrus register/certify transactions.',
    walletAddress,
    blobObjectId: certified.blobObjectId,
    registerDigest: registerResult.digest,
    certifyDigest,
    uploadRelayUrl: WALRUS_WALLET_UPLOAD_RELAY_URL,
    checksum,
    warning: [
      `Walrus preflight passed: needs about ${formatMistToken(preflight.requiredWalMist, 9, 'WAL')}; wallet has ${formatMistToken(
        preflight.availableWalMist,
        9,
        'WAL',
      )}; SUI gas balance ${formatMistToken(preflight.availableSuiMist, 9, 'SUI')}; payment WAL coin ${preflight.walCoinObjectId.slice(
        0,
        10,
      )}...`,
      registerRecoveryWarning,
      certifyRecoveryWarning,
      uploaded.certificate ? undefined : 'Walrus upload in the client flow returned without a certificate.',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  };
}
