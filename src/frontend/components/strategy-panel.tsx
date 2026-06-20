'use client';

import {
  ArrowRightLeft,
  BarChart3,
  CalendarClock,
  FileCheck2,
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
  return mode === 'prepare_mainnet' ? 'Prepare only' : mode.replace(/_/g, ' ');
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
      label: 'Why',
      value: recommendation.rationale,
    },
    {
      icon: <Target size={14} />,
      label: 'Applies to',
      value: recommendation.applicability,
    },
    {
      icon: <ShieldCheck size={14} />,
      label: 'Prepare only',
      value: recommendation.prepareOnlyReason,
    },
    {
      icon: <RotateCcw size={14} />,
      label: 'Fallback',
      value: recommendation.fallback,
    },
  ].filter((item) => item.value);
  const displayFacts = recommendation.displayFacts ?? [];
  const evidenceItems = [
    {
      label: 'Policy checks',
      value: `Budget ${formatUsd(recommendation.estimatedCostUsd)}, market ${recommendation.deepbookAction.market}, assets ${recommendation.deepbookAction.assetIn}/${recommendation.deepbookAction.assetOut}`,
    },
    {
      label: 'Wallet confirms',
      value: 'Act signs an evidence message only. It proves the user confirmed the strategy and does not move assets.',
    },
    {
      label: 'Walrus archives',
      value: 'Remember stores the strategy summary, Policy boundary, preparation proof, and market evidence for judge replay.',
    },
  ];
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
          <p className="eyebrow">Recommended action</p>
          <h2 className="panelTitle">{recommendation.title}</h2>
        </div>
        <span className="pill pillAccent">{formatActionMode(recommendation.deepbookAction.mode)}</span>
      </div>

      <p className="panelCopy">{recommendation.summary}</p>

      <div className="metricGrid compact">
        <div className="metricCard">
          <div className="metricLabel">
            <ShieldAlert size={14} />
            Max cost
          </div>
          <div className="metricValue">{formatUsd(recommendation.estimatedCostUsd)}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">
            <ArrowRightLeft size={14} />
            Est. risk reduction
          </div>
          <div className="metricValue">{recommendation.expectedRiskReduction}%</div>
        </div>
      </div>

      {strategyDetails.length > 0 ? (
        <div className="positionBlock strategyBlock strategyBriefing">
          <div className="strategyBriefGrid">
            {strategyDetails.map((item, index) => (
              <div className="strategyBriefItem" key={item.label}>
                <div className="strategyBriefLabel">
                  <span className="strategyBriefIndex">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    {item.icon}
                    {item.label}
                  </span>
                </div>
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
                Live pool
              </span>
              <strong>{marketSnapshot.poolKey}</strong>
            </div>
            <div className="strategyFact">
              <span>Mid price</span>
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
              <span>Pool status</span>
              <strong>{marketSnapshot.registeredPool ? 'registered' : 'unregistered'} · {marketSnapshot.whitelisted ? 'whitelisted' : 'open'}</strong>
            </div>
            <div className="strategyFact">
              <span>Vault</span>
              <strong>
                {marketSnapshot.vaultBalances.base.toFixed(2)} / {marketSnapshot.vaultBalances.quote.toFixed(2)} / {marketSnapshot.vaultBalances.deep.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      ) : marketSnapshotStatus === 'loading' ? (
        <div className="noteRow">
          <BarChart3 size={14} />
          <span>Loading live DeepBook mainnet data...</span>
        </div>
      ) : marketSnapshotError ? (
        <div className="warningStrip inline">{marketSnapshotError}</div>
      ) : null}

      <div className="positionBlock strategyBlock strategyActionBlock">
        <div className="positionLine">
          <span>Adapter</span>
          <span>{recommendation.deepbookAction.kind === 'predict_binary' ? 'DeepBook Predict' : 'DeepBook'}</span>
        </div>
        <div className="positionLine">
          <span>Market</span>
          <span>{recommendation.deepbookAction.market}</span>
        </div>
        <div className="positionLine">
          <span>Direction</span>
          <span>{recommendation.deepbookAction.side}</span>
        </div>
        <div className="positionLine">
          <span>Input asset</span>
          <span>{recommendation.deepbookAction.assetIn}</span>
        </div>
        <div className="positionLine">
          <span>Output asset</span>
          <span>{recommendation.deepbookAction.assetOut}</span>
        </div>
        <div className="positionLine">
          <span>Prepared size</span>
          <span>{formatUsd(recommendation.deepbookAction.amountUsd)}</span>
        </div>
        <div className="strategyNote">{recommendation.deepbookAction.description}</div>
      </div>

      <div className="positionBlock strategyBlock strategyEvidenceBlock">
        <div className="strategyEvidenceHeader">
          <span>
            <FileCheck2 size={14} />
            Strategy evidence preview
          </span>
        </div>

        <div className="strategyEvidenceConclusion" aria-label="Strategy safety conclusion">
          <span>
            <strong>AI has no execution key</strong>
            <small>Suggests only</small>
          </span>
          <span>
            <strong>Policy gates first</strong>
            <small>Out of bounds means blocked</small>
          </span>
          <span>
            <strong>No wallet, no submit</strong>
            <small>No automatic outflow</small>
          </span>
        </div>

        <div className="strategyEvidenceGrid">
          {evidenceItems.map((item) => (
            <div className="strategyEvidenceItem" key={item.label}>
              <span>{item.label}</span>
              <p>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {canEditPredict ? (
        <div className="fieldGrid strategyControls">
          <label className="field">
            <span className="fieldLabel">
              <Target size={14} />
              Protection threshold
            </span>
            <span className="optionGroup" role="radiogroup" aria-label="Protection threshold">
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
              Expiry
            </span>
            <span className="optionGroup" role="radiogroup" aria-label="Expiry">
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
                  {expiryDays}D
                </OptionButton>
              ))}
            </span>
          </label>

          <label className="field wide">
            <span className="fieldLabel">
              <ShieldAlert size={14} />
              Budget USD
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
