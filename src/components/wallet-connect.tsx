'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import { Wallet } from 'lucide-react';

export function WalletConnectButton() {
  return (
    <ConnectButton className="walletButton" connectText={<span><Wallet size={14} /> Connect wallet</span>} />
  );
}

