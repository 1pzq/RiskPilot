import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

export const MAINNET_RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? 'https://fullnode.mainnet.sui.io:443';
export const SUI_COIN_TYPE = '0x2::sui::SUI';

export function createMainnetSuiClient() {
  return new SuiJsonRpcClient({ network: 'mainnet', url: MAINNET_RPC_URL });
}
