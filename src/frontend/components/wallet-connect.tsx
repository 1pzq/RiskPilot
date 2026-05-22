'use client';

import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { LogOut, Wallet } from 'lucide-react';
import { useState } from 'react';

export function WalletConnectButton() {
  const [open, setOpen] = useState(false);
  const account = useCurrentAccount();
  const { mutate: disconnectWallet, isPending } = useDisconnectWallet();

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
        <span>{isPending ? 'Disconnecting...' : 'Disconnect'}</span>
      </button>
    );
  }

  return (
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
  );
}
