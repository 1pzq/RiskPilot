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
      setError('Receipt package 未配置。');
      return;
    }

    if (!account) {
      setStatus('error');
      setError('mint receipt 前请先连接 Sui mainnet 钱包。');
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
      setError(mintError instanceof Error ? mintError.message : 'Receipt mint 失败。');
    }
  }

  return (
    <section className="panel receiptMintPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">归档后证明</p>
          <h2 className="panelTitle">Mint StrategyReceipt</h2>
        </div>
        <span className={`pill ${status === 'success' ? 'pillSuccess' : 'pillWarn'}`}>
          {status === 'success' ? '已 mint' : '可选'}
        </span>
      </div>

      <div className="receiptStampRow" aria-hidden="true">
        <span className="pixelBadge pixelBadgeBlue">SUI</span>
        <span className="pixelBadge pixelBadgeMint">WAL</span>
        <span className="pixelBadge pixelBadgePurple">RCPT</span>
      </div>

      <div className="receiptProofPreview" aria-label="StrategyReceipt fields before mint">
        <div>
          <span>记录</span>
          <strong>Strategy ID</strong>
          <small>{auditPackage.recommendation.id}</small>
        </div>
        <div>
          <span>链接</span>
          <strong>Walrus blob ID</strong>
          <small>{storageResult.id}</small>
        </div>
        <div>
          <span>分离</span>
          <strong>Execution digest</strong>
          <small>{executionDigest}</small>
        </div>
        <div>
          <span>授权</span>
          <strong>AgentPolicy object</strong>
          <small>{auditPackage.policyObjectId ?? '未选择'}</small>
        </div>
      </div>

      <div className="ticketRows">
        <div className="ticketRow">
          <span>Package</span>
          <strong>{RECEIPT_PACKAGE_ID ? formatAddress(RECEIPT_PACKAGE_ID) : '未配置'}</strong>
        </div>
        <div className="ticketRow">
          <span>Walrus blob</span>
          <strong>{formatAddress(storageResult.id)}</strong>
        </div>
        <div className="ticketRow">
          <span>Receipt 签名者</span>
          <strong>{account ? formatAddress(account.address) : '连接钱包'}</strong>
        </div>
        <div className="ticketRow">
          <span>Policy object</span>
          <strong>{auditPackage.policyObjectId ? formatAddress(auditPackage.policyObjectId) : '未绑定'}</strong>
        </div>
        <div className="ticketRow">
          <span>归档支付方</span>
          <strong>{storageResult.paymentLabel ?? '已连接钱包'}</strong>
        </div>
      </div>

      <button
        className="button buttonPrimary receiptMintButton"
        type="button"
        onClick={() => void handleMintReceipt()}
        disabled={!canMint}
      >
        {status === 'success' ? 'Receipt 已 mint' : signAndExecute.isPending ? '等待钱包…' : 'Mint 归档后 receipt'}
      </button>

      {!account ? (
        <div className="noteRow">
          <Wallet size={14} />
          <span>连接 Sui mainnet 钱包以 mint receipt 对象。</span>
        </div>
      ) : null}

      {status === 'success' ? (
        <div className="receiptResult">
          <div>
            <CheckCircle2 size={16} />
            <span>Receipt 交易</span>
            <strong>{digest}</strong>
          </div>
          <div>
            <FileCheck2 size={16} />
            <span>Receipt object</span>
            <strong>{receiptObjectId || '钱包响应中创建对象待定'}</strong>
          </div>
        </div>
      ) : null}

      {status === 'error' ? <div className="warningStrip inline">{error}</div> : null}

      <div className="noteRow">
        <Link2 size={14} />
        <span>Mint 会把 strategy ID、Policy object、Walrus blob ID 和 prepared execution ID 串成归档后证明；它是 agent 授权记忆，不是自动交易。</span>
      </div>
    </section>
  );
}
