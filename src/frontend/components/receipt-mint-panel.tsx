'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';
import { CheckCircle2, FileCheck2, Link2, Wallet } from 'lucide-react';

import type { AuditPackage, AuditStorageResult } from '@/lib/walrus/types';
import {
  buildReceiptMintTransaction,
  extractReceiptObjectId,
  RECEIPT_PACKAGE_ID,
} from '@/lib/sui/receipt';
import { formatAddress } from '@/lib/utils/format';

type ReceiptMintPanelProps = {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
};

type ReceiptStatus = 'idle' | 'success' | 'error';

export function ReceiptMintPanel({ auditPackage, storageResult }: ReceiptMintPanelProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [status, setStatus] = useState<ReceiptStatus>('idle');
  const [digest, setDigest] = useState('');
  const [receiptObjectId, setReceiptObjectId] = useState('');
  const [error, setError] = useState('');

  const signAndExecute = useSignAndExecuteTransaction<SuiTransactionBlockResponse>({
    execute: ({ bytes, signature }) =>
      client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      }),
  });

  const isWalrusArchive = storageResult.mode === 'walrus';
  const canMint = Boolean(
    RECEIPT_PACKAGE_ID && account && isWalrusArchive && !signAndExecute.isPending && status !== 'success',
  );
  const executionDigest =
    auditPackage.execution.digest ??
    auditPackage.execution.simulationId ??
    auditPackage.execution.preparedTransactionSummary ??
    auditPackage.id;

  async function handleMintReceipt() {
    if (!RECEIPT_PACKAGE_ID) {
      setStatus('error');
      setError('Receipt package is not configured.');
      return;
    }

    if (!account) {
      setStatus('error');
      setError('Connect a Sui mainnet wallet before minting the receipt.');
      return;
    }

    if (!isWalrusArchive) {
      setStatus('error');
      setError('Archive to Walrus mainnet before minting an on-chain receipt.');
      return;
    }

    setStatus('idle');
    setError('');

    try {
      const tx = buildReceiptMintTransaction({
        strategyId: auditPackage.recommendation.id,
        auditBlobId: storageResult.id,
        executionDigest,
      });

      const result = await signAndExecute.mutateAsync({ transaction: tx });
      const mintedObjectId = extractReceiptObjectId(result.objectChanges);

      setDigest(result.digest);
      setReceiptObjectId(mintedObjectId ?? '');
      setStatus('success');
    } catch (mintError) {
      setStatus('error');
      setError(mintError instanceof Error ? mintError.message : 'Receipt mint failed.');
    }
  }

  return (
    <section className="panel receiptMintPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">On-chain receipt</p>
          <h2 className="panelTitle">Mint StrategyReceipt</h2>
        </div>
        <span className={`pill ${status === 'success' ? 'pillSuccess' : 'pillWarn'}`}>
          {status === 'success' ? 'minted' : 'optional'}
        </span>
      </div>

      <div className="receiptStampRow" aria-hidden="true">
        <span className="pixelBadge pixelBadgeBlue">SUI</span>
        <span className="pixelBadge pixelBadgeMint">WAL</span>
        <span className="pixelBadge pixelBadgePurple">RCPT</span>
      </div>

      <div className="ticketRows">
        <div className="ticketRow">
          <span>Package</span>
          <strong>{RECEIPT_PACKAGE_ID ? formatAddress(RECEIPT_PACKAGE_ID) : 'Not configured'}</strong>
        </div>
        <div className="ticketRow">
          <span>Walrus blob</span>
          <strong>{formatAddress(storageResult.id)}</strong>
        </div>
        <div className="ticketRow">
          <span>Signer</span>
          <strong>{account ? formatAddress(account.address) : 'Connect wallet'}</strong>
        </div>
      </div>

      <button
        className="button buttonPrimary receiptMintButton"
        type="button"
        onClick={() => void handleMintReceipt()}
        disabled={!canMint}
      >
        {status === 'success' ? 'Receipt minted' : signAndExecute.isPending ? 'Waiting for wallet…' : 'Mint on-chain receipt'}
      </button>

      {!account ? (
        <div className="noteRow">
          <Wallet size={14} />
          <span>Connect a Sui mainnet wallet to mint the receipt object.</span>
        </div>
      ) : null}

      {!isWalrusArchive ? (
        <div className="warningStrip inline">Receipt minting is enabled after a Walrus mainnet archive.</div>
      ) : null}

      {status === 'success' ? (
        <div className="receiptResult">
          <div>
            <CheckCircle2 size={16} />
            <span>Receipt transaction</span>
            <strong>{digest}</strong>
          </div>
          <div>
            <FileCheck2 size={16} />
            <span>Receipt object</span>
            <strong>{receiptObjectId || 'Created object pending in wallet response'}</strong>
          </div>
        </div>
      ) : null}

      {status === 'error' ? <div className="warningStrip inline">{error}</div> : null}

      <div className="noteRow">
        <Link2 size={14} />
        <span>Minting records the strategy ID, Walrus blob ID, and prepared execution ID on Sui mainnet.</span>
      </div>
    </section>
  );
}
