'use client';

import { DatabaseZap, ShieldCheck, WalletCards } from 'lucide-react';
import { useWallets } from '@mysten/dapp-kit';
export function WalletRequiredPanel() {
  const wallets = useWallets();
  const walletNames = wallets.map((wallet) => wallet.name).join(', ');

  return (
    <section className="panel walletRequiredPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">真实数据模式</p>
          <h2 className="panelTitle">连接 Sui mainnet 钱包</h2>
        </div>
        <span className="pill pillWarn">需要钱包</span>
      </div>

      <div className="walletRequiredGrid">
        <div>
          <WalletCards size={16} />
          <strong>Mainnet 钱包读取</strong>
          <span>余额和已拥有对象会从已连接钱包加载。</span>
        </div>
        <div>
          <DatabaseZap size={16} />
          <strong>Live 证据路径</strong>
          <span>DeepBook 证据、执行意图和归档上下文都基于当前钱包状态构建。</span>
        </div>
        <div>
          <ShieldCheck size={16} />
          <strong>不使用固定演示数据</strong>
          <span>连接钱包后，评估路径使用真实数据。</span>
        </div>
      </div>

      <div className="noteRow">
        <WalletCards size={14} />
        <span suppressHydrationWarning>
          {wallets.length > 0
            ? `当前页面检测到 ${wallets.length} 个钱包：${walletNames}`
            : '当前页面暂未检测到扩展钱包；Slush Web fallback 应仍可在连接面板中打开。若点击无反应，请刷新页面或确认 Slush 对 127.0.0.1 有站点访问权限。'}
        </span>
      </div>
    </section>
  );
}
