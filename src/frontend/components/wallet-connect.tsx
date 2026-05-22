'use client';

import { ConnectModal } from '@mysten/dapp-kit';
import { Wallet } from 'lucide-react';
import { useState } from 'react';

export function WalletConnectButton() {
  const [open, setOpen] = useState(false);

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
