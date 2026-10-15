/** Solana Devnet defaults for Vouch MagicBlock. */

export const SOLANA_DEVNET_CAIP =
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const SOLANA_MAINNET_CAIP =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** Circle Devnet USDC */
export const USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
/** Native mainnet USDC */
export const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const SOLANA_EXPLORER = "https://explorer.solana.com";
export const MAGICBLOCK_PAYMENTS_DEFAULT = "https://payments.magicblock.app";

export function roundUsdc(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function usdcToAtomic(usdc: number): number {
  return Math.round(usdc * 1_000_000);
}

export function atomicToUsdc(atomic: number): number {
  return roundUsdc(atomic / 1_000_000);
}

export function explorerTxUrl(
  sig: string,
  cluster: string = "devnet",
): string {
  const c = cluster === "mainnet-beta" || cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `${SOLANA_EXPLORER}/tx/${sig}${c}`;
}

export function explorerAddressUrl(
  address: string,
  cluster: string = "devnet",
): string {
  const c = cluster === "mainnet-beta" || cluster === "mainnet" ? "" : `?cluster=${cluster}`;
  return `${SOLANA_EXPLORER}/address/${address}${c}`;
}

export function isSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export function shortAddr(s: string, n = 4): string {
  if (!s || s.length < 10) return s || "";
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}
