export type SellerMode = "native";

export interface Seller {
  id: string;
  mode: SellerMode;
  name: string;
  endpointUrl: string;
  resourceUrl: string;
  payoutAddress: string;
  basePriceUsdc: number;
  /** Face value of each gift card as % of list price (buyer rebate). */
  giftCardRebatePercent: number;
  /** Commission to gift-card issuer as % of list price. */
  giftCardCommissionPercent: number;
  createdAt: string;
}

export interface PublicSeller {
  id: string;
  name: string;
  mode: SellerMode;
  resourceUrl: string;
  payoutAddress: string;
  basePriceUsdc: number;
  giftCardRebatePercent: number;
  giftCardCommissionPercent: number;
  createdAt: string;
}

export type GiftCardStatus =
  | "minted"
  | "claimed"
  | "redeemed"
  | "exhausted";

/**
 * Endpoint-bound prepaid balance agents can redeem against a specific x402 URL.
 * Same economics as the Monad rebate — packaged as a tangible gift card.
 */
export interface GiftCard {
  id: string;
  code: string;
  sellerId: string;
  endpointUrl: string;
  issuer: string;
  owner: string | null;
  faceValueUsdc: number;
  remainingUsdc: number;
  commissionUsdc: number;
  status: GiftCardStatus;
  mintedAt: string;
  claimedAt?: string;
  redeemedAt?: string;
  settleTxId?: string;
  magicblockTxId?: string | null;
  visibility: "private" | "public";
}

export interface GiftCardPool {
  sellerId: string;
  balanceUsdc: number;
  fundedUsdc: number;
  remittedUsdc: number;
  cardsMinted: number;
  cardsRedeemed: number;
}

export interface Quote {
  price: number;
  priceLabel: string;
  basePrice: number;
  sellerShareUsdc: number;
  giftCardEligible: boolean;
  giftCardReason: string;
  rebateUsdc: number;
  commissionUsdc: number;
  giftCard: GiftCard | null;
  sellerId: string;
  sellerMode: SellerMode;
}

export type LiveEventType =
  | "hello"
  | "seller.registered"
  | "pool.funded"
  | "payment.challenge"
  | "payment.settled"
  | "giftcard.minted"
  | "giftcard.claimed"
  | "giftcard.redeeming"
  | "remit.queued"
  | "remit.magicblock"
  | "giftcard.balance_updated"
  | "demo.step"
  | "error";

export interface LiveEvent {
  id: string;
  type: LiveEventType;
  ts: string;
  message: string;
  data?: Record<string, unknown>;
}
