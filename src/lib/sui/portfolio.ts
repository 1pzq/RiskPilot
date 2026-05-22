import type {
  AssetBalance,
  PortfolioSnapshot,
  WalletObjectKind,
  WalletObjectSummary,
  WalletScanSummary,
} from '../risk/types';
import { DEMO_SUI_PRICE_USD } from '../risk/fixtures';
import { SUI_COIN_TYPE, createMainnetSuiClient } from './client';

type CoinBalanceLike = {
  coinType: string;
  totalBalance: string;
};

type CoinMetadataLike = {
  decimals?: number | null;
  name?: string | null;
  symbol?: string | null;
};

export type MainnetPortfolioClient = {
  getAllBalances(input: { owner: string }): Promise<CoinBalanceLike[]>;
  getBalance(input: { owner: string; coinType?: string }): Promise<CoinBalanceLike>;
  getCoinMetadata(input: { coinType: string }): Promise<CoinMetadataLike | null>;
};

type OwnedObjectResponseLike = {
  data?: {
    objectId: string;
    type?: string | null;
    content?: {
      dataType?: string;
      fields?: unknown;
    } | null;
    version?: string;
    digest?: string;
    previousTransaction?: string | null;
    storageRebate?: string | null;
  } | null;
};

export type MainnetWalletObjectClient = {
  getOwnedObjects(input: {
    owner: string;
    cursor?: string | null;
    limit?: number | null;
    options?: {
      showContent?: boolean;
      showType?: boolean;
      showPreviousTransaction?: boolean;
      showStorageRebate?: boolean;
    };
  }): Promise<{
    data: OwnedObjectResponseLike[];
    hasNextPage: boolean;
    nextCursor?: string | null;
  }>;
};

const PRICE_MAP: Record<string, number> = {
  SUI: DEMO_SUI_PRICE_USD,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  WAL: 0.75,
  CETUS: 0.2,
};

const KNOWN_COIN_TYPES: Record<string, { symbol: string; decimals: number }> = {
  [SUI_COIN_TYPE]: { symbol: 'SUI', decimals: 9 },
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC': {
    symbol: 'USDC',
    decimals: 6,
  },
};

export function priceForSymbol(symbol: string): number {
  return PRICE_MAP[symbol.toUpperCase()] ?? 0;
}

function fallbackSymbolFromCoinType(coinType: string): string {
  const known = KNOWN_COIN_TYPES[coinType];

  if (known) {
    return known.symbol;
  }

  const maybeSymbol = coinType.split('::').at(-1);

  if (maybeSymbol && maybeSymbol.length <= 12 && /^[A-Z0-9_]+$/u.test(maybeSymbol)) {
    return maybeSymbol;
  }

  return 'Unknown Token';
}

function stripTypeArguments(type: string): string {
  return type.replace(/<.*$/u, '');
}

function extractCoinTypeFromObjectType(type: string): string | null {
  const match = type.match(/::coin::Coin<(.+)>$/u);
  return match?.[1] ?? null;
}

function parseMoveType(type: string): { packageId: string; module: string; struct: string } | null {
  const parts = stripTypeArguments(type).split('::');

  if (parts.length < 3) {
    return null;
  }

  return {
    packageId: parts[0],
    module: parts[1],
    struct: parts.slice(2).join('::'),
  };
}

