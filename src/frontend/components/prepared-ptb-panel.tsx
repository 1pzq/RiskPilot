'use client';

import { CheckCircle2, FileSignature, ShieldAlert, WalletCards } from 'lucide-react';

import type { ExecutionIntent } from '@/lib/security/execution-intent';
import type { PreparedDeepBookPtb, SignedPreparedPtb } from '@/lib/sui/prepared-ptb';
import { MAINNET_DEEPBOOK_PACKAGE_ID } from '@/lib/sui/deepbook-live';
import { formatAddress } from '@/lib/utils/format';

type PreparedPtbPanelProps = {
  accountAddress?: string;
  preparedPtb: PreparedDeepBookPtb;
  signedPreparedPtb: SignedPreparedPtb | null;
  signing: boolean;
  error?: string;
  policyObjectId?: string;
  executionIntent: ExecutionIntent | null;
  onSign: () => void;
  compact?: boolean;
};

function formatAmount(value: number | undefined, symbol: string | undefined) {
  if (value === undefined || !symbol) {
    return 'n/a';
  }

  return `${value.toFixed(4)} ${symbol}`;
}

function badgeLabel(input: { signedPreparedPtb: SignedPreparedPtb | null; eligible: boolean }) {
  if (input.signedPreparedPtb) {
    return '证明已签名，未提交交易';
  }

  return input.eligible ? '已构建，待签名' : '暂不可用';
}

function safetyNote(note: string): string {
  return note
    .replace(
      'Wallet signs an evidence message for authorization proof; RiskPilot does not submit a transaction or move funds.',
      '钱包只签名准备证明，不签真实交易；RiskPilot 不会提交，也不会转出资产。',
    )
    .replace(
      'DeepBook market snapshot is required before building the prepared PTB.',
      '构建 prepared PTB 前需要 DeepBook 市场快照。',
    );
}

function displayValue(value: string): string {
  const exact: Record<string, string> = {
    'market snapshot required': '需要市场快照',
    'mint required': '需要 mint',
    'not locked': '尚未锁定',
    'n/a': '不适用',
  };

  return exact[value] ?? value;
}

export function PreparedPtbPanel({
  accountAddress,
  preparedPtb,
  signedPreparedPtb,
  signing,
  error,
  policyObjectId,
  executionIntent,
  onSign,
  compact = false,
}: PreparedPtbPanelProps) {
  const plan = preparedPtb.plan;
  const canSign = Boolean(accountAddress && preparedPtb.eligible && executionIntent && !signing && !signedPreparedPtb);
  const badge = badgeLabel({ signedPreparedPtb, eligible: preparedPtb.eligible });

  return (
    <section className={`panel preparedPtbPanel ${compact ? 'preparedPtbPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Prepared PTB</p>
          <h2 className="panelTitle">PTB 只准备，不提交</h2>
        </div>
        <span className={`pill ${signedPreparedPtb ? 'pillSuccess' : preparedPtb.eligible ? 'pillWarn' : 'pillDanger'}`}>
          {badge}
        </span>
      </div>

      <div className="noteRow">
        {signedPreparedPtb ? <CheckCircle2 size={14} /> : preparedPtb.eligible ? <FileSignature size={14} /> : <ShieldAlert size={14} />}
        <span>{safetyNote(preparedPtb.safety.note)}</span>
      </div>

      <div className={`preparedConstraintBanner ${policyObjectId ? 'preparedConstraintBannerReady' : 'preparedConstraintBannerPending'}`}>
        <strong>{policyObjectId ? '已受 AgentPolicy 约束' : '等待 Policy object'}</strong>
        <span>
          {policyObjectId
            ? `Policy object ${formatAddress(policyObjectId)} 已绑定到 prepared PTB。`
            : '先 mint AgentPolicy object，PTB 才会带上授权边界。'}
        </span>
      </div>

      <div className="preparedEvidenceNotice">
        <strong>签名对象是 evidence message，不是交易。</strong>
        <span>下面是计划参数，钱包签名不会转出 SUI 或 USDC。</span>
      </div>

      {preparedPtb.reason ? <div className="warningStrip inline">{preparedPtb.reason}</div> : null}

      <div className="ticketRows">
        {plan ? (
          <>
          <div className="ticketRow">
            <span>Market</span>
            <strong>{plan.marketLabel}</strong>
          </div>
          <div className="ticketRow">
            <span>Direction</span>
            <strong>{plan.side}</strong>
          </div>
          <div className="ticketRow">
            <span>Input</span>
            <strong>{formatAmount(plan.amountIn, plan.assetIn)}</strong>
          </div>
          <div className="ticketRow">
            <span>Estimated out</span>
            <strong>{formatAmount(plan.estimatedOut, plan.assetOut)}</strong>
          </div>
          <div className="ticketRow">
            <span>Minimum out</span>
            <strong>{formatAmount(plan.minimumOut, plan.assetOut)} · {plan.slippagePct}% slippage</strong>
          </div>
          <div className="ticketRow">
            <span>Pool</span>
            <strong>{preparedPtb.poolEvidence?.poolKey ?? 'n/a'} · {preparedPtb.poolEvidence?.poolAddress ? formatAddress(preparedPtb.poolEvidence.poolAddress) : 'n/a'}</strong>
          </div>
          </>
        ) : (
          <>
            <div className="ticketRow">
              <span>Market</span>
              <strong>SUI/USDC spot proof path</strong>
            </div>
            <div className="ticketRow">
              <span>Pool</span>
            <strong>{preparedPtb.poolEvidence?.poolKey ?? 'SUI_USDC'} · {preparedPtb.poolEvidence?.poolAddress ? formatAddress(preparedPtb.poolEvidence.poolAddress) : '需要市场快照'}</strong>
            </div>
          </>
        )}
          <div className="ticketRow">
            <span>DeepBook package</span>
            <strong>{formatAddress(preparedPtb.poolEvidence?.deepbookPackageId ?? MAINNET_DEEPBOOK_PACKAGE_ID)}</strong>
          </div>
          <div className="ticketRow">
            <span>Policy object</span>
            <strong>{policyObjectId ? formatAddress(policyObjectId) : '需要 mint'}</strong>
          </div>
          <div className="ticketRow">
            <span>Execution intent</span>
            <strong>{displayValue(executionIntent?.executionIntentId ?? 'not locked')}</strong>
          </div>
          <div className="ticketRow">
            <span>Submit status</span>
            <strong>{signedPreparedPtb ? '证明已签名，未提交交易' : '未提交'}</strong>
          </div>
      </div>

      <button className="button buttonPrimary" type="button" onClick={onSign} disabled={!canSign}>
        {signedPreparedPtb ? '准备证明已签名' : signing ? '等待钱包…' : '签名准备证明'}
      </button>

      {!accountAddress ? (
        <div className="noteRow">
          <WalletCards size={14} />
          <span>连接 Sui mainnet 钱包后，才可以签名准备证明。</span>
        </div>
      ) : null}

      {signedPreparedPtb ? (
        <div className="receiptResult">
          <div>
            <CheckCircle2 size={16} />
            <span>Evidence message digest</span>
            <strong>{signedPreparedPtb.messageDigest}</strong>
          </div>
          <div>
            <WalletCards size={16} />
            <span>Signer</span>
            <strong>{formatAddress(signedPreparedPtb.signer)}</strong>
          </div>
        </div>
      ) : null}

      {error ? <div className="warningStrip inline">{error}</div> : null}
    </section>
  );
}
