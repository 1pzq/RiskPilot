import type { AuditPackage, AuditStorageResult } from './types';

export const SERVER_WALRUS_ARCHIVE_DISABLED_MESSAGE =
  'Server-side Walrus archive is disabled. Use connected-wallet Walrus archive so the connected wallet signs and pays storage.';

export async function storeAuditPackage(auditPackage: AuditPackage): Promise<AuditStorageResult> {
  void auditPackage;

  throw new Error(SERVER_WALRUS_ARCHIVE_DISABLED_MESSAGE);
}
