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
          <p className="eyebrow">Live data mode</p>
          <h2 className="panelTitle">Connect a Sui mainnet wallet</h2>
        </div>
        <span className="pill pillWarn">Wallet required</span>
      </div>

      <div className="walletRequiredGrid">
        <div>
          <WalletCards size={16} />
          <strong>Mainnet wallet read</strong>
          <span>Balances and owned objects load from the connected wallet.</span>
        </div>
        <div>
          <DatabaseZap size={16} />
          <strong>Live evidence path</strong>
          <span>DeepBook evidence, execution intent, and archive context are built from current wallet state.</span>
        </div>
        <div>
          <ShieldCheck size={16} />
          <strong>No fixed demo data</strong>
          <span>After wallet connection, the evaluation path uses real data.</span>
        </div>
      </div>

      <div className="noteRow">
        <WalletCards size={14} />
        <span suppressHydrationWarning>
          {wallets.length > 0
            ? `${wallets.length} wallets detected on this page: ${walletNames}`
            : 'No extension wallet detected on this page yet. Slush Web fallback should still open in the connect panel. If nothing happens, refresh or confirm Slush has site access for 127.0.0.1.'}
        </span>
      </div>
    </section>
  );
}
