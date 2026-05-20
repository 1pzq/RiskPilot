import type { AuditPackage, AuditStorageResult } from './types';
import { storeAuditPackageLocal } from './local-store';

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
    provider: 'walrus-mainnet',
    fallback: false,
    sizeBytes: Buffer.byteLength(payload, 'utf8'),
    url: uploadResponse.url ?? buildAggregatorUrl(aggregatorUrl, id),
  };
}

export async function storeAuditPackage(auditPackage: AuditPackage): Promise<AuditStorageResult> {
  const mode = (process.env.WALRUS_MODE ?? 'walrus').toLowerCase();

  if (mode !== 'walrus') {
    const local = await storeAuditPackageLocal(auditPackage);
    return {
      ...local,
      warning: 'WALRUS_MODE is set to local. Audit package was not uploaded to Walrus mainnet.',
    };
  }

  try {
    return await storeAuditPackageWalrus(auditPackage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Walrus upload failed.';
    const fallback = await storeAuditPackageLocal(auditPackage);
    return {
      ...fallback,
      error: message,
      warning: message.includes('WALRUS_PUBLISHER_URL')
        ? 'Walrus mainnet is not configured. Local audit fallback was used for this demo.'
        : 'Walrus mainnet upload was unavailable. Local audit fallback was used.',
      fallback: true,
    };
  }
}