function humanizeMoveName(value: string): string {
  return value
    .replace(/_/gu, ' ')
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

type ProtocolHint = {
  protocol: string;
  role: string;
};

const PROTOCOL_KEYWORDS: { protocol: string; keywords: string[] }[] = [
  { protocol: 'DeepBook', keywords: ['deepbook', 'deep_book', 'balance_manager', 'order', 'orderbook'] },
  { protocol: 'Cetus', keywords: ['cetus', 'clmm', 'tick', 'tick_lower', 'tick_upper'] },
  { protocol: 'Scallop', keywords: ['scallop', 'obligation', 'borrow', 'collateral'] },
  { protocol: 'Navi', keywords: ['navi', 'incentive_v2', 'lending_market', 'borrow_balance'] },
  { protocol: 'Aftermath', keywords: ['aftermath', 'af_lp', 'pool_position'] },
  { protocol: 'Bluefin', keywords: ['bluefin'] },
  { protocol: 'Turbos', keywords: ['turbos'] },
  { protocol: 'Kriya', keywords: ['kriya'] },
  { protocol: 'Haedal', keywords: ['haedal'] },
  { protocol: 'Bucket', keywords: ['bucket'] },
];

function classifyRoleFromType(type: string): string {
  const lowerType = type.toLowerCase();

  if (extractCoinTypeFromObjectType(type)) {
    return 'Coin balance';
  }

  if (lowerType.includes('strategy_receipt')) {
    return 'Audit receipt';
  }

  if (lowerType.includes('blob::blob')) {
    return 'Audit storage';
  }

  if (lowerType.includes('balance_manager')) {
    return 'Trading account';
  }

  if (lowerType.includes('order')) {
    return 'Order state';
  }

  if (lowerType.includes('obligation') || lowerType.includes('borrow') || lowerType.includes('collateral')) {
    return 'Lending position';
  }

  if (lowerType.includes('clmm') || lowerType.includes('liquidity') || lowerType.includes('lp') || lowerType.includes('pool')) {
    return 'Liquidity position';
  }

  if (lowerType.includes('vault')) {
    return 'Vault position';
  }

  if (lowerType.includes('stake')) {
    return 'Staking position';
  }

  if (lowerType.includes('upgradecap') || lowerType.includes('publisher')) {
    return 'Package authority';
  }

  if (lowerType.includes('position')) {
    return 'Position object';
  }

  return 'Owned object';
}

function classifyProtocolFromType(type: string, kind: WalletObjectKind, fields: unknown): ProtocolHint {
  if (kind === 'walrus_blob') {
    return { protocol: 'Walrus', role: 'Audit storage' };
  }

  if (kind === 'riskpilot_receipt') {
    return { protocol: 'RiskPilot', role: 'Audit receipt' };
  }

  if (kind === 'coin') {
    return { protocol: 'Sui', role: 'Coin balance' };
  }

  if (kind === 'package_cap') {
    return { protocol: 'Sui', role: 'Package authority' };
  }

  const searchText = `${type} ${JSON.stringify(fields ?? {})}`.toLowerCase();
  const match = PROTOCOL_KEYWORDS.find((candidate) =>
    candidate.keywords.some((keyword) => searchText.includes(keyword)),
  );

  if (match) {
    return { protocol: match.protocol, role: classifyRoleFromType(type) };
  }

  return { protocol: kind === 'defi_candidate' ? 'Unknown DeFi' : 'Sui', role: classifyRoleFromType(type) };
}

function walletObjectKindFromType(type: string): WalletObjectKind {
  if (extractCoinTypeFromObjectType(type)) {
    return 'coin';
  }

  if (type.endsWith('::blob::Blob')) {
    return 'walrus_blob';
  }

  if (type.endsWith('::strategy_receipt::StrategyReceipt')) {
    return 'riskpilot_receipt';
  }

  if (type.endsWith('::package::UpgradeCap') || type.endsWith('::package::Publisher')) {
    return 'package_cap';
  }

  const lowerType = type.toLowerCase();
  const defiHints = [
    'amm',
    'borrow',
    'clmm',
    'collateral',
    'deposit',
    'farm',
    'lending',
    'liquidity',
    'lp',
    'obligation',
    'pool',
    'position',
    'stake',
    'vault',
  ];

  return defiHints.some((hint) => lowerType.includes(hint)) ? 'defi_candidate' : 'other';
}

function walletObjectLabel(type: string, kind: WalletObjectKind): string {
  if (kind === 'coin') {
    const coinType = extractCoinTypeFromObjectType(type);
    return coinType ? `${fallbackSymbolFromCoinType(coinType)} coin object` : 'Coin object';
  }

  if (kind === 'walrus_blob') {
    return 'Walrus Blob';
  }

  if (kind === 'riskpilot_receipt') {
    return 'RiskPilot receipt';
  }

  if (kind === 'package_cap') {
    return 'Move package cap';
  }

  const parsed = parseMoveType(type);

  if (!parsed) {
    return 'Sui object';
  }

  return `${humanizeMoveName(parsed.module)} ${humanizeMoveName(parsed.struct)}`;
}

function fieldString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => fieldString(item)).filter(Boolean).join(', ') || undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id === 'string') {
    return record.id;
  }

  if (typeof record.value === 'string' || typeof record.value === 'number' || typeof record.value === 'boolean') {
    return String(record.value);
  }

  return undefined;
}

