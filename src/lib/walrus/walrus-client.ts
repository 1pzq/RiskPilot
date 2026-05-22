import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { AuditPackage, AuditStorageResult } from './types';
import { storeAuditPackageLocal } from './local-store';

const execFileAsync = promisify(execFile);

type WalrusUploadResponse = {
  id?: string;
  blobId?: string;
  url?: string;
  newlyCreated?: {
    blobObject?: {
      blobId?: string;
    };
  };
  alreadyCertified?: {
    blobId?: string;
  };
};

type WalrusCliStoreEntry = {
  blobStoreResult?: WalrusUploadResponse;
};

function serializeAuditPackage(auditPackage: AuditPackage): string {
  return JSON.stringify(auditPackage, null, 2);
}

function buildPublisherUploadUrl(publisherUrl: string): string {
  const trimmed = publisherUrl.replace(/\/$/u, '');

  if (trimmed.includes('/v1/blobs')) {
    return trimmed.includes('?') ? trimmed : `${trimmed}?epochs=1`;
  }

  return `${trimmed}/v1/blobs?epochs=1`;
}

function buildAggregatorUrl(aggregatorUrl: string | undefined, blobId: string): string | undefined {
  if (!aggregatorUrl) {
    return undefined;
  }

  return `${aggregatorUrl.replace(/\/$/u, '')}/v1/blobs/${blobId}`;
}

function extractBlobId(payload: WalrusUploadResponse): string | undefined {
  return (
    payload.blobId ??
    payload.id ??
    payload.newlyCreated?.blobObject?.blobId ??
    payload.alreadyCertified?.blobId
  );
}

function extractCliBlobId(payload: unknown): string | undefined {
  if (Array.isArray(payload)) {
    for (const entry of payload as WalrusCliStoreEntry[]) {
      const id = entry.blobStoreResult ? extractBlobId(entry.blobStoreResult) : undefined;

      if (id) {
        return id;
      }
    }
  }

  return extractBlobId(payload as WalrusUploadResponse);
}

export async function storeAuditPackageWalrus(auditPackage: AuditPackage): Promise<AuditStorageResult> {
  const publisherUrl = process.env.WALRUS_PUBLISHER_URL?.trim();
  const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL?.trim();

  if (!publisherUrl) {
    throw new Error('WALRUS_PUBLISHER_URL is not configured.');
  }

  const payload = serializeAuditPackage(auditPackage);
  const response = await fetch(buildPublisherUploadUrl(publisherUrl), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Walrus upload failed with ${response.status}.`);
  }

  const uploadResponse = (await response.json().catch(() => ({}))) as WalrusUploadResponse;
  const id = extractBlobId(uploadResponse);

  if (!id) {
    throw new Error('Walrus upload succeeded but did not return a blob ID.');
  }

  return {
    mode: 'walrus',
    id,
    provider: 'walrus-mainnet-publisher',
    fallback: false,
    sizeBytes: Buffer.byteLength(payload, 'utf8'),
    url: uploadResponse.url ?? buildAggregatorUrl(aggregatorUrl, id),
  };
}

export async function storeAuditPackage(auditPackage: AuditPackage): Promise<AuditStorageResult> {
  const mode = (process.env.WALRUS_MODE ?? 'walrus').toLowerCase();
  const uploadMethod = (process.env.WALRUS_UPLOAD_METHOD ?? 'publisher').toLowerCase();

  if (mode !== 'walrus') {
    const local = await storeAuditPackageLocal(auditPackage);
    return {
      ...local,
      warning: 'WALRUS_MODE is set to local. Audit package was not uploaded to Walrus mainnet.',
    };
  }

  try {
    if (uploadMethod === 'cli') {
      return await storeAuditPackageWalrusCli(auditPackage);
    }

    return await storeAuditPackageWalrus(auditPackage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Walrus upload failed.';
    const fallback = await storeAuditPackageLocal(auditPackage);
    return {
      ...fallback,
      error: message,
      warning:
        uploadMethod === 'cli'
          ? 'Walrus CLI upload was unavailable. Local audit fallback was used.'
          : message.includes('WALRUS_PUBLISHER_URL')
            ? 'Walrus mainnet is not configured. Local audit fallback was used for this run.'
            : 'Walrus mainnet upload was unavailable. Local audit fallback was used.',
      fallback: true,
    };
  }
}

export async function storeAuditPackageWalrusCli(auditPackage: AuditPackage): Promise<AuditStorageResult> {
  const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL?.trim();
  const payload = serializeAuditPackage(auditPackage);
  const tempDir = await mkdtemp(join(tmpdir(), 'riskpilot-walrus-'));
  const tempPath = join(tempDir, `${auditPackage.id}.json`);

  try {
    await writeFile(tempPath, payload, 'utf8');

    const { stdout } = await execFileAsync(
      'walrus',
      ['store', '--context', 'mainnet', '--epochs', '1', '--json', tempPath],
      {
        maxBuffer: 1024 * 1024 * 4,
        timeout: 1000 * 60 * 6,
      },
    );

    const parsed = JSON.parse(stdout) as unknown;
    const id = extractCliBlobId(parsed);

    if (!id) {
      throw new Error('Walrus CLI upload succeeded but did not return a blob ID.');
    }

    return {
      mode: 'walrus',
      id,
      provider: 'walrus-mainnet-cli',
      fallback: false,
      sizeBytes: Buffer.byteLength(payload, 'utf8'),
      url: buildAggregatorUrl(aggregatorUrl, id),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
