'use client';

import { useState } from 'react';
import { CalendarClock, Lock, Scale, ShieldCheck } from 'lucide-react';

import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';

type PolicyReviewProps = {
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  onChange: (policy: ExecutionPolicy) => void;
  compact?: boolean;
  assetOptions?: string[];
  marketOptions?: string[];
};

const DEFAULT_ASSET_OPTIONS = ['SUI', 'USDC', 'SUI/USDC LP', 'SUI downside cover', 'WAL'];
const DEFAULT_MARKET_OPTIONS = ['SUI/USDC', 'USDC/SUI', 'No trade'];

function toLocalDateParts(value: string) {
  const date = new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : date;

  return {
    date: validDate,
    hour: validDate.getHours().toString().padStart(2, '0'),
    minute: validDate.getMinutes().toString().padStart(2, '0'),
  };
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function labelForExpiryOption(base: string, daysFromNow: number): string {
  const current = toLocalDateParts(base).date;
  const next = new Date();
  next.setDate(next.getDate() + daysFromNow);
  next.setHours(current.getHours(), current.getMinutes(), 0, 0);

  return formatShortDate(next);
}

function setExpiry(base: string, daysFromNow: number, hour?: number, minute?: number): string {
  const current = toLocalDateParts(base).date;
  const next = new Date();
  next.setDate(next.getDate() + daysFromNow);
  next.setHours(hour ?? current.getHours(), minute ?? current.getMinutes(), 0, 0);
  return next.toISOString();
}

function setExpiryTime(base: string, part: 'hour' | 'minute', value: string): string {
  const next = toLocalDateParts(base).date;
  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return next.toISOString();
  }

  if (part === 'hour') {
    next.setHours(Math.min(23, Math.max(0, numeric)));
  } else {
    next.setMinutes(Math.min(59, Math.max(0, numeric)));
  }

  next.setSeconds(0, 0);
  return next.toISOString();
}

function formatDateChip(daysFromNow: number): string {
  if (daysFromNow === 1) {
    return '+1 天';
  }

  return `+${daysFromNow} 天`;
}