function nestedField(fields: unknown, path: string[]): string | undefined {
  let current: unknown = fields;

  for (const part of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    const record = current as Record<string, unknown>;

    if (part in record) {
      current = record[part];
      continue;
    }

    const nestedFields = record.fields;

    if (nestedFields && typeof nestedFields === 'object' && !Array.isArray(nestedFields) && part in nestedFields) {
      current = (nestedFields as Record<string, unknown>)[part];
      continue;
    }

    return undefined;
  }

  return fieldString(current);
}

function formatEpochRange(startEpoch: string | undefined, endEpoch: string | undefined): string | undefined {
  if (!startEpoch && !endEpoch) {
    return undefined;
  }

  if (startEpoch && endEpoch) {
    return `${startEpoch} → ${endEpoch}`;
  }

  return startEpoch ?? endEpoch;
}

function shortFactValue(value: string, maxLength = 42): string {
  return value.length <= maxLength ? value : `${value.slice(0, 18)}…${value.slice(-10)}`;
}

function buildObjectFacts(
  kind: WalletObjectKind,
  type: string,
  fields: unknown,
): WalletObjectSummary['facts'] {
  const facts: WalletObjectSummary['facts'] = [];

  if (kind === 'riskpilot_receipt') {
    const strategyId = nestedField(fields, ['strategy_id']);
    const auditBlobId = nestedField(fields, ['audit_blob_id']);
    const executionDigest = nestedField(fields, ['execution_digest']);

    if (strategyId) {
      facts.push({ label: 'Strategy', value: shortFactValue(strategyId) });
    }

    if (auditBlobId) {
      facts.push({ label: 'Audit blob', value: shortFactValue(auditBlobId) });
    }

    if (executionDigest) {
      facts.push({ label: 'Execution', value: shortFactValue(executionDigest) });
    }

    return facts;
  }

  if (kind === 'walrus_blob') {
    const size = nestedField(fields, ['size']);
    const certifiedEpoch = nestedField(fields, ['certified_epoch']);
    const registeredEpoch = nestedField(fields, ['registered_epoch']);
    const epochRange = formatEpochRange(
      nestedField(fields, ['storage', 'start_epoch']),
      nestedField(fields, ['storage', 'end_epoch']),
    );

    if (size) {
      facts.push({ label: 'Size', value: `${size} bytes` });
    }

    if (registeredEpoch) {
      facts.push({ label: 'Registered', value: `epoch ${registeredEpoch}` });
    }

    if (certifiedEpoch) {
      facts.push({ label: 'Certified', value: `epoch ${certifiedEpoch}` });
    }

    if (epochRange) {
      facts.push({ label: 'Storage', value: epochRange });
    }

    return facts;
  }

  if (kind === 'defi_candidate') {
    const parsed = parseMoveType(type);
    const positionId =
      nestedField(fields, ['position_id']) ??
      nestedField(fields, ['position', 'id']) ??
      nestedField(fields, ['pool_id']) ??
      nestedField(fields, ['pool', 'id']) ??
      nestedField(fields, ['obligation_id']) ??
      nestedField(fields, ['vault_id']);
    const liquidity =
      nestedField(fields, ['liquidity']) ??
      nestedField(fields, ['liquidity_amount']) ??
      nestedField(fields, ['lp_supply']);
    const lowerTick =
      nestedField(fields, ['tick_lower_index']) ??
      nestedField(fields, ['lower_tick']) ??
      nestedField(fields, ['tick_lower']);
    const upperTick =
      nestedField(fields, ['tick_upper_index']) ??
      nestedField(fields, ['upper_tick']) ??
      nestedField(fields, ['tick_upper']);
    const collateral = nestedField(fields, ['collateral']) ?? nestedField(fields, ['collateral_amount']);
    const debt = nestedField(fields, ['debt']) ?? nestedField(fields, ['borrowed']) ?? nestedField(fields, ['debt_amount']);

    if (parsed?.module) {
      facts.push({ label: 'Module', value: parsed.module });
    }

    if (parsed?.struct) {
      facts.push({ label: 'Struct', value: parsed.struct });
    }

    if (positionId) {
      facts.push({ label: 'Position', value: shortFactValue(positionId) });
    }

    if (liquidity) {
      facts.push({ label: 'Liquidity', value: shortFactValue(liquidity) });
    }

    if (lowerTick && upperTick) {
      facts.push({ label: 'Ticks', value: `${lowerTick} → ${upperTick}` });
    }

    if (collateral) {
      facts.push({ label: 'Collateral', value: shortFactValue(collateral) });
    }

    if (debt) {
      facts.push({ label: 'Debt', value: shortFactValue(debt) });
    }
  }

  return facts;
}

