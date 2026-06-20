import type { DeepBookLiveMarketSnapshot } from '@/lib/sui/deepbook-live';
import type { AuditPackage, DeepBookMarketEvidence } from './types';
import { makePrefixedId } from '@/lib/utils/ids';

export function createDeepBookMarketEvidence(input: {
  snapshot: DeepBookLiveMarketSnapshot | null;
  walletAddress?: string;
  poolKey?: string;
  routeStatus?: DeepBookMarketEvidence['routeStatus'];
  error?: string | null;
}): DeepBookMarketEvidence {
  const poolKey = input.snapshot?.poolKey ?? input.poolKey ?? 'SUI_USDC';

  if (!input.snapshot) {
    return {
      source: '/api/deepbook-market',
      status: 'unavailable',
      routeStatus: input.routeStatus,
      walletAddress: input.walletAddress,
      poolKey,
      poolStatus: 'unknown',
      whitelistStatus: 'unknown',
      error: input.error ?? undefined,
      fallbackReason: input.error
        ? 'DeepBook market snapshot was unavailable when this audit package was prepared.'
        : 'DeepBook market snapshot had not loaded when this audit package was prepared.',
    };
  }

  return {
    source: '/api/deepbook-market',
    status: 'ready',
    routeStatus: input.routeStatus,
    walletAddress: input.walletAddress,
    poolKey: input.snapshot.poolKey,
    poolAddress: input.snapshot.poolAddress,
    baseCoin: input.snapshot.baseCoin,
    quoteCoin: input.snapshot.quoteCoin,
    midPrice: input.snapshot.midPrice,
    quoteOutForOneBase: input.snapshot.quoteOutForOneBase,
    baseOutForOneQuote: input.snapshot.baseOutForOneQuote,
    vaultBalances: input.snapshot.vaultBalances,
    tradeParams: input.snapshot.tradeParams,
    registeredPool: input.snapshot.registeredPool,
    whitelisted: input.snapshot.whitelisted,
    poolStatus: input.snapshot.registeredPool ? 'registered' : 'unregistered',
    whitelistStatus: input.snapshot.whitelisted ? 'whitelisted' : 'open',
    fetchedAt: input.snapshot.fetchedAt,
  };
}

export function createAuditPackage(input: Omit<AuditPackage, 'id' | 'createdAt'>): AuditPackage {
  const createdAt = new Date().toISOString();
  const id = makePrefixedId('audit', JSON.stringify({ createdAt, ...input }));

  return {
    id,
    createdAt,
    ...input,
  };
}
