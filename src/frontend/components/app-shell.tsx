'use client';

import type { MouseEvent, ReactNode } from 'react';
import { BadgeInfo } from 'lucide-react';

import { PixelIcon, type PixelIconName } from './pixel-icon';

export type DemoSection = 'overview' | 'risk' | 'strategy' | 'audit' | 'prepare';

type AppShellProps = {
  networkBadge: string;
  walletLabel: string;
  walletButton: ReactNode;
  warnings: string[];
  activeSection: DemoSection;
  onSectionChange: (section: DemoSection) => void;
  children: ReactNode;
};

const demoSections = [
  { id: 'overview', label: 'Observe', subtitle: 'Wallet risk', step: '01', icon: 'overview' },
  { id: 'risk', label: 'Plan', subtitle: 'Risk response', step: '02', icon: 'risk' },
  { id: 'strategy', label: 'Verify Policy', subtitle: 'Check boundaries', step: '03', icon: 'policy' },
  { id: 'audit', label: 'Act', subtitle: 'Prepare proof', step: '04', icon: 'strategy' },
  { id: 'prepare', label: 'Remember', subtitle: 'Audit memory', step: '05', icon: 'archive' },
] as const;

export function scrollToDemoStage() {
  const target = document.querySelector<HTMLElement>('.overflowNav') ?? document.getElementById('risk-dashboard');

  if (!target) {
    return;
  }

  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY);

  window.scrollTo({ top, behavior: 'smooth' });
}

export function AppShell({
  networkBadge,
  walletLabel,
  walletButton,
  warnings,
  activeSection,
  onSectionChange,
  children,
}: AppShellProps) {
  function sectionHref(section: DemoSection): string {
    return `/?stage=${section}#risk-dashboard`;
  }

  function selectSection(event: MouseEvent<HTMLAnchorElement>, section: DemoSection) {
    event.preventDefault();
    onSectionChange(section);
    const url = new URL(window.location.href);
    url.searchParams.set('stage', section);
    url.searchParams.delete('demo');
    url.hash = 'risk-dashboard';
    window.history.replaceState(null, '', url);
    window.requestAnimationFrame(() => {
      scrollToDemoStage();
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
          <PixelIcon name="wallet" className="eventMark eventMarkPixel" />
          <span className="eventBrandCopy">
            <small>RiskPilot</small>
            <strong>Sui DeFi Agent with hard execution boundaries</strong>
          </span>
        </div>
        <div className="eventDate">
          <span className="pill pillNeutral">{networkBadge}</span>
          <div className="walletCluster eventWalletCluster">
            <span className="pill pillMuted">{walletLabel}</span>
            <div className="walletSlot">{walletButton}</div>
          </div>
        </div>
      </header>

      <section className="overflowHero" aria-label="RiskPilot overview">
        <div className="heroCopy">
          <p className="heroKicker">The Agentic Web · Sui mainnet</p>
          <h1 className="heroTitle">
            Risk
            <br />
            Pilot
            <br />
            2026
          </h1>
          <p className="heroOneLiner">
            RiskPilot is a Sui DeFi risk Agent that detects wallet exposure, proposes policy-bound actions, prepares evidence-only PTB proof, and stores verifiable audit memory on Walrus.
          </p>
          <div className="heroMeta">
            <span>
              <strong>Policy-gated Agent</strong>
              AI suggests, never overrides
            </span>
            <span>
              <strong>Prepared PTB, not submitted</strong>
              Wallet confirms before action
            </span>
            <span>
              <strong>Walrus audit memory</strong>
              Every decision can be replayed
            </span>
          </div>
          <div className="heroActionRow">
            <a className="heroButton" href="#risk-dashboard">
              Open Agent Loop <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="heroVisual" aria-hidden="true">
          <div className="visualGrid" />
        </div>
      </section>

      <nav className="overflowNav" aria-label="Demo stages">
        {demoSections.map((section) => {
          return (
            <a
              aria-current={activeSection === section.id ? 'step' : undefined}
              className={activeSection === section.id ? 'active' : ''}
              href={sectionHref(section.id)}
              key={section.id}
              onClick={(event) => selectSection(event, section.id)}
            >
              <PixelIcon name={section.icon as PixelIconName} className="navPixelIcon" />
              <span className="navText">
                <span className="navStep">Stage {section.step}</span>
                <strong>{section.label}</strong>
                <span className="navSubtitle">{section.subtitle}</span>
              </span>
              <span className="navBit" aria-hidden="true" />
            </a>
          );
        })}
      </nav>

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

      <main className="shellBody" id="risk-dashboard">{children}</main>
    </div>
  );
}
