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
  { id: 'overview', label: 'Observe', subtitle: '读取钱包风险', step: '01', icon: 'overview' },
  { id: 'risk', label: 'Plan', subtitle: '生成应对方案', step: '02', icon: 'risk' },
  { id: 'strategy', label: 'Verify Policy', subtitle: '检查授权边界', step: '03', icon: 'policy' },
  { id: 'audit', label: 'Act', subtitle: '准备 PTB 证明', step: '04', icon: 'strategy' },
  { id: 'prepare', label: 'Remember', subtitle: '归档审计记忆', step: '05', icon: 'archive' },
] as const;

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
          <PixelIcon name="wallet" className="eventMark eventMarkPixel" />
          <span className="eventBrandCopy">
            <small>RiskPilot</small>
            <strong>在授权边界内行动的 Sui DeFi Agent</strong>
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
            RiskPilot 让 Sui DeFi Agent 会分析风险，但不能越权行动：AI 只给建议，Policy 先做边界检查，钱包确认后才准备 PTB，最后用 Walrus 留下可验证记忆。
          </p>
          <div className="heroMeta">
            <span>
              <strong>Policy-gated Agent</strong>
              AI 只建议，不越权
            </span>
            <span>
              <strong>Prepared PTB, not submitted</strong>
              钱包不签名就不提交
            </span>
            <span>
              <strong>Walrus audit memory</strong>
              每次决策可回放验证
            </span>
          </div>
          <div className="heroActionRow">
            <a className="heroButton" href="#risk-dashboard">
              打开 Agent Loop <span aria-hidden="true">↗</span>
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
