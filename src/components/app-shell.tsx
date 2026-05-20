'use client';

import type { ReactNode } from 'react';
import { BadgeInfo } from 'lucide-react';

import { PixelIcon, type PixelIconName } from './pixel-icon';

export type DemoSection = 'overview' | 'risk' | 'strategy' | 'audit' | 'prepare';

type AppShellProps = {
  networkBadge: string;
  executionBadge: string;
  walletLabel: string;
  walletButton: ReactNode;
  warnings: string[];
  activeSection: DemoSection;
  onSectionChange: (section: DemoSection) => void;
  children: ReactNode;
};

const demoSections = [
  { id: 'overview', label: 'Overview', step: '01', icon: 'overview' },
  { id: 'risk', label: 'Risk', step: '02', icon: 'risk' },
  { id: 'strategy', label: 'Strategy', step: '03', icon: 'strategy' },
  { id: 'audit', label: 'Audit', step: '04', icon: 'audit' },
  { id: 'prepare', label: 'Prepare', step: '05', icon: 'prepare' },
] as const;

function formatExecutionBadge(value: string): string {
  if (value === 'prepare_mainnet') {
    return 'prepare-only mainnet';
  }

  if (value === 'simulation') {
    return 'local simulation';
  }

  return value.replace(/_/g, ' ');
}

export function AppShell({
  networkBadge,
  executionBadge,
  walletLabel,
  walletButton,
  warnings,
  activeSection,
  onSectionChange,
  children,
}: AppShellProps) {
  function selectSection(section: DemoSection) {
    onSectionChange(section);
    window.requestAnimationFrame(() => {
      document.getElementById('risk-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="appShell">
      <div className="ambientStickerLayer" aria-hidden="true">
        <span className="ambientSticker ambientStickerOne">◆</span>
        <span className="ambientSticker ambientStickerTwo">↗</span>
        <span className="ambientSticker ambientStickerThree">◌</span>
        <span className="ambientSticker ambientStickerFour">{'///'}</span>
      </div>

      <header className="eventHeader">
        <div className="eventBrand">
          <span className="eventMark" aria-hidden="true">
            RP
          </span>
          <span className="eventBrandCopy">
            <strong>RiskPilot Overflow 2026</strong>
            <small>Sui mainnet prepare desk</small>
          </span>
        </div>
        <div className="eventDate">
          <span className="eventModeDot" aria-hidden="true" />
          <span className="eventCode">&lt;mode&gt;</span>
          <strong>{formatExecutionBadge(executionBadge)}</strong>
          <span className="eventCode">&lt;/mode&gt;</span>
        </div>
      </header>

      <section className="overflowHero" aria-label="RiskPilot overview">
        <div className="heroCopy">
          <p className="heroKicker">Sui mainnet risk workflow</p>
          <h1 className="heroTitle">
            Risk
            <br />
            Pilot
            <br />
            2026
          </h1>
          <div className="heroMeta">
            <span>Mainnet prepare mode</span>
            <span>Walrus audit trail</span>
            <span>DeepBook risk action</span>
          </div>
          <div className="heroActionRow">
            <a className="heroButton" href="#risk-dashboard">
              Open dashboard <span aria-hidden="true">↗</span>
            </a>
            <div className="heroPartnerLines">
              <span>Execution primitive: <strong>DeepBook</strong></span>
              <span>Audit layer: <strong>Walrus</strong></span>
            </div>
          </div>
        </div>

        <div className="heroVisual" aria-hidden="true">
          <div className="visualGrid" />
          <div className="floatBlock blockR">R</div>
          <div className="floatBlock blockI">I</div>
          <div className="floatBlock blockS">S</div>
          <div className="floatBlock blockK">K</div>
          <div className="floatBlock blockAi">AI</div>
          <div className="floatBlock blockWal">WAL</div>
          <div className="cursorBlock">↗</div>
        </div>
      </section>

      <nav className="overflowNav" aria-label="Demo stages">
        {demoSections.map((section) => {
          return (
            <button
              className={activeSection === section.id ? 'active' : ''}
              key={section.id}
              type="button"
              onClick={() => selectSection(section.id)}
            >
              <PixelIcon name={section.icon as PixelIconName} className="navPixelIcon" />
              <span className="navText">
                <span className="navStep">Stage {section.step}</span>
                <strong>{section.label}</strong>
              </span>
              <span className="navBit" aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <header className="topBar" id="risk-dashboard">
        <div className="brandBlock">
          <PixelIcon name="wallet" className="brandMark brandMarkPixel" />
          <div>
            <p className="eyebrow">RiskPilot</p>
            <h1 className="brandTitle">Verifiable AI risk manager for Sui DeFi</h1>
          </div>
        </div>

        <div className="headerMeta">
          <span className="pill pillNeutral">{networkBadge}</span>
          <span className="pill pillAccent">{formatExecutionBadge(executionBadge)}</span>
          <span className="pill pillMuted">{walletLabel}</span>
          <div className="walletSlot">{walletButton}</div>
        </div>
      </header>

      {warnings.length > 0 ? (
        <section className="warningStrip" aria-label="Warnings">
          <BadgeInfo size={16} />
          <div className="warningList">
            {warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        </section>
      ) : null}

      <main className="shellBody">{children}</main>
    </div>
  );
}
