import type { SuiObjectChange } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';

export const RECEIPT_PACKAGE_ID = process.env.NEXT_PUBLIC_RECEIPT_PACKAGE_ID?.trim() ?? '';

type BuildReceiptMintTransactionInput = {
  strategyId: string;
  auditBlobId: string;
  executionDigest: string;
  packageId?: string;
};

export function buildReceiptMintTransaction({
  strategyId,
  auditBlobId,
  executionDigest,
  packageId = RECEIPT_PACKAGE_ID,
}: BuildReceiptMintTransactionInput) {
  if (!packageId) {
    throw new Error('NEXT_PUBLIC_RECEIPT_PACKAGE_ID is not configured.');
  }

  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::strategy_receipt::mint`,
    arguments: [
      tx.pure.string(strategyId),
      tx.pure.string(auditBlobId),
      tx.pure.string(executionDigest),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function extractReceiptObjectId(
  objectChanges: SuiObjectChange[] | null | undefined,
  packageId = RECEIPT_PACKAGE_ID,
) {
  const expectedType = packageId ? `${packageId}::strategy_receipt::StrategyReceipt` : '';

  const createdReceipt = objectChanges?.find((change) => {
    if (change.type !== 'created') {
      return false;
    }

    return expectedType
      ? change.objectType === expectedType
      : change.objectType.endsWith('::strategy_receipt::StrategyReceipt');
  });

  return createdReceipt?.type === 'created' ? createdReceipt.objectId : undefined;
}
