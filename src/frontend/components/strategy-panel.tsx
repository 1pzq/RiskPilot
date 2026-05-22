'use client';

import { ArrowRightLeft, BarChart3, CalendarClock, ShieldAlert, Target } from 'lucide-react';
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

  return (
    <section className="panel">
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

      {marketSnapshot ? (
        <div className="positionBlock strategyBlock strategyMarketBlock">
          <div className="positionLine">
            <span>
              <BarChart3 size={14} />
              Live pool
            </span>
            <span>{marketSnapshot.poolKey}</span>
          </div>
          <div className="positionLine">
            <span>Mid price</span>
            <span>{formatUsd(marketSnapshot.midPrice)}</span>
          </div>
          <div className="positionLine">
            <span>1 SUI ≈</span>
            <span>{marketSnapshot.quoteOutForOneBase.toFixed(2)} USDC</span>
          </div>
          <div className="positionLine">
            <span>1 USDC ≈</span>
            <span>{marketSnapshot.baseOutForOneQuote.toFixed(4)} SUI</span>
          </div>
          <div className="positionLine">
            <span>Pool state</span>
            <span>{marketSnapshot.registeredPool ? 'registered' : 'unregistered'} · {marketSnapshot.whitelisted ? 'whitelisted' : 'open'}</span>
          </div>
          <div className="positionLine">
            <span>Vaults</span>
            <span>
              {marketSnapshot.vaultBalances.base.toFixed(2)} / {marketSnapshot.vaultBalances.quote.toFixed(2)} / {marketSnapshot.vaultBalances.deep.toFixed(2)}
            </span>
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

      <div className="positionBlock strategyBlock">
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
