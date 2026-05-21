'use client';

import { CalendarClock, Lock, Scale } from 'lucide-react';

import type { ExecutionPolicy, PolicyCheckResult } from '@/lib/strategy/policy';
import { joinListInput, splitListInput } from '@/lib/strategy/policy';

type PolicyReviewProps = {
  policy: ExecutionPolicy;
  policyCheck: PolicyCheckResult;
  onChange: (policy: ExecutionPolicy) => void;
};

function toLocalDateParts(value: string) {
  const date = new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : date;

  return {
    date: validDate,
    hour: validDate.getHours().toString().padStart(2, '0'),
    minute: validDate.getMinutes().toString().padStart(2, '0'),
  };
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
    return '+1 day';
  }

  return `+${daysFromNow} days`;
}

export function PolicyReview({ policy, policyCheck, onChange }: PolicyReviewProps) {
  const expiryParts = toLocalDateParts(policy.expiresAt);
  const selectedDate = expiryParts.date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Policy gate</p>
          <h2 className="panelTitle">User-approved bounds</h2>
        </div>
        <span className={`pill ${policyCheck.ok ? 'pillSuccess' : 'pillDanger'}`}>
          {policyCheck.ok ? 'ok' : 'blocked'}
        </span>
      </div>

      <div className="fieldGrid">
        <label className="field">
          <span className="fieldLabel">
            <Scale size={14} />
            Max budget USD
          </span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.5"
            value={policy.maxBudgetUsd}
            onChange={(event) =>
              onChange({
                ...policy,
                maxBudgetUsd: Number(event.target.value),
              })
            }
          />
        </label>

        <label className="field">
          <span className="fieldLabel">
            <Scale size={14} />
            Max single trade USD
          </span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.5"
            value={policy.maxSingleTradeUsd}
            onChange={(event) =>
              onChange({
                ...policy,
                maxSingleTradeUsd: Number(event.target.value),
              })
            }
          />
        </label>

        <label className="field wide">
          <span className="fieldLabel">
            <Lock size={14} />
            Allowed assets
          </span>
          <input
            className="input"
            value={joinListInput(policy.allowedAssets)}
            onChange={(event) =>
              onChange({
                ...policy,
                allowedAssets: splitListInput(event.target.value),
              })
            }
          />
        </label>

        <label className="field wide">
          <span className="fieldLabel">
            <Lock size={14} />
            Allowed markets
          </span>
          <input
            className="input"
            value={joinListInput(policy.allowedMarkets)}
            onChange={(event) =>
              onChange({
                ...policy,
                allowedMarkets: splitListInput(event.target.value),
              })
            }
          />
        </label>

        <label className="field wide">
          <span className="fieldLabel">
            <CalendarClock size={14} />
            Expires at
          </span>
          <span className="dateControl">
            <span className="dateQuickGroup" role="group" aria-label="Expiry date">
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
                  <small>{days === 1 ? 'tomorrow' : selectedDate}</small>
                </button>
              ))}
            </span>

            <span className="timeControl" aria-label="Expiry time">
              <input
                aria-label="Expiry hour"
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
                aria-label="Expiry minute"
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
          <span>Require manual approval</span>
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
    </section>
  );
}
