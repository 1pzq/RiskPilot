import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AuditPackage, AuditStorageResult } from './types';
import { makePrefixedId } from '../utils/ids';

const AUDIT_DIR = join(process.cwd(), '.riskpilot-data', 'audits');
const memoryAuditStore = new Map<string, AuditPackage>();

function checksumForPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export async function storeAuditPackageLocal(auditPackage: AuditPackage): Promise<AuditStorageResult> {
  const payload = JSON.stringify(auditPackage, null, 2);
  const checksum = checksumForPayload(payload);
  const id = makePrefixedId('local_audit', checksum);
  const localPath = join(AUDIT_DIR, `${id}.json`);

  memoryAuditStore.set(id, auditPackage);

  try {
    await mkdir(AUDIT_DIR, { recursive: true });
    await writeFile(localPath, payload, 'utf8');
  } catch (error) {
    return {
      mode: 'local',
      id,
      provider: 'memory',
      fallback: true,
      checksum,
      sizeBytes: Buffer.byteLength(payload, 'utf8'),
      error: error instanceof Error ? error.message : 'Local audit file write failed.',
      warning: 'Audit package is held in process memory only.',
    };
  }

  return {
    mode: 'local',
    id,
    provider: 'local-file',
    checksum,
    sizeBytes: Buffer.byteLength(payload, 'utf8'),
    localPath,
  };
}
