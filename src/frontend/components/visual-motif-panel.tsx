'use client';

import { useState } from 'react';

const motifs = [
  {
    id: 'agent',
    tag: 'Agentic Web',
    title: 'Risk agent',
    copy: 'An AI workflow reads the portfolio, explains exposure, and stays inside policy limits.',
    tone: 'yellow',
    visual: 'key',
  },
  {
    id: 'walrus',
    tag: 'Walrus',
    title: 'Audit memory',
    copy: 'Every prepared action becomes a portable decision package with fallback-safe storage.',
    tone: 'cyan',
    visual: 'walrus',
  },
  {
    id: 'deepbook',
    tag: 'DeepBook',
    title: 'Prepared cover',
    copy: 'DeepBook Predict-style terms are prepared for downside protection without live submission.',
    tone: 'purple',
    visual: 'cash',
  },
] as const;

function StickerVisual({ type }: { type: (typeof motifs)[number]['visual'] }) {
  if (type === 'key') {
    return (
      <div className="stickerVisual stickerKey" aria-hidden="true">
        <span className="keyHead" />
        <span className="keyStem" />
        <span className="keyTeeth" />
        <span className="keyGem keyGemOne" />
        <span className="keyGem keyGemTwo" />
      </div>
    );
  }

  if (type === 'walrus') {
    return (
      <div className="stickerVisual stickerWalrus" aria-hidden="true">
        <span className="walrusHead" />
        <span className="walrusShade" />
        <span className="walrusTusk walrusTuskLeft" />
        <span className="walrusTusk walrusTuskRight" />
        <span className="walrusWhisker walrusWhiskerOne" />
        <span className="walrusWhisker walrusWhiskerTwo" />
      </div>
    );
  }

  return (
    <div className="stickerVisual stickerCash" aria-hidden="true">
      <span className="cashBill cashOne" />
      <span className="cashBill cashTwo" />
      <span className="cashBand" />
      <span className="cashCircle" />
    </div>
  );
}

export function VisualMotifPanel() {
  const [activeId, setActiveId] = useState<(typeof motifs)[number]['id']>('agent');
  const [pulse, setPulse] = useState(0);

  return (
    <section className="motifSection panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Visual tracks</p>
          <h2 className="panelTitle">Mainnet primitives in motion</h2>
        </div>
        <span className="pill pillAccent">click cards</span>
      </div>

      <div className="trackCardGrid">
        {motifs.map((motif) => {
          const active = motif.id === activeId;

          return (
            <button
              className={`trackCard trackCard-${motif.tone} ${active ? 'trackCardActive' : ''}`}
              key={motif.id}
              type="button"
              onClick={() => {
                setActiveId(motif.id);
                setPulse((value) => value + 1);
              }}
            >
              <span className="trackTag">{motif.tag}</span>
              <span className="trackHeader">
                <span className="trackArrow">↝</span>
                <strong>{motif.title}</strong>
              </span>
              <span className="trackArt">
                <StickerVisual key={active ? `${motif.id}-${pulse}` : motif.id} type={motif.visual} />
              </span>
              <span className="trackCopy">{motif.copy}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
