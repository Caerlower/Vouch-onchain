/**
 * Type-level mirror of on-chain gift-card vault accounts.
 * Source of truth: Rust program + IDL (`apps/backend/idl/gift_card_vault.json`).
 * Devnet program: 8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT
 */

export type VaultAccount = {
  sellerIdHash: Uint8Array; // 32
  sellerId: Uint8Array; // 32 padded
  sellerIdLen: number;
  owner: string;
  operator: string;
  mint: string;
  balanceAtomic: bigint;
  reservedAtomic: bigint;
  fundedAtomic: bigint;
  remittedAtomic: bigint;
  cardsMinted: number;
  cardsRedeemed: number;
  bump: number;
  tokenBump: number;
};

export type GiftCardAccount = {
  codeHash: Uint8Array;
  sellerIdHash: Uint8Array;
  endpointHash: Uint8Array;
  issuer: string;
  owner: string;
  hasOwner: boolean;
  faceValueAtomic: bigint;
  remainingAtomic: bigint;
  commissionAtomic: bigint;
  status: "minted" | "claimed" | "redeemed" | "exhausted";
  settleSigHash: Uint8Array;
  hasSettleSig: boolean;
  bump: number;
};

export type RemitReceipt = {
  settleSigHash: Uint8Array;
  buyer: string;
  issuer: string;
  rebateAtomic: bigint;
  commissionAtomic: bigint;
  card: string;
  bump: number;
};
