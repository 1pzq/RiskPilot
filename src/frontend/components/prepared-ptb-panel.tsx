'use client';

import { CheckCircle2, WalletCards } from 'lucide-react';

import type { ExecutionIntent } from '@/lib/security/execution-intent';
import type { PreparedDeepBookPtb, SignedPreparedPtb } from '@/lib/sui/prepared-ptb';
import { MAINNET_DEEPBOOK_PACKAGE_ID } from '@/lib/sui/deepbook-live';
import { formatAddress, formatDateTime } from '@/lib/utils/format';

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
  showActions?: boolean;
  simplified?: boolean;
};

function formatAmount(value: number | undefined, symbol: string | undefined) {
  if (value === undefined || !symbol) {
    return 'n/a';
  }

  return `${value.toFixed(4)} ${symbol}`;
}

function badgeLabel(input: { signedPreparedPtb: SignedPreparedPtb | null; eligible: boolean }) {
  if (input.signedPreparedPtb) {
    return 'Evidence signed, transaction not submitted';
  }

  return input.eligible ? 'Built, awaiting signature' : 'Not available';
}

function displayValue(value: string): string {
  const exact: Record<string, string> = {
    'market snapshot required': 'Market snapshot required',
    'mint required': 'Mint required',
    'not locked': 'Not locked',
    'n/a': 'N/A',
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
  showActions = true,
  simplified = false,
}: PreparedPtbPanelProps) {
  const plan = preparedPtb.plan;
  const canSign = Boolean(accountAddress && preparedPtb.eligible && executionIntent && !signing && !signedPreparedPtb);
  const badge = badgeLabel({ signedPreparedPtb, eligible: preparedPtb.eligible });
  const summaryMarket = plan ? plan.marketLabel : 'SUI/USDC spot proof path';
  const summaryDirection = plan ? plan.side : 'spot proof';
  const summaryAmount = plan ? formatAmount(plan.amountIn, plan.assetIn) : 'n/a';
  const summaryOut = plan ? formatAmount(plan.estimatedOut, plan.assetOut) : 'n/a';
  const summaryStatus = signedPreparedPtb ? 'Evidence signed, transaction not submitted' : preparedPtb.eligible ? 'Built, awaiting signature' : 'Not available';
  const summaryLine = `${summaryMarket} · ${summaryDirection} · ${summaryAmount} → ${summaryOut}`;
  const intentLine = displayValue(executionIntent?.executionIntentId ?? 'not locked');
  const signedTimeLine = signedPreparedPtb?.signedAt ? formatDateTime(signedPreparedPtb.signedAt) : 'Not signed yet';

  return (
    <section className={`panel preparedPtbPanel ${compact ? 'preparedPtbPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Prepared PTB</p>
          <h2 className="panelTitle">Prepared only. Not submitted.</h2>
        </div>
        <span className={`pill ${signedPreparedPtb ? 'pillSuccess' : preparedPtb.eligible ? 'pillWarn' : 'pillDanger'}`}>
          {badge}
        </span>
      </div>

      {compact && simplified ? (
        <>
          <div className="compactProofStack">
            <div className="preparedCompactSummary">
              <strong>{summaryLine}</strong>
              <span>{summaryStatus} · Wallet signs an evidence message, not a transaction.</span>
            </div>
            <div className="compactProofGrid" aria-label="Prepared PTB compact fields">
              <div>
                <span>Pool</span>
                <strong>
                  {preparedPtb.poolEvidence?.poolKey ?? 'SUI_USDC'} ·{' '}
                  {preparedPtb.poolEvidence?.poolAddress ? formatAddress(preparedPtb.poolEvidence.poolAddress) : 'Market snapshot required'}
                </strong>
              </div>
              <div>
                <span>Policy</span>
                <strong>{policyObjectId ? formatAddress(policyObjectId) : 'Mint required'}</strong>
              </div>
              <div>
                <span>Intent</span>
                <strong>{intentLine}</strong>
              </div>
              <div>
                <span>DeepBook</span>
                <strong>{formatAddress(preparedPtb.poolEvidence?.deepbookPackageId ?? MAINNET_DEEPBOOK_PACKAGE_ID)}</strong>
              </div>
              <div>
                <span>Signed</span>
                <strong>{signedPreparedPtb ? signedTimeLine : 'Not signed yet'}</strong>
              </div>
              <div>
                <span>Submit</span>
                <strong>{signedPreparedPtb ? 'Not submitted' : 'Awaiting signature'}</strong>
              </div>
            </div>
          </div>
          {preparedPtb.reason ? <div className="warningStrip inline">{preparedPtb.reason}</div> : null}
        </>
      ) : (
        <>
          {preparedPtb.reason ? <div className="warningStrip inline">{preparedPtb.reason}</div> : null}

          <div className="preparedSignChecklist" aria-label="Preparation proof checklist">
            <span>{policyObjectId ? `Policy object ${formatAddress(policyObjectId)}` : 'Policy object not minted'}</span>
            <span>{preparedPtb.eligible ? `PTB ready · ${summaryLine}` : `PTB blocked · ${preparedPtb.reason ?? preparedPtb.safety.note}`}</span>
            <span>{signedPreparedPtb ? `Signed · ${signedTimeLine}` : canSign ? 'Signs evidence only. No transaction submission.' : 'Awaiting wallet or intent'}</span>
          </div>

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
                  <strong>
                    {formatAmount(plan.minimumOut, plan.assetOut)} · {plan.slippagePct}% slippage
                  </strong>
                </div>
                <div className="ticketRow">
                  <span>Pool</span>
                  <strong>
                    {preparedPtb.poolEvidence?.poolKey ?? 'n/a'} ·{' '}
                    {preparedPtb.poolEvidence?.poolAddress ? formatAddress(preparedPtb.poolEvidence.poolAddress) : 'n/a'}
                  </strong>
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
                  <strong>
                    {preparedPtb.poolEvidence?.poolKey ?? 'SUI_USDC'} ·{' '}
                    {preparedPtb.poolEvidence?.poolAddress ? formatAddress(preparedPtb.poolEvidence.poolAddress) : 'Market snapshot required'}
                  </strong>
                </div>
              </>
            )}
            <div className="ticketRow">
              <span>DeepBook package</span>
              <strong>{formatAddress(preparedPtb.poolEvidence?.deepbookPackageId ?? MAINNET_DEEPBOOK_PACKAGE_ID)}</strong>
            </div>
            <div className="ticketRow">
              <span>Policy object</span>
              <strong>{policyObjectId ? formatAddress(policyObjectId) : 'Mint required'}</strong>
            </div>
            <div className="ticketRow">
              <span>Execution intent</span>
              <strong>{displayValue(executionIntent?.executionIntentId ?? 'not locked')}</strong>
            </div>
            <div className="ticketRow">
              <span>Submit status</span>
              <strong>{signedPreparedPtb ? 'Evidence signed, transaction not submitted' : 'Not submitted'}</strong>
            </div>
          </div>

          {signedPreparedPtb ? (
            <div className="receiptResult">
              <div>
                <CheckCircle2 size={16} />
                <span>Bytes digest</span>
                <strong>{signedPreparedPtb.bytesDigest}</strong>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>Evidence message digest</span>
                <strong>{signedPreparedPtb.messageDigest}</strong>
              </div>
            </div>
          ) : null}
        </>
      )}

      {showActions ? (
        <button className="button buttonPrimary" type="button" onClick={onSign} disabled={!canSign}>
          {signedPreparedPtb ? 'Evidence message signed' : signing ? 'Awaiting wallet...' : 'Sign evidence message'}
        </button>
      ) : null}

      {!accountAddress ? (
        <div className="noteRow">
          <WalletCards size={14} />
          <span>Connect a Sui mainnet wallet before signing the evidence message.</span>
        </div>
      ) : null}

      {error ? <div className="warningStrip inline">{error}</div> : null}
    </section>
  );
}