function parseUsdInput(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function uniqueOptions(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
}

function toggleOption(values: string[], option: string): string[] {
  return values.includes(option) ? values.filter((value) => value !== option) : [...values, option];
}

export function PolicyReview({
  policy,
  policyCheck,
  onChange,
  compact = false,
  assetOptions = [],
  marketOptions = [],
}: PolicyReviewProps) {
  const [maxBudgetDraft, setMaxBudgetDraft] = useState(() => ({
    source: policy.maxBudgetUsd,
    value: String(policy.maxBudgetUsd),
  }));
  const [maxSingleTradeDraft, setMaxSingleTradeDraft] = useState(() => ({
    source: policy.maxSingleTradeUsd,
    value: String(policy.maxSingleTradeUsd),
  }));
  const maxBudgetInput =
    maxBudgetDraft.source === policy.maxBudgetUsd ? maxBudgetDraft.value : String(policy.maxBudgetUsd);
  const maxSingleTradeInput =
    maxSingleTradeDraft.source === policy.maxSingleTradeUsd
      ? maxSingleTradeDraft.value
      : String(policy.maxSingleTradeUsd);
  const expiryParts = toLocalDateParts(policy.expiresAt);
  const selectedDate = formatShortDate(expiryParts.date);
  const selectableAssets = uniqueOptions([...policy.allowedAssets, ...assetOptions, ...DEFAULT_ASSET_OPTIONS]);
  const selectableMarkets = uniqueOptions([...policy.allowedMarkets, ...marketOptions, ...DEFAULT_MARKET_OPTIONS]);

  function updateMaxBudgetInput(value: string) {
    setMaxBudgetDraft({ source: policy.maxBudgetUsd, value });

    const nextValue = parseUsdInput(value);
    if (nextValue === null || value.trim().endsWith('.')) {
      return;
    }

    onChange({
      ...policy,
      maxBudgetUsd: nextValue,
    });
  }

  function updateMaxSingleTradeInput(value: string) {
    setMaxSingleTradeDraft({ source: policy.maxSingleTradeUsd, value });

    const nextValue = parseUsdInput(value);
    if (nextValue === null || value.trim().endsWith('.')) {
      return;
    }

    onChange({
      ...policy,
      maxSingleTradeUsd: nextValue,
    });
  }

  const policyControls = (
    <>
      <div className="fieldGrid">
        <label className="field">
          <span className="fieldLabel">
            <Scale size={14} />
            最大预算 USD
          </span>
          <input
            className="input"
            inputMode="decimal"
            type="text"
            min="0"
            step="0.5"
            value={maxBudgetInput}
            onChange={(event) => updateMaxBudgetInput(event.target.value)}
            onBlur={() => {
              const nextValue = parseUsdInput(maxBudgetInput);

              if (nextValue === null) {
                setMaxBudgetDraft({ source: policy.maxBudgetUsd, value: String(policy.maxBudgetUsd) });
                return;
              }

              onChange({
                ...policy,
                maxBudgetUsd: nextValue,
              });
            }}
          />
        </label>

        <label className="field">
          <span className="fieldLabel">
            <Scale size={14} />
            单笔上限 USD
          </span>
          <input
            className="input"
            inputMode="decimal"
            type="text"
            min="0"
            step="0.5"
            value={maxSingleTradeInput}
            onChange={(event) => updateMaxSingleTradeInput(event.target.value)}
            onBlur={() => {
              const nextValue = parseUsdInput(maxSingleTradeInput);

              if (nextValue === null) {
                setMaxSingleTradeDraft({
                  source: policy.maxSingleTradeUsd,
                  value: String(policy.maxSingleTradeUsd),
                });
                return;
              }

              onChange({
                ...policy,
                maxSingleTradeUsd: nextValue,
              });
            }}
          />
        </label>

        <div className="field wide">
          <span className="fieldLabel">
            <Lock size={14} />
            允许资产
          </span>
          <div className="optionGroup optionGroupWide policyChoiceGroup" role="group" aria-label="允许资产">
            {selectableAssets.map((asset) => {
              const active = policy.allowedAssets.includes(asset);

              return (
                <button
                  aria-pressed={active}
                  className={`optionChip ${active ? 'optionChipActive' : ''}`}
                  key={asset}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...policy,
                      allowedAssets: toggleOption(policy.allowedAssets, asset),
                    })
                  }
                >
                  <span>{asset}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field wide">
          <span className="fieldLabel">
            <Lock size={14} />
            允许市场
          </span>
          <div className="optionGroup optionGroupWide policyChoiceGroup" role="group" aria-label="允许市场">
            {selectableMarkets.map((market) => {
              const active = policy.allowedMarkets.includes(market);

              return (
                <button
                  aria-pressed={active}
                  className={`optionChip ${active ? 'optionChipActive' : ''}`}
                  key={market}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...policy,
                      allowedMarkets: toggleOption(policy.allowedMarkets, market),
                    })
                  }
                >
                  <span>{market}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="field wide">
          <span className="fieldLabel">
            <CalendarClock size={14} />
            过期时间
          </span>
          <span className="dateControl">
            <span className="dateQuickGroup" role="group" aria-label="过期日期">
              {[1, 3, 7].map((days) => (
                <button
                  className="optionChip dateChip"
                  key={days}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...policy,
                      expiresAt: setExpiry(policy.expiresAt, days),
                    })
                  }
                >
                  <span>{formatDateChip(days)}</span>
                  <small>{labelForExpiryOption(policy.expiresAt, days)}</small>
                </button>
              ))}
            </span>

            <span className="timeControl" aria-label="过期时间">
              <input
                aria-label="过期小时"
                className="timeInput"
                inputMode="numeric"
                max="23"
                min="0"
                type="number"
                value={expiryParts.hour}
                onChange={(event) =>
                  onChange({
                    ...policy,
                    expiresAt: setExpiryTime(policy.expiresAt, 'hour', event.target.value),
                  })
                }
              />
              <span className="timeColon">:</span>
              <input
                aria-label="过期分钟"
                className="timeInput"
                inputMode="numeric"
                max="59"
                min="0"
                type="number"
                value={expiryParts.minute}
                onChange={(event) =>
                  onChange({
                    ...policy,
                    expiresAt: setExpiryTime(policy.expiresAt, 'minute', event.target.value),
                  })
                }
              />
              <span className="timeStamp">{selectedDate}</span>
            </span>
          </span>
        </label>

        <label className="checkboxRow wide">
          <input
            type="checkbox"
            checked={policy.requireManualApproval}
            onChange={(event) =>
              onChange({
                ...policy,
                requireManualApproval: event.target.checked,
              })
            }
          />
          <span className="checkMark" aria-hidden="true" />
          <span>需要人工确认</span>
        </label>
      </div>

      {policyCheck.errors.length > 0 ? (
        <div className="errorList">
          {policyCheck.errors.map((error) => (
            <div key={error} className="errorItem">
              {error}
            </div>
          ))}
        </div>
      ) : null}

      <div className="policyTrustBoundary" aria-label="Policy trust boundary">
        <ShieldCheck size={16} />
        <div>
          <span>当前执行边界</span>
          <strong>App/服务端 shadow check</strong>
        </div>
        <div>
          <span>防护对象</span>
          <strong>客户端漂移、AI 文案越权、过期 Policy</strong>
        </div>
        <div>
          <span>链上授权</span>
          <strong>由 AgentPolicy object 承载</strong>
        </div>
        <div>
          <span>Agent 姿态</span>
          <strong>在授权边界内准备行动</strong>
        </div>
      </div>
    </>
  );

  return (
    <section className={`panel policyPanel ${compact ? 'policyPanelCompact' : ''}`}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Policy shadow check</p>
          <h2 className="panelTitle">Agent 授权草案</h2>
        </div>
        <span className={`pill ${policyCheck.ok ? 'pillSuccess' : 'pillDanger'}`}>
          {policyCheck.ok ? '通过' : '已阻断'}
        </span>
      </div>

      {compact ? (
        <>
          <div className="policyCompactGrid">
            <div>
              <span>预算</span>
              <strong>${policy.maxBudgetUsd}</strong>
            </div>
            <div>
              <span>单笔交易</span>
              <strong>${policy.maxSingleTradeUsd}</strong>
            </div>
            <div>
              <span>人工确认</span>
              <strong>{policy.requireManualApproval ? '需要' : '关闭'}</strong>
            </div>
            <div>
              <span>资产 / 市场</span>
              <strong>
                {policy.allowedAssets.join(', ') || '无'} / {policy.allowedMarkets.join(', ') || '无'}
              </strong>
            </div>
          </div>
          <details className="policyEditorDrawer" open={!policyCheck.ok}>
            <summary>{policyCheck.ok ? '编辑 Policy 边界' : '查看被阻断的 Policy 详情'}</summary>
            {policyControls}
          </details>
        </>
      ) : (
        policyControls
      )}
    </section>
  );
}
