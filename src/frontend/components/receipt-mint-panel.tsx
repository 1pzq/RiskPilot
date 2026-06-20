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
import { executionDigestForReceipt } from '@/lib/sui/prepared-ptb';
import { formatAddress } from '@/lib/utils/format';

type ReceiptMintPanelProps = {
  auditPackage: AuditPackage;
  storageResult: AuditStorageResult;
  onReceiptMinted?: (proof: NonNullable<AuditPackage['receiptProof']>) => void;
};

type ReceiptStatus = 'idle' | 'success' | 'error';

export function ReceiptMintPanel({ auditPackage, storageResult, onReceiptMinted }: ReceiptMintPanelProps) {
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

  const canMint = Boolean(
    RECEIPT_PACKAGE_ID && account && !signAndExecute.isPending && status !== 'success',
  );
  const executionDigest =
    executionDigestForReceipt({
      signedPreparedPtb: auditPackage.execution.signedPreparedPtb,
      digest: auditPackage.execution.digest,
      preparedTransactionSummary: auditPackage.execution.preparedTransactionSummary,
      fallbackId: auditPackage.id,
    });

  async function handleMintReceipt() {
    if (!RECEIPT_PACKAGE_ID) {
      setStatus('error');
      setError('Receipt package is not configured.');
      return;
    }

    if (!account) {
      setStatus('error');
      setError('Connect a Sui mainnet wallet before minting a receipt.');
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

      const result = await signAndExecute.mutateAsync({ transaction: tx, chain: 'sui:mainnet' });
      const mintedObjectId = extractReceiptObjectId(result.objectChanges);
      const receiptProof = {
        strategyId: auditPackage.recommendation.id,
        policyObjectId: auditPackage.policyObjectId,
        auditBlobId: storageResult.id,
        executionDigest,
        receiptDigest: result.digest,
        receiptObjectId: mintedObjectId,
        signer: account.address,
        mintedAt: new Date().toISOString(),
      };

      setDigest(result.digest);
      setReceiptObjectId(mintedObjectId ?? '');
      setStatus('success');
      onReceiptMinted?.(receiptProof);
    } catch (mintError) {
      setStatus('error');
      setError(mintError instanceof Error ? mintError.message : 'Receipt mint failed.');
    }
  }

  return (
    <section className="panel receiptMintPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Post-archive proof</p>
          <h2 className="panelTitle">Mint StrategyReceipt</h2>
        </div>
        <span className={`pill ${status === 'success' ? 'pillSuccess' : 'pillWarn'}`}>
          {status === 'success' ? 'Minted' : 'Optional'}
        </span>
      </div>

      <div className="receiptStampRow" aria-hidden="true">
        <span className="pixelBadge pixelBadgeBlue">SUI</span>
        <span className="pixelBadge pixelBadgeMint">WAL</span>
        <span className="pixelBadge pixelBadgePurple">RCPT</span>
      </div>

      <div className="receiptProofPreview" aria-label="StrategyReceipt fields before mint">
        <div>
          <span>Record</span>
          <strong>Strategy ID</strong>
          <small>{auditPackage.recommendation.id}</small>
        </div>
        <div>
          <span>Link</span>
          <strong>Walrus blob ID</strong>
          <small>{storageResult.id}</small>
        </div>
        <div>
          <span>Separate</span>
          <strong>Execution digest</strong>
          <small>{executionDigest}</small>
        </div>
        <div>
          <span>Authority</span>
          <strong>AgentPolicy object</strong>
          <small>{auditPackage.policyObjectId ?? 'Not selected'}</small>
        </div>
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
          <span>Receipt signer</span>
          <strong>{account ? formatAddress(account.address) : 'Connect wallet'}</strong>
        </div>
        <div className="ticketRow">
          <span>Policy object</span>
          <strong>{auditPackage.policyObjectId ? formatAddress(auditPackage.policyObjectId) : 'Not bound'}</strong>
        </div>
        <div className="ticketRow">
          <span>Archive payer</span>
          <strong>{storageResult.paymentLabel ?? 'Connected wallet'}</strong>
        </div>
      </div>

      <button
        className="button buttonPrimary receiptMintButton"
        type="button"
        onClick={() => void handleMintReceipt()}
        disabled={!canMint}
      >
        {status === 'success' ? 'Receipt minted' : signAndExecute.isPending ? 'Awaiting wallet...' : 'Mint archive receipt'}
      </button>

      {!account ? (
        <div className="noteRow">
          <Wallet size={14} />
          <span>Connect a Sui mainnet wallet to mint the receipt object.</span>
        </div>
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
            <strong>{receiptObjectId || 'Object creation pending in wallet response'}</strong>
          </div>
        </div>
      ) : null}

      {status === 'error' ? <div className="warningStrip inline">{error}</div> : null}

      <div className="noteRow">
        <Link2 size={14} />
        <span>Mint links the key archive fields into a receipt.</span>
      </div>
    </section>
  );
}
