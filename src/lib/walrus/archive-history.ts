import type { AuditPackage, AuditStorageResult } from './types';

export const ARCHIVE_HISTORY_STORAGE_KEY = 'riskpilot.archiveHistory.v1';
export const ARCHIVE_HISTORY_LIMIT = 6;
export const WALRUS_READBACK_BASE_URL =
  process.env.NEXT_PUBLIC_WALRUS_READBACK_BASE_URL ?? 'https://aggregator.mainnet.walrus.space/v1/blobs';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ArchiveHistoryEntry = {
  auditId: string;
  createdAt: string;
  walletAddress: string;
  storageId: string;
  blobObjectId?: string;
  registerDigest?: string;
  certifyDigest?: string;
  checksum?: string;
  sizeBytes?: number;
  executionMode: AuditPackage['execution']['mode'];
  executionStatus: AuditPackage['execution']['status'];
  recommendationTitle: string;
  riskBefore: number;
  riskAfter?: number;
  paymentLabel?: string;
  signerLabel?: string;
  readbackUrl?: string;
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
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
};

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function timestampMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function dedupeEntries(entries: ArchiveHistoryEntry[]): ArchiveHistoryEntry[] {
  const seen = new Set<string>();
  const next: ArchiveHistoryEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.auditId}:${entry.storageId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(entry);
  }

  return next;
}

