'use client';

import {
  ArrowRightLeft,
  BarChart3,
  CalendarClock,
  Info,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { DeepBookPredictSettings, StrategyRecommendation } from '@/lib/strategy/strategy-builder';
import type { DeepBookLiveMarketSnapshot } from '@/lib/sui/deepbook-live';
import { formatUsd } from '@/lib/utils/format';

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

function formatActionMode(mode: string): string {
  return mode === 'prepare_mainnet' ? 'prepare-only' : mode.replace(/_/g, ' ');
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
      label: 'Prepare-only',
      value: recommendation.prepareOnlyReason,
    },
    {
      icon: <RotateCcw size={14} />,
      label: 'Fallback',
      value: recommendation.fallback,
    },
  ].filter((item) => item.value);
  const displayFacts = recommendation.displayFacts ?? [];
  const constraints = recommendation.constraints ?? [];
  const riskTradeoffs = recommendation.riskTradeoffs ?? [];

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
            Est. risk cut
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
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {constraints.length > 0 || riskTradeoffs.length > 0 ? (
            <div className="strategyListGrid">
              {constraints.length > 0 ? (
                <div className="strategyList">
                  <span className="strategyListTitle">
                    <ListChecks size={14} />
                    Guardrails
                  </span>
                  <ul>
                    {constraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {riskTradeoffs.length > 0 ? (
                <div className="strategyList">
                  <span className="strategyListTitle">
                    <TriangleAlert size={14} />
                    Tradeoffs
                  </span>
                  <ul>
                    {riskTradeoffs.map((tradeoff) => (
                      <li key={tradeoff}>{tradeoff}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
              <span>Pool state</span>
              <strong>{marketSnapshot.registeredPool ? 'registered' : 'unregistered'} · {marketSnapshot.whitelisted ? 'whitelisted' : 'open'}</strong>
            </div>
            <div className="strategyFact">
              <span>Vaults</span>
              <strong>
                {marketSnapshot.vaultBalances.base.toFixed(2)} / {marketSnapshot.vaultBalances.quote.toFixed(2)} / {marketSnapshot.vaultBalances.deep.toFixed(2)}
              </strong>
            </div>
          </div>
          <div className="strategyNote">
            Real DeepBook mainnet quote and pool metadata, fetched from the live SUI/USDC market.
          </div>
        </div>
      ) : marketSnapshotStatus === 'loading' ? (
        <div className="noteRow">
          <BarChart3 size={14} />
          <span>Loading live DeepBook mainnet data…</span>
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
          <span>Asset in</span>
          <span>{recommendation.deepbookAction.assetIn}</span>
        </div>
        <div className="positionLine">
          <span>Asset out</span>
          <span>{recommendation.deepbookAction.assetOut}</span>
        </div>
        <div className="positionLine">
          <span>Prepared size</span>
          <span>{formatUsd(recommendation.deepbookAction.amountUsd)}</span>
        </div>
        <div className="strategyNote">{recommendation.deepbookAction.description}</div>
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
                  {expiryDays} {expiryDays === 1 ? 'day' : 'days'}
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
              min="1"
              step="0.5"
              type="number"
              value={predictSettings.budgetUsd}
              onChange={(event) =>
                onPredictSettingsChange({
                  ...predictSettings,
                  budgetUsd: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
