'use client';

import { useState } from 'react';

const motifs = [
  {
    id: 'agent',
    tag: 'Agentic Web',
    title: '风险 Agent',
    copy: 'AI 工作流读取 Portfolio、解释敞口，并保持在 Policy 限制内。',
    tone: 'yellow',
    visual: 'key',
  },
  {
    id: 'walrus',
    tag: 'Walrus',
    title: '审计记忆',
    copy: '每个已准备动作都会成为可携带的决策包，并带有兜底安全存储。',
    tone: 'cyan',
    visual: 'walrus',
  },
  {
    id: 'deepbook',
    tag: 'DeepBook',
    title: '已准备保护',
    copy: 'DeepBook Predict 风格条款会为下行保护提前准备，但不进行 Live 提交。',
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

  return (
    <section className="motifSection panel" aria-label="Mainnet 原语流转">
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
              }}
            >
              <span className="trackTag">{motif.tag}</span>
              <span className="trackHeader">
                <span className="trackArrow">↝</span>
                <strong>{motif.title}</strong>
              </span>
              <span className="trackArt">
                <StickerVisual type={motif.visual} />
              </span>
              <span className="trackCopy">{motif.copy}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
