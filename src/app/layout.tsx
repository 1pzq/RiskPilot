import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from './providers';

import '@mysten/dapp-kit/dist/index.css';
import '@/frontend/styles/globals.css';

export const metadata: Metadata = {
  title: 'RiskPilot',
  description: 'A verifiable AI risk manager for Sui DeFi.',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
