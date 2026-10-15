/**
 * Type-level sketch of on-chain gift-card vault accounts.
 * Deploy with Anchor when ready; backend pool/gift-cards mirror this today.
 */

export type VaultAccount = {
  sellerId: string;
  owner: string;
  operator: string;
  mint: string;
  balanceAtomic: bigint;
  cardsMinted: number;
  cardsRedeemed: number;
  bump: number;
};

export type GiftCardAccount = {
  codeHash: Uint8Array;
  sellerId: string;
  endpointHash: Uint8Array;
  issuer: string;
  owner: string | null;
  faceValueAtomic: bigint;
  remainingAtomic: bigint;
  commissionAtomic: bigint;
  status: "minted" | "claimed" | "redeemed" | "exhausted";
  settleSig: string | null;
  bump: number;
};

export type RemitReceipt = {
  settleSig: string;
  buyer: string;
  issuer: string;
  rebateAtomic: bigint;
  commissionAtomic: bigint;
  magicblockClientRef: string;
  bump: number;
};
