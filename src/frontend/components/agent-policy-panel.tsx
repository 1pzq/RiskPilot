'use client';

import { CheckCircle2, WalletCards } from 'lucide-react';

import type { AgentPolicyObject, AgentPolicyObjectCheck } from '@/lib/sui/agent-policy';
import { AGENT_POLICY_PACKAGE_ID } from '@/lib/sui/agent-policy';
import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import { formatAddress, formatDateTime, formatUsd } from '@/lib/utils/format';

type AgentPolicyPanelProps = {
  accountAddress?: string;
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  policyObject: AgentPolicyObject | null;
  policyObjectCheck: AgentPolicyObjectCheck;
  minting: boolean;
  onMint: () => void;
  compact?: boolean;
  showActions?: boolean;
  simplified?: boolean;
};

function statusLabel(check: AgentPolicyObjectCheck) {
  if (check.status === 'not_minted') {
    return 'Awaiting Policy object';
  }

  if (check.ok) {
    return 'On-chain authority aligned';
  }

  if (check.status === 'expired') {
    return 'Expired';
  }

  if (check.status === 'revoked') {
    return 'Revoked';
  }

  return 'Needs sync';
}

export function AgentPolicyPanel({
  accountAddress,
  policy,
  policyCheck,
  policyObject,
  policyObjectCheck,
  minting,
  onMint,
  compact = false,
  showActions = true,
  simplified = false,
}: AgentPolicyPanelProps) {
  const canMint = Boolean(accountAddress && AGENT_POLICY_PACKAGE_ID && !minting && policyCheck.ok);
  const policySummary = `${formatUsd(policy.maxBudgetUsd)} budget · ${policy.allowedMarkets.join(', ') || 'no markets'} · ${policy.allowedAssets.join(', ') || 'no assets'}`;
  const policyLimitLine = `${formatUsd(policy.maxSingleTradeUsd)} single-trade cap · ${
    policy.requireManualApproval ? 'wallet confirmation required' : 'manual confirmation not required'
  } · expires ${formatDateTime(policy.expiresAt)}`;

  return (
    <section className={`panel agentPolicyPanel ${compact ? 'agentPolicyPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Sui mandate</p>
          <h2 className="panelTitle">Policy object</h2>
        </div>
        <span className={`pill ${policyObjectCheck.ok ? 'pillSuccess' : 'pillWarn'}`}>
          {statusLabel(policyObjectCheck)}
        </span>
      </div>

      {simplified ? (
        <div className="compactProofStack">
          <div className="policyCompactSummary">
            <WalletCards size={14} />
            <div className="policyCompactSummaryText">
              <strong>{policySummary}</strong>
              <span>{policyLimitLine}</span>
            </div>
          </div>
          <div className="compactProofGrid" aria-label="Policy object compact fields">
            <div>
              <span>Owner</span>
              <strong>{accountAddress ? formatAddress(accountAddress) : 'Connect wallet'}</strong>
            </div>
            <div>
              <span>Object</span>
              <strong>{policyObject ? formatAddress(policyObject.objectId) : 'Not minted'}</strong>
            </div>
            <div>
              <span>Package</span>
              <strong>{AGENT_POLICY_PACKAGE_ID ? formatAddress(AGENT_POLICY_PACKAGE_ID) : 'Not configured'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{statusLabel(policyObjectCheck)}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="policyObjectGrid">
          <div>
            <WalletCards size={15} />
            <span>Owner</span>
            <strong>{accountAddress ? formatAddress(accountAddress) : 'Connect wallet'}</strong>
          </div>
          <div>
            <WalletCards size={15} />
            <span>Object</span>
            <strong>{policyObject ? formatAddress(policyObject.objectId) : 'Not minted'}</strong>
          </div>
          <div>
            <WalletCards size={15} />
            <span>Package</span>
            <strong>{AGENT_POLICY_PACKAGE_ID ? formatAddress(AGENT_POLICY_PACKAGE_ID) : 'Not configured'}</strong>
          </div>
        </div>
      )}

      {compact ? (
        simplified ? null : (
          <div className="policyCompactSummary">
            <strong>{policySummary}</strong>
            <span>Expires {formatDateTime(policy.expiresAt)}</span>
          </div>
        )
      ) : (
        <div className="ticketRows">
          <div className="ticketRow">
            <span>Budget / single trade</span>
            <strong>{formatUsd(policy.maxBudgetUsd)} / {formatUsd(policy.maxSingleTradeUsd)}</strong>
          </div>
          <div className="ticketRow">
            <span>Assets</span>
            <strong>{policy.allowedAssets.join(', ') || 'None'}</strong>
          </div>
          <div className="ticketRow">
            <span>Markets</span>
            <strong>{policy.allowedMarkets.join(', ') || 'None'}</strong>
          </div>
          <div className="ticketRow">
            <span>Expires</span>
            <strong>{formatDateTime(policy.expiresAt)}</strong>
          </div>
        </div>
      )}

      {!simplified && policyObjectCheck.errors.length === 0 ? (
        <div className="noteRow">
          <CheckCircle2 size={14} />
          <span>The Sui object is the visible authorization boundary; the server gate runs the same shadow check.</span>
        </div>
      ) : null}

      {!simplified && showActions ? (
        <>
          <button className="button buttonSecondary" type="button" onClick={onMint} disabled={!canMint}>
            {minting ? 'Awaiting wallet...' : policyObject ? 'Mint current authority again' : 'Mint AgentPolicy object'}
          </button>
          <div className="agentPolicyBoundaryPreview" aria-label="AgentPolicy authorization boundary preview">
            <span>Authorization boundary</span>
            <strong>
              {formatUsd(policy.maxBudgetUsd)} budget · {policy.allowedMarkets.join(', ') || 'no markets'} · Agent can prepare actions only inside this boundary
            </strong>
          </div>
        </>
      ) : null}

      {!AGENT_POLICY_PACKAGE_ID ? (
        <div className="warningStrip inline">
          Configure NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID or NEXT_PUBLIC_RECEIPT_PACKAGE_ID before minting an on-chain policy.
        </div>
      ) : null}

    </section>
  );
}