export function summarizeOwnedObject(response: OwnedObjectResponseLike): WalletObjectSummary | null {
  const object = response.data;
  const type = object?.type;

  if (!object || !type) {
    return null;
  }

  const kind = walletObjectKindFromType(type);
  const parsed = parseMoveType(type);
  const fields =
    object.content?.dataType === 'moveObject' && object.content.fields ? object.content.fields : undefined;
  const protocolHint = classifyProtocolFromType(type, kind, fields);

  return {
    objectId: object.objectId,
    type,
    kind,
    label: walletObjectLabel(type, kind),
    protocol: protocolHint.protocol,
    role: protocolHint.role,
    facts: buildObjectFacts(kind, type, fields),
    packageId: parsed?.packageId,
    module: parsed?.module,
    version: object.version,
    previousTransaction: object.previousTransaction ?? undefined,
    storageRebateMist: object.storageRebate ?? undefined,
  };
}

function buildProtocolHints(summaries: WalletObjectSummary[]): WalletScanSummary['protocolHints'] {
  const protocols = new Map<string, { count: number; roles: Set<string> }>();

  for (const summary of summaries) {
    if (summary.kind === 'coin' || summary.kind === 'other') {
      continue;
    }

    const existing = protocols.get(summary.protocol) ?? { count: 0, roles: new Set<string>() };
    existing.count += 1;
    existing.roles.add(summary.role);
    protocols.set(summary.protocol, existing);
  }

  return Array.from(protocols.entries())
    .map(([protocol, value]) => ({
      protocol,
      count: value.count,
      roles: Array.from(value.roles).sort(),
    }))
    .sort((left, right) => right.count - left.count || left.protocol.localeCompare(right.protocol));
}

function decimalsForCoin(coinType: string, metadata?: CoinMetadataLike | null): number {
  const metadataDecimals = metadata?.decimals;

  if (typeof metadataDecimals === 'number' && metadataDecimals >= 0 && metadataDecimals <= 18) {
    return metadataDecimals;
  }

  return KNOWN_COIN_TYPES[coinType]?.decimals ?? 9;
}

function amountFromAtomicBalance(totalBalance: string, decimals: number): number {
  const parsed = Number(totalBalance);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed / 10 ** decimals;
}

export function recalcAssetValue(asset: AssetBalance): AssetBalance {
  const usdPrice = priceForSymbol(asset.symbol);
  return {
    ...asset,
    usdPrice,
    usdValue: asset.amount * usdPrice,
  };
}

export function coinBalanceToAsset(
  balance: CoinBalanceLike,
  metadata?: CoinMetadataLike | null,
): AssetBalance {
  const known = KNOWN_COIN_TYPES[balance.coinType];
  const symbol = metadata?.symbol?.trim() || known?.symbol || fallbackSymbolFromCoinType(balance.coinType);
  const decimals = decimalsForCoin(balance.coinType, metadata);
  const amount = amountFromAtomicBalance(balance.totalBalance, decimals);
  const usdPrice = priceForSymbol(symbol);

  return {
    symbol,
    coinType: balance.coinType,
    amount,
    usdPrice,
    usdValue: amount * usdPrice,
  };
}

function shouldMergeAssets(base: AssetBalance, walletAsset: AssetBalance): boolean {
  return base.coinType === walletAsset.coinType || base.symbol === walletAsset.symbol;
}

export function mergeWalletAssetsWithDemoPortfolio(
  portfolio: PortfolioSnapshot,
  walletAssets: AssetBalance[] | null,
): PortfolioSnapshot {
  if (!walletAssets || walletAssets.length === 0) {
    return portfolio;
  }

  const unusedWalletAssets = new Set(walletAssets.map((asset) => asset.coinType));

  const assets = portfolio.assets.map((asset) => {
    const walletAsset = walletAssets.find((candidate) => shouldMergeAssets(asset, candidate));

    if (!walletAsset) {
      return asset;
    }

    unusedWalletAssets.delete(walletAsset.coinType);
    const amount = asset.amount + walletAsset.amount;
    const usdPrice = walletAsset.usdPrice || asset.usdPrice;
    return {
      ...asset,
      coinType: walletAsset.coinType === SUI_COIN_TYPE ? asset.coinType : walletAsset.coinType,
      amount,
      usdPrice,
      usdValue: amount * usdPrice,
    };
  });

  for (const walletAsset of walletAssets) {
    if (unusedWalletAssets.has(walletAsset.coinType) && walletAsset.amount > 0) {
      assets.push(walletAsset);
    }
  }

  return {
    ...portfolio,
    assets,
    totalUsdValue: assets.reduce((sum, asset) => sum + asset.usdValue, 0),
  };
}

