import type { AuditPackage } from './types';
import { makePrefixedId } from '@/lib/utils/ids';

export function createAuditPackage(input: Omit<AuditPackage, 'id' | 'createdAt'>): AuditPackage {
  const createdAt = new Date().toISOString();
  const id = makePrefixedId('audit', JSON.stringify({ createdAt, ...input }));

  return {
    id,
    createdAt,
    ...input,
  };
}

