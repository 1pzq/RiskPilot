'use client';

import { ConnectModal, useCurrentAccount, useDisconnectWallet, useWallets } from '@mysten/dapp-kit';
import { LogOut, Wallet } from 'lucide-react';
import { useState } from 'react';

export function WalletConnectButton() {
  const [open, setOpen] = useState(false);
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: disconnectWallet, isPending } = useDisconnectWallet();
  const walletCount = wallets.length;

  if (account) {
    return (
      <button
        className="walletButton walletButtonDisconnect"
        type="button"
        onClick={() => disconnectWallet()}
        disabled={isPending}
        aria-label="Disconnect wallet"
      >
        <LogOut size={14} />
        <span>{isPending ? 'Disconnecting...' : 'Disconnect wallet'}</span>
      </button>
    );
  }

  return (
    <div className="walletConnectStack">
      <ConnectModal
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button className="walletButton" type="button">
            <Wallet size={14} />
            <span>Connect wallet</span>
          </button>
        }
      />
      <small className="walletConnectHint" suppressHydrationWarning>
        {open
          ? `Connect panel open · ${walletCount} wallets detected`
          : walletCount > 0
            ? `${walletCount} wallets detected`
            : 'No extension wallet detected; the connect panel will try Slush Web fallback.'}
      </small>
    </div>
  );
}
