import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_HISTORY_LIMIT,
  ARCHIVE_HISTORY_STORAGE_KEY,
  buildWalrusReadbackUrl,
  createArchiveHistoryEntry,
  readArchiveHistory,
  saveArchiveHistoryEntry,
} from '@/lib/walrus/archive-history';
import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function buildAuditPackage(id: string, createdAt: string): AuditPackage {
  return {
    id,
    createdAt,
    walletAddress: '0xabc',
    recommendation: {
      title: 'Prepare SUI downside protection',
    },
    riskReportBefore: {
      overallScore: 72,
    },
    riskReportAfter: {
      overallScore: 58,
    },
    execution: {
      mode: 'prepare_mainnet',
      status: 'prepared',
    },
  } as AuditPackage;
}

function buildStorageResult(id: string): AuditStorageResult {
  return {
    mode: 'walrus',
    id,
    provider: 'walrus-mainnet-wallet',
    archivePayer: 'connected_wallet',
    archiveSigner: 'connected_wallet',
    paymentLabel: 'Connected wallet',
    signerLabel: 'Connected wallet',
    walletPaysArchive: true,
    walletAddress: '0xabc',
    blobObjectId: `0xblob_${id}`,
    registerDigest: `register_${id}`,
    certifyDigest: `certify_${id}`,
    checksum: `checksum_${id}`,
    sizeBytes: 1234,
  };
}

describe('archive history', () => {
  it('builds a reusable local history entry with Walrus evidence fields', () => {
    const entry = createArchiveHistoryEntry(
      buildAuditPackage('audit_1', '2026-05-28T00:00:00.000Z'),
      buildStorageResult('blob_1'),
    );

    expect(entry).toMatchObject({
      auditId: 'audit_1',
      storageId: 'blob_1',
      blobObjectId: '0xblob_blob_1',
      registerDigest: 'register_blob_1',
      certifyDigest: 'certify_blob_1',
      executionMode: 'prepare_mainnet',
      executionStatus: 'prepared',
      riskBefore: 72,
      riskAfter: 58,
    });
    expect(entry.readbackUrl).toContain('/blob_1');
  });

  it('persists newest archives first and caps the local history', () => {
    const storage = new MemoryStorage();

    for (let index = 0; index < ARCHIVE_HISTORY_LIMIT + 2; index += 1) {
      saveArchiveHistoryEntry(
        createArchiveHistoryEntry(
          buildAuditPackage(`audit_${index}`, `2026-05-28T00:0${index}:00.000Z`),
          buildStorageResult(`blob_${index}`),
        ),
        storage,
      );
    }

    const history = readArchiveHistory(storage);

    expect(history).toHaveLength(ARCHIVE_HISTORY_LIMIT);
    expect(history[0].auditId).toBe('audit_7');
    expect(history.at(-1)?.auditId).toBe('audit_2');
  });

  it('drops malformed local records instead of crashing readback', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      ARCHIVE_HISTORY_STORAGE_KEY,
      JSON.stringify([
        { auditId: 'bad_record' },
        createArchiveHistoryEntry(
          buildAuditPackage('audit_ok', '2026-05-28T00:00:00.000Z'),
          buildStorageResult('blob_ok'),
        ),
      ]),
    );

    expect(readArchiveHistory(storage).map((entry) => entry.auditId)).toEqual(['audit_ok']);
  });

  it('prefers a storage-provided readback url when present', () => {
    expect(buildWalrusReadbackUrl({ id: 'blob_1', url: 'https://example.test/blob_1' })).toBe(
      'https://example.test/blob_1',
    );
  });
});