export function buildWalrusReadbackUrl(
  storageResult: Pick<AuditStorageResult, 'id' | 'url'>,
  baseUrl = WALRUS_READBACK_BASE_URL,
): string | undefined {
  if (storageResult.url) {
    return storageResult.url;
  }

  if (!storageResult.id) {
    return undefined;
  }

  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(storageResult.id)}`;
}

export function createArchiveHistoryEntry(
  auditPackage: AuditPackage,
  storageResult: AuditStorageResult,
): ArchiveHistoryEntry {
  return {
    auditId: auditPackage.id,
    createdAt: auditPackage.createdAt,
    walletAddress: auditPackage.walletAddress,
    storageId: storageResult.id,
    blobObjectId: storageResult.blobObjectId,
    registerDigest: storageResult.registerDigest,
    certifyDigest: storageResult.certifyDigest,
    checksum: storageResult.checksum,
    sizeBytes: storageResult.sizeBytes,
    executionMode: auditPackage.execution.mode,
    executionStatus: auditPackage.execution.status,
    recommendationTitle: auditPackage.recommendation.title,
    riskBefore: auditPackage.riskReportBefore.overallScore,
    riskAfter: auditPackage.riskReportAfter?.overallScore,
    paymentLabel: storageResult.paymentLabel,
    signerLabel: storageResult.signerLabel,
    readbackUrl: buildWalrusReadbackUrl(storageResult),
    receiptProof: auditPackage.receiptProof,
    auditPackage,
    storageResult,
  };
}

export function normalizeArchiveHistoryEntry(value: unknown): ArchiveHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const auditPackage = value.auditPackage;
  const storageResult = value.storageResult;

  if (!isRecord(auditPackage) || !isRecord(storageResult)) {
    return null;
  }

  const auditId = stringValue(value.auditId) ?? stringValue(auditPackage.id);
  const storageId = stringValue(value.storageId) ?? stringValue(storageResult.id);
  const createdAt = stringValue(value.createdAt) ?? stringValue(auditPackage.createdAt);
  const walletAddress = stringValue(value.walletAddress) ?? stringValue(auditPackage.walletAddress);
  const execution = isRecord(auditPackage.execution) ? auditPackage.execution : null;
  const recommendation = isRecord(auditPackage.recommendation) ? auditPackage.recommendation : null;
  const riskBefore = isRecord(auditPackage.riskReportBefore) ? auditPackage.riskReportBefore : null;
  const riskAfter = isRecord(auditPackage.riskReportAfter) ? auditPackage.riskReportAfter : null;
  const executionMode = stringValue(value.executionMode) ?? stringValue(execution?.mode);
  const executionStatus = stringValue(value.executionStatus) ?? stringValue(execution?.status);
  const recommendationTitle = stringValue(value.recommendationTitle) ?? stringValue(recommendation?.title);
  const riskBeforeScore = numberValue(value.riskBefore) ?? numberValue(riskBefore?.overallScore);
  const receiptProofValue = isRecord(value.receiptProof)
    ? {
        strategyId: stringValue(value.receiptProof.strategyId),
        policyObjectId: stringValue(value.receiptProof.policyObjectId),
        auditBlobId: stringValue(value.receiptProof.auditBlobId),
        executionDigest: stringValue(value.receiptProof.executionDigest),
        receiptDigest: stringValue(value.receiptProof.receiptDigest),
        receiptObjectId: stringValue(value.receiptProof.receiptObjectId),
        signer: stringValue(value.receiptProof.signer),
        mintedAt: stringValue(value.receiptProof.mintedAt),
      }
    : null;
  const receiptProof =
    receiptProofValue?.strategyId &&
    receiptProofValue.auditBlobId &&
    receiptProofValue.executionDigest &&
    receiptProofValue.receiptDigest &&
    receiptProofValue.signer &&
    receiptProofValue.mintedAt
      ? {
          strategyId: receiptProofValue.strategyId,
          policyObjectId: receiptProofValue.policyObjectId,
          auditBlobId: receiptProofValue.auditBlobId,
          executionDigest: receiptProofValue.executionDigest,
          receiptDigest: receiptProofValue.receiptDigest,
          receiptObjectId: receiptProofValue.receiptObjectId,
          signer: receiptProofValue.signer,
          mintedAt: receiptProofValue.mintedAt,
        }
      : undefined;

  if (
    !auditId ||
    !storageId ||
    !createdAt ||
    !walletAddress ||
    !executionMode ||
    !executionStatus ||
    !recommendationTitle ||
    riskBeforeScore == null
  ) {
    return null;
  }

  return {
    auditId,
    createdAt,
    walletAddress,
    storageId,
    blobObjectId: stringValue(value.blobObjectId) ?? stringValue(storageResult.blobObjectId),
    registerDigest: stringValue(value.registerDigest) ?? stringValue(storageResult.registerDigest),
    certifyDigest: stringValue(value.certifyDigest) ?? stringValue(storageResult.certifyDigest),
    checksum: stringValue(value.checksum) ?? stringValue(storageResult.checksum),
    sizeBytes: numberValue(value.sizeBytes) ?? numberValue(storageResult.sizeBytes),
    executionMode: executionMode as ArchiveHistoryEntry['executionMode'],
    executionStatus: executionStatus as ArchiveHistoryEntry['executionStatus'],
    recommendationTitle,
    riskBefore: riskBeforeScore,
    riskAfter: numberValue(value.riskAfter) ?? numberValue(riskAfter?.overallScore),
    paymentLabel: stringValue(value.paymentLabel) ?? stringValue(storageResult.paymentLabel),
    signerLabel: stringValue(value.signerLabel) ?? stringValue(storageResult.signerLabel),
    readbackUrl:
      stringValue(value.readbackUrl) ??
      buildWalrusReadbackUrl(storageResult as Pick<AuditStorageResult, 'id' | 'url'>),
    receiptProof,
    auditPackage: auditPackage as AuditPackage,
    storageResult: storageResult as AuditStorageResult,
  };
}

export function saveArchiveReceiptProof(
  input: {
    auditId: string;
    storageId: string;
    receiptProof: NonNullable<ArchiveHistoryEntry['receiptProof']>;
  },
  storage: StorageLike | null = getBrowserStorage(),
): ArchiveHistoryEntry[] {
  const next = readArchiveHistory(storage);
  const updated = next.map((entry) => {
    if (entry.auditId !== input.auditId || entry.storageId !== input.storageId) {
      return entry;
    }

    const auditPackage = {
      ...entry.auditPackage,
      receiptProof: input.receiptProof,
    };

    return {
      ...entry,
      receiptProof: input.receiptProof,
      auditPackage,
    };
  });

  if (storage) {
    storage.setItem(ARCHIVE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  }

  return updated;
}

export function readArchiveHistory(storage: StorageLike | null = getBrowserStorage()): ArchiveHistoryEntry[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(ARCHIVE_HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return dedupeEntries(parsed.map(normalizeArchiveHistoryEntry).filter((entry): entry is ArchiveHistoryEntry => Boolean(entry)))
      .sort((left, right) => timestampMs(right.createdAt) - timestampMs(left.createdAt))
      .slice(0, ARCHIVE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveArchiveHistoryEntry(
  entry: ArchiveHistoryEntry,
  storage: StorageLike | null = getBrowserStorage(),
): ArchiveHistoryEntry[] {
  const next = dedupeEntries([entry, ...readArchiveHistory(storage)])
    .sort((left, right) => timestampMs(right.createdAt) - timestampMs(left.createdAt))
    .slice(0, ARCHIVE_HISTORY_LIMIT);

  if (storage) {
    storage.setItem(ARCHIVE_HISTORY_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

export function clearArchiveHistory(storage: StorageLike | null = getBrowserStorage()): ArchiveHistoryEntry[] {
  if (storage) {
    storage.removeItem(ARCHIVE_HISTORY_STORAGE_KEY);
  }

  return [];
}