export function buildWalletAssetsPortfolio(
  scenarioPortfolio: PortfolioSnapshot,
  walletAssets: AssetBalance[] | null,
): PortfolioSnapshot {
  if (!walletAssets) {
    return scenarioPortfolio;
  }

  const assets = walletAssets
    .filter((asset) => asset.amount > 0)
    .sort((left, right) => right.usdValue - left.usdValue || left.symbol.localeCompare(right.symbol));

  return {
    ...scenarioPortfolio,
    assets,
    lendingPositions: [],
    liquidityPositions: [],
    totalUsdValue: assets.reduce((sum, asset) => sum + asset.usdValue, 0),
  };
}

export function mergeWalletSuiBalance(portfolio: PortfolioSnapshot, walletSuiBalance: number | null): PortfolioSnapshot {
  if (walletSuiBalance == null) {
    return portfolio;
  }

  return mergeWalletAssetsWithDemoPortfolio(portfolio, [
    {
      symbol: 'SUI',
      coinType: SUI_COIN_TYPE,
      amount: walletSuiBalance,
      usdPrice: DEMO_SUI_PRICE_USD,
      usdValue: walletSuiBalance * DEMO_SUI_PRICE_USD,
    },
  ]);
}

export async function readMainnetWalletAssets(
  owner: string,
  client: MainnetPortfolioClient = createMainnetSuiClient(),
): Promise<AssetBalance[]> {
  const balances = await client.getAllBalances({ owner });

  return Promise.all(
    balances
      .filter((balance) => Number(balance.totalBalance) > 0)
      .map(async (balance) => {
        const metadata = await client.getCoinMetadata({ coinType: balance.coinType }).catch(() => null);
        return coinBalanceToAsset(balance, metadata);
      }),
  );
}

export async function readMainnetWalletScan(
  owner: string,
  client: MainnetWalletObjectClient = createMainnetSuiClient(),
): Promise<WalletScanSummary> {
  const summaries: WalletObjectSummary[] = [];
  let cursor: string | null | undefined = null;

  do {
    const page = await client.getOwnedObjects({
      owner,
      cursor,
      limit: 50,
      options: {
        showContent: true,
        showType: true,
        showPreviousTransaction: true,
        showStorageRebate: true,
      },
    });

    for (const item of page.data) {
      const summary = summarizeOwnedObject(item);

      if (summary) {
        summaries.push(summary);
      }
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor && summaries.length < 200);

  const nonCoinFirst = summaries
    .filter((item) => item.kind !== 'coin')
    .concat(summaries.filter((item) => item.kind === 'coin'));

  return {
    owner,
    scannedAt: new Date().toISOString(),
    totalObjects: summaries.length,
    coinObjects: summaries.filter((item) => item.kind === 'coin').length,
    walrusBlobs: summaries.filter((item) => item.kind === 'walrus_blob').length,
    receiptObjects: summaries.filter((item) => item.kind === 'riskpilot_receipt').length,
    defiCandidates: summaries.filter((item) => item.kind === 'defi_candidate').length,
    packageCaps: summaries.filter((item) => item.kind === 'package_cap').length,
    protocolHints: buildProtocolHints(summaries),
    sampleObjects: nonCoinFirst.slice(0, 8),
  };
}

export async function readMainnetSuiBalance(owner: string): Promise<number> {
  const client = createMainnetSuiClient();
  const balance = await client.getBalance({ owner, coinType: SUI_COIN_TYPE });

  return Number(balance.totalBalance) / 1_000_000_000;
}

export function describePortfolioSource(walletAddress: string): 'demo' | 'wallet-merged' {
  return walletAddress === '0xDEMO' ? 'demo' : 'wallet-merged';
}
