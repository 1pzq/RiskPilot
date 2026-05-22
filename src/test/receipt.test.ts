import { describe, expect, it } from 'vitest';

import { buildReceiptMintTransaction, extractReceiptObjectId } from '../lib/sui/receipt';

const PACKAGE_ID = '0x3f889b1dba8796715690b5b78f6bc7ca0f248a45368649b8116f982bda847b19';

describe('receipt transaction helpers', () => {
  it('requires a receipt package id before building a mint transaction', () => {
    expect(() =>
      buildReceiptMintTransaction({
        strategyId: 'strategy',
        auditBlobId: 'blob',
        executionDigest: 'digest',
        packageId: '',
      }),
    ).toThrow('NEXT_PUBLIC_RECEIPT_PACKAGE_ID');
  });

  it('extracts the created StrategyReceipt object id from transaction object changes', () => {
    const objectId = extractReceiptObjectId(
      [
        {
          type: 'created',
          sender: '0xsender',
          owner: { AddressOwner: '0xsender' },
          objectId: '0xreceipt',
          objectType: `${PACKAGE_ID}::strategy_receipt::StrategyReceipt`,
          version: '1',
          digest: 'object_digest',
        },
      ],
      PACKAGE_ID,
    );

    expect(objectId).toBe('0xreceipt');
  });
});
