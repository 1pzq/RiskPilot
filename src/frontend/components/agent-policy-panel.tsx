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
    return '等待 Policy object';
  }

  if (check.ok) {
    return '链上授权已对齐';
  }

  if (check.status === 'expired') {
    return '已过期';
  }

  if (check.status === 'revoked') {
    return '已撤销';
  }

  return '需要同步';
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
  const policySummary = `${formatUsd(policy.maxBudgetUsd)} 预算 · ${policy.allowedMarkets.join(', ') || '无市场'} · ${policy.allowedAssets.join(', ') || '无资产'}`;
  const policyLimitLine = `${formatUsd(policy.maxSingleTradeUsd)} 单笔上限 · ${
    policy.requireManualApproval ? '需要钱包确认' : '无需手动确认'
  } · 过期 ${formatDateTime(policy.expiresAt)}`;

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
              <strong>{accountAddress ? formatAddress(accountAddress) : '连接钱包'}</strong>
            </div>
            <div>
              <span>Object</span>
              <strong>{policyObject ? formatAddress(policyObject.objectId) : '未 mint'}</strong>
            </div>
            <div>
              <span>Package</span>
              <strong>{AGENT_POLICY_PACKAGE_ID ? formatAddress(AGENT_POLICY_PACKAGE_ID) : '未配置'}</strong>
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
            <strong>{accountAddress ? formatAddress(accountAddress) : '连接钱包'}</strong>
          </div>
          <div>
            <WalletCards size={15} />
            <span>Object</span>
            <strong>{policyObject ? formatAddress(policyObject.objectId) : '未 mint'}</strong>
          </div>
          <div>
            <WalletCards size={15} />
            <span>Package</span>
            <strong>{AGENT_POLICY_PACKAGE_ID ? formatAddress(AGENT_POLICY_PACKAGE_ID) : '未配置'}</strong>
          </div>
        </div>
      )}

      {compact ? (
        simplified ? null : (
          <div className="policyCompactSummary">
            <strong>{policySummary}</strong>
            <span>过期 {formatDateTime(policy.expiresAt)}</span>
          </div>
        )
      ) : (
        <div className="ticketRows">
          <div className="ticketRow">
            <span>预算 / 单笔</span>
            <strong>{formatUsd(policy.maxBudgetUsd)} / {formatUsd(policy.maxSingleTradeUsd)}</strong>
          </div>
          <div className="ticketRow">
            <span>资产</span>
            <strong>{policy.allowedAssets.join(', ') || '无'}</strong>
          </div>
          <div className="ticketRow">
            <span>市场</span>
            <strong>{policy.allowedMarkets.join(', ') || '无'}</strong>
          </div>
          <div className="ticketRow">
            <span>过期</span>
            <strong>{formatDateTime(policy.expiresAt)}</strong>
          </div>
        </div>
      )}

      {!simplified && policyObjectCheck.errors.length === 0 ? (
        <div className="noteRow">
          <CheckCircle2 size={14} />
          <span>Sui object 是可见授权边界；server gate 同步做 shadow check。</span>
        </div>
      ) : null}

      {!simplified && showActions ? (
        <>
          <button className="button buttonSecondary" type="button" onClick={onMint} disabled={!canMint}>
            {minting ? '等待钱包…' : policyObject ? '重新 mint 当前授权' : 'Mint AgentPolicy object'}
          </button>
          <div className="agentPolicyBoundaryPreview" aria-label="AgentPolicy 授权边界预览">
            <span>授权边界</span>
            <strong>
              {formatUsd(policy.maxBudgetUsd)} 预算 · {policy.allowedMarkets.join(', ') || '无市场'} · Agent 只能在边界内准备行动
            </strong>
          </div>
        </>
      ) : null}

      {!AGENT_POLICY_PACKAGE_ID ? (
        <div className="warningStrip inline">
          需要配置 NEXT_PUBLIC_AGENT_POLICY_PACKAGE_ID 或 NEXT_PUBLIC_RECEIPT_PACKAGE_ID 后才能 mint on-chain policy。
        </div>
      ) : null}

    </section>
  );
}
