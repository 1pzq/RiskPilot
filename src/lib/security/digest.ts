import { canonicalize } from './canonicalize';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256WithWebCrypto(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 is not available in this runtime.');
  }

  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export async function sha256Hex(input: string): Promise<string> {
  return sha256WithWebCrypto(input);
}

export async function digestCanonicalJson(value: unknown): Promise<string> {
  return sha256Hex(canonicalize(value));
}
