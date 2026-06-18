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
      `Walrus 归档需要约 ${formatMistToken(requiredWalMist, 9, 'WAL')}，当前钱包只有 ${formatMistToken(
        availableWalMist,
        9,
        'WAL',
      )}。准备证明已经签好；补充 WAL 后回到 Remember 重新点击归档。`,
    );
  }

  if (!largestWalCoin || largestWalCoinBalance < requiredWalMist) {
    throw new Error(
      [
        `Walrus 归档总共需要约 ${formatMistToken(requiredWalMist, 9, 'WAL')}，其中 storage ${formatMistToken(
          storageCost,
          9,
          'WAL',
        )}、write ${formatMistToken(writeCost, 9, 'WAL')}。`,
        `当前钱包总 WAL 是 ${formatMistToken(availableWalMist, 9, 'WAL')}，但最大的单个 WAL coin 只有 ${formatMistToken(
          largestWalCoinBalance,
          9,
          'WAL',
        )}。`,
        '请先在钱包里合并 WAL coin，或换一个单个 WAL coin 足够大的钱包后再归档。',
      ].join(' '),
    );
  }

  if (availableSuiMist < WALRUS_MIN_SUI_BALANCE_MIST) {
    throw new Error(
      `Walrus 归档还需要少量 SUI 支付 register/certify gas，建议至少保留 ${formatMistToken(
        WALRUS_MIN_SUI_BALANCE_MIST,
        9,
        'SUI',
      )}。当前钱包只有 ${formatMistToken(availableSuiMist, 9, 'SUI')}。`,
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
      'Walrus 注册付款失败：钱包总余额可能够，但用于付款的 WAL/SUI coin object 没有成功拆分。',
      '准备证明已经签好，交易没有提交；可以先在钱包里合并 WAL coin 或换一个有单个大额 WAL coin 的钱包后重试归档。',
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
    'What-if 预览 payload 不能提交到钱包支付的 Walrus 归档。',
  );

  const payload = serializeAuditPackage(auditPackage);
  const payloadBytes = new TextEncoder().encode(payload);
  const checksum = await sha256Hex(payloadBytes);
  const { client, suiClient, sdk } = await createWalletWalrusClient();
  const flow = client.writeBlobFlow({ blob: payloadBytes });
  let registerRecoveryWarning: string | undefined;
  let certifyRecoveryWarning: string | undefined;

  onProgress?.({ phase: 'encoded', message: '钱包 register 前正在编码 Walrus blob。' });
  const encoded = await flow.encode();
  const preflight = await preflightWalletWalrusArchive({
    client,
    suiClient,
    walletAddress,
    payloadBytes,
  });

  onProgress?.({ phase: 'registered', message: '钱包确认 1/2：注册 Walrus 存储。' });
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
      message: '钱包响应丢失。正在检查 Sui mainnet 上已支付的 Walrus register 交易。',
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
      `Walrus register 已成功，但钱包响应里没有找到新建的 Walrus blob object。Register digest: ${registerResult.digest}`,
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

  onProgress?.({ phase: 'uploaded', message: '已注册。正在上传审计包到 Walrus relay。' });
  const uploaded = await uploadFlow.upload({
    deletable: false,
  });

  onProgress?.({ phase: 'certified', message: '钱包确认 2/2：认证 Walrus blob。' });
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
      message: '钱包 certify 响应丢失。正在检查 Walrus 和 Sui mainnet 完成状态。',
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
    paymentLabel: '已连接钱包',
    signerLabel: '已连接钱包',
    walletPaysArchive: true,
    custodyNote: '已连接钱包签名并支付了 Walrus register/certify 交易。',
    walletAddress,
    blobObjectId: certified.blobObjectId,
    registerDigest: registerResult.digest,
    certifyDigest,
    uploadRelayUrl: WALRUS_WALLET_UPLOAD_RELAY_URL,
    checksum,
    warning: [
      `Walrus 预检通过：约需 ${formatMistToken(preflight.requiredWalMist, 9, 'WAL')}，钱包有 ${formatMistToken(
        preflight.availableWalMist,
        9,
        'WAL',
      )}；SUI gas 余额 ${formatMistToken(preflight.availableSuiMist, 9, 'SUI')}；付款 WAL coin ${preflight.walCoinObjectId.slice(
        0,
        10,
      )}…。`,
      registerRecoveryWarning,
      certifyRecoveryWarning,
      uploaded.certificate ? undefined : '客户端流程中的 Walrus 上传返回时没有 certificate。',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  };
}
