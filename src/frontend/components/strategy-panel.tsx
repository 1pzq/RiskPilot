'use client';

import {
  ArrowRightLeft,
  BarChart3,
  CalendarClock,
  Info,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import type { DeepBookPredictSettings, StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import type { DeepBookLiveMarketSnapshot } from '@/lib/sui/deepbook-live';
import { formatUsd } from '@/lib/utils/format';
import { zhDisplayText } from '@/frontend/utils/zh';

type StrategyPanelProps = {
  recommendation: StrategyRecommendation;
  predictSettings?: DeepBookPredictSettings;
  onPredictSettingsChange?: (settings: DeepBookPredictSettings) => void;
  marketSnapshot?: DeepBookLiveMarketSnapshot | null;
  marketSnapshotStatus?: 'idle' | 'loading' | 'ready' | 'error';
  marketSnapshotError?: string | null;
};

const thresholds: DeepBookPredictSettings['thresholdPct'][] = [-10, -15, -20];
const expiries: DeepBookPredictSettings['expiryDays'][] = [1, 7, 14];

function parseUsdInput(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatActionMode(mode: string): string {
  return mode === 'prepare_mainnet' ? '仅 Prepare' : mode.replace(/_/g, ' ');
}

function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`optionChip ${active ? 'optionChipActive' : ''}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export function StrategyPanel({
  recommendation,
  predictSettings,
  onPredictSettingsChange,
  marketSnapshot,
  marketSnapshotStatus = 'idle',
  marketSnapshotError,
}: StrategyPanelProps) {
  const canEditPredict = recommendation.type === 'deepbook_predict_downside_binary' && predictSettings && onPredictSettingsChange;
  const strategyDetails = [
    {
      icon: <Info size={14} />,
      label: '原因',
      value: recommendation.rationale,
    },
    {
      icon: <Target size={14} />,
      label: '适用范围',
      value: recommendation.applicability,
    },
    {
      icon: <ShieldCheck size={14} />,
      label: '仅 Prepare',
      value: recommendation.prepareOnlyReason,
    },
    {
      icon: <RotateCcw size={14} />,
      label: '兜底方案',
      value: recommendation.fallback,
    },
  ].filter((item) => item.value);
  const displayFacts = recommendation.displayFacts ?? [];
  const [budgetDraft, setBudgetDraft] = useState(() => ({
    source: predictSettings?.budgetUsd ?? null,
    value: String(predictSettings?.budgetUsd ?? ''),
  }));
  const budgetInput =
    budgetDraft.source === (predictSettings?.budgetUsd ?? null)
      ? budgetDraft.value
      : String(predictSettings?.budgetUsd ?? '');

  function updateBudgetInput(value: string) {
    setBudgetDraft({ source: predictSettings?.budgetUsd ?? null, value });

    if (!predictSettings || !onPredictSettingsChange) {
      return;
    }

    const nextValue = parseUsdInput(value);
    if (nextValue === null || value.trim().endsWith('.')) {
      return;
    }

    onPredictSettingsChange({
      ...predictSettings,
      budgetUsd: nextValue,
    });
  }

  return (
    <section className="panel strategyPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">推荐动作</p>
          <h2 className="panelTitle">{recommendation.title}</h2>
        </div>
        <span className="pill pillAccent">{formatActionMode(recommendation.deepbookAction.mode)}</span>
      </div>

      <p className="panelCopy">{recommendation.summary}</p>

      <div className="metricGrid compact">
        <div className="metricCard">
          <div className="metricLabel">
            <ShieldAlert size={14} />
            最大成本
          </div>
          <div className="metricValue">{formatUsd(recommendation.estimatedCostUsd)}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <ArrowRightLeft size={14} />
            预估降险
          </div>
          <div className="metricValue">{recommendation.expectedRiskReduction}%</div>
        </div>
      </div>

      {strategyDetails.length > 0 ? (
        <div className="positionBlock strategyBlock strategyBriefing">
          <div className="strategyBriefGrid">
            {strategyDetails.map((item) => (
              <div className="strategyBriefItem" key={item.label}>
                <span className="strategyBriefLabel">
                  {item.icon}
                  {item.label}
                </span>
                <p>{item.value}</p>
              </div>
            ))}
          </div>

          {displayFacts.length > 0 ? (
            <div className="strategyFactGrid">
              {displayFacts.map((fact) => (
                <div className="strategyFact" key={`${fact.label}-${fact.value}`}>
                  <span>{zhDisplayText(fact.label)}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

        </div>
      ) : null}

      {marketSnapshot ? (
        <div className="positionBlock strategyBlock strategyMarketBlock">
          <div className="strategyMarketGrid">
            <div className="strategyFact">
              <span>
                <BarChart3 size={14} />
                实时池
              </span>
              <strong>{marketSnapshot.poolKey}</strong>
            </div>
            <div className="strategyFact">
              <span>中间价</span>
              <strong>{formatUsd(marketSnapshot.midPrice)}</strong>
            </div>
            <div className="strategyFact">
              <span>1 SUI ≈</span>
              <strong>{marketSnapshot.quoteOutForOneBase.toFixed(2)} USDC</strong>
            </div>
            <div className="strategyFact">
              <span>1 USDC ≈</span>
              <strong>{marketSnapshot.baseOutForOneQuote.toFixed(4)} SUI</strong>
            </div>
            <div className="strategyFact">
              <span>池状态</span>
              <strong>{marketSnapshot.registeredPool ? 'registered' : 'unregistered'} · {marketSnapshot.whitelisted ? 'whitelisted' : 'open'}</strong>
            </div>
            <div className="strategyFact">
              <span>金库</span>
              <strong>
                {marketSnapshot.vaultBalances.base.toFixed(2)} / {marketSnapshot.vaultBalances.quote.toFixed(2)} / {marketSnapshot.vaultBalances.deep.toFixed(2)}
              </strong>
            </div>
          </div>
          <div className="strategyNote">
            真实 DeepBook mainnet 报价和池元数据，取自实时 SUI/USDC 市场。
          </div>
        </div>
      ) : marketSnapshotStatus === 'loading' ? (
        <div className="noteRow">
          <BarChart3 size={14} />
          <span>正在加载实时 DeepBook mainnet 数据…</span>
        </div>
      ) : marketSnapshotError ? (
        <div className="warningStrip inline">{marketSnapshotError}</div>
      ) : null}

      <div className="positionBlock strategyBlock strategyActionBlock">
        <div className="positionLine">
          <span>适配器</span>
          <span>{recommendation.deepbookAction.kind === 'predict_binary' ? 'DeepBook Predict' : 'DeepBook'}</span>
        </div>
        <div className="positionLine">
          <span>市场</span>
          <span>{recommendation.deepbookAction.market}</span>
        </div>
        <div className="positionLine">
          <span>方向</span>
          <span>{recommendation.deepbookAction.side}</span>
        </div>
        <div className="positionLine">
          <span>输入资产</span>
          <span>{recommendation.deepbookAction.assetIn}</span>
        </div>
        <div className="positionLine">
          <span>输出资产</span>
          <span>{recommendation.deepbookAction.assetOut}</span>
        </div>
        <div className="positionLine">
          <span>准备规模</span>
          <span>{formatUsd(recommendation.deepbookAction.amountUsd)}</span>
        </div>
        <div className="strategyNote">{recommendation.deepbookAction.description}</div>
      </div>

      {canEditPredict ? (
        <div className="fieldGrid strategyControls">
          <label className="field">
            <span className="fieldLabel">
              <Target size={14} />
              保护阈值
            </span>
            <span className="optionGroup" role="radiogroup" aria-label="保护阈值">
              {thresholds.map((threshold) => (
                <OptionButton
                  active={predictSettings.thresholdPct === threshold}
                  key={threshold}
                  onClick={() =>
                    onPredictSettingsChange({
                      ...predictSettings,
                      thresholdPct: threshold,
                    })
                  }
                >
                  {threshold}%
                </OptionButton>
              ))}
            </span>
          </label>

          <label className="field">
            <span className="fieldLabel">
              <CalendarClock size={14} />
              过期时间
            </span>
            <span className="optionGroup" role="radiogroup" aria-label="过期时间">
              {expiries.map((expiryDays) => (
                <OptionButton
                  active={predictSettings.expiryDays === expiryDays}
                  key={expiryDays}
                  onClick={() =>
                    onPredictSettingsChange({
                      ...predictSettings,
                      expiryDays,
                    })
                  }
                >
                  {expiryDays} 天
                </OptionButton>
              ))}
            </span>
          </label>

          <label className="field wide">
            <span className="fieldLabel">
              <ShieldAlert size={14} />
              预算 USD
            </span>
            <input
              className="input"
              inputMode="decimal"
              min="1"
              step="0.5"
              type="text"
              value={budgetInput}
              onChange={(event) => updateBudgetInput(event.target.value)}
              onBlur={() => {
                const nextValue = parseUsdInput(budgetInput);

                if (nextValue === null) {
                  setBudgetDraft({
                    source: predictSettings.budgetUsd,
                    value: String(predictSettings.budgetUsd),
                  });
                  return;
                }

                onPredictSettingsChange({
                  ...predictSettings,
                  budgetUsd: nextValue,
                });
              }}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
