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
        aria-label="断开钱包"
      >
        <LogOut size={14} />
        <span>{isPending ? '断开中...' : '断开钱包'}</span>
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
            <span>连接钱包</span>
          </button>
        }
      />
      <small className="walletConnectHint" suppressHydrationWarning>
        {open
          ? `连接面板已打开 · 检测到 ${walletCount} 个钱包`
          : walletCount > 0
            ? `检测到 ${walletCount} 个钱包`
            : '未检测到扩展钱包；连接面板会尝试 Slush Web fallback。'}
      </small>
    </div>
  );
}
