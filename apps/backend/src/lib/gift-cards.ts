/**
 * Endpoint-bound gift cards.
 * Mint after Agent A pays → claim by Agent B → redeem on x402 settle (rebate + commission).
 */
import { randomBytes } from "node:crypto";
import type { GiftCard, Seller } from "./types.js";
import { roundUsdc, shortAddr } from "./chain.js";
import { bumpCardsMinted, bumpCardsRedeemed, debitPool, getPool } from "./pool.js";
import { publish } from "./events.js";

const cards = new Map<string, GiftCard>();
const byCode = new Map<string, string>();

function codeFromBytes(): string {
  // Human-friendly: VOUCH-XXXX-XXXX
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `VOUCH-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

function idFromBytes(): string {
  return `gc_${randomBytes(6).toString("hex")}`;
}

export function listGiftCards(filter?: {
  sellerId?: string;
  owner?: string;
  issuer?: string;
}): GiftCard[] {
  let all = [...cards.values()];
  if (filter?.sellerId) all = all.filter((c) => c.sellerId === filter.sellerId);
  if (filter?.owner) {
    all = all.filter(
      (c) => c.owner?.toLowerCase() === filter.owner!.toLowerCase(),
    );
  }
  if (filter?.issuer) {
    all = all.filter(
      (c) => c.issuer.toLowerCase() === filter.issuer!.toLowerCase(),
    );
  }
  return all.sort((a, b) => b.mintedAt.localeCompare(a.mintedAt));
}

export function getGiftCard(id: string): GiftCard | undefined {
  return cards.get(id);
}

export function getGiftCardByCode(code: string): GiftCard | undefined {
  const id = byCode.get(code.trim().toUpperCase());
  return id ? cards.get(id) : undefined;
}

export function mintGiftCard(args: {
  seller: Seller;
  issuer: string;
  visibility?: "private" | "public";
}): GiftCard {
  const seller = args.seller;
  const face = roundUsdc(
    seller.basePriceUsdc * (seller.giftCardRebatePercent / 100),
  );
  const commission = roundUsdc(
    seller.basePriceUsdc * (seller.giftCardCommissionPercent / 100),
  );
  const totalNeed = roundUsdc(face + commission);
  const pool = getPool(seller.id);
  if (pool.balanceUsdc < totalNeed - 1e-9) {
    throw new Error("insufficient_pool");
  }

  const code = codeFromBytes();
  const card: GiftCard = {
    id: idFromBytes(),
    code,
    sellerId: seller.id,
    endpointUrl: seller.resourceUrl,
    issuer: args.issuer,
    owner: null,
    faceValueUsdc: face,
    remainingUsdc: face,
    commissionUsdc: commission,
    status: "minted",
    mintedAt: new Date().toISOString(),
    visibility: args.visibility || "private",
  };

  cards.set(card.id, card);
  byCode.set(code, card.id);
  bumpCardsMinted(seller.id);

  publish("giftcard.minted", `Gift card ${code} minted for ${seller.name}`, {
    cardId: card.id,
    code: card.code,
    sellerId: seller.id,
    endpointUrl: card.endpointUrl,
    issuer: card.issuer,
    faceValueUsdc: card.faceValueUsdc,
    commissionUsdc: card.commissionUsdc,
    visibility: card.visibility,
  });

  return { ...card };
}

export function claimGiftCard(code: string, owner: string): GiftCard {
  const card = getGiftCardByCode(code);
  if (!card) throw new Error("card_not_found");
  if (card.status === "redeemed" || card.status === "exhausted") {
    throw new Error("card_already_used");
  }
  if (card.owner && card.owner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error("card_owned_by_other");
  }
  if (card.issuer.toLowerCase() === owner.toLowerCase()) {
    throw new Error("self_claim_blocked");
  }

  card.owner = owner;
  card.status = "claimed";
  card.claimedAt = new Date().toISOString();

  publish("giftcard.claimed", `${shortAddr(owner)} claimed ${card.code}`, {
    cardId: card.id,
    code: card.code,
    owner,
    issuer: card.issuer,
    remainingUsdc: card.remainingUsdc,
  });

  return { ...card };
}

export function resolveGiftCardParam(raw: string | null | undefined): {
  card: GiftCard | null;
  reason: string;
} {
  if (!raw || !raw.trim()) return { card: null, reason: "none" };
  const card = getGiftCardByCode(raw.trim());
  if (!card) return { card: null, reason: "invalid_code" };
  if (card.status === "exhausted" || card.remainingUsdc <= 0) {
    return { card: null, reason: "exhausted" };
  }
  if (card.status === "redeemed") return { card: null, reason: "already_redeemed" };
  return { card, reason: "ok" };
}

/**
 * After a referred/gift-card payment settles: debit pool, mark card redeemed,
 * return remit amounts for MagicBlock split.
 */
export function redeemGiftCard(args: {
  card: GiftCard;
  buyer: string;
  settleTxId: string;
}): {
  rebateUsdc: number;
  commissionUsdc: number;
  issuer: string;
  card: GiftCard;
} {
  // Always mutate the store entry — callers may pass a shallow copy from quote.
  const card = cards.get(args.card.id) || getGiftCardByCode(args.card.code);
  if (!card) throw new Error("card_not_found");
  const { buyer, settleTxId } = args;

  if (card.issuer.toLowerCase() === buyer.toLowerCase()) {
    throw new Error("self_referral_blocked");
  }
  if (!card.owner) {
    card.owner = buyer;
    card.claimedAt = new Date().toISOString();
    card.status = "claimed";
  }
  if (card.owner.toLowerCase() !== buyer.toLowerCase()) {
    throw new Error("buyer_not_owner");
  }
  if (card.status === "redeemed" || card.remainingUsdc <= 0) {
    throw new Error("card_already_used");
  }

  const rebate = card.remainingUsdc;
  const commission = card.commissionUsdc;
  const total = roundUsdc(rebate + commission);

  publish("giftcard.redeeming", `Redeeming ${card.code} against x402 settle`, {
    cardId: card.id,
    code: card.code,
    settleTxId,
    rebateUsdc: rebate,
    commissionUsdc: commission,
    buyer,
    issuer: card.issuer,
  });

  debitPool(card.sellerId, total);
  bumpCardsRedeemed(card.sellerId);

  card.remainingUsdc = 0;
  card.status = "redeemed";
  card.redeemedAt = new Date().toISOString();
  card.settleTxId = settleTxId;

  publish(
    "giftcard.balance_updated",
    `${card.code} balance → $0.00 (fully redeemed)`,
    {
      cardId: card.id,
      code: card.code,
      remainingUsdc: 0,
      status: card.status,
    },
  );

  return {
    rebateUsdc: rebate,
    commissionUsdc: commission,
    issuer: card.issuer,
    card: { ...card },
  };
}

export function attachMagicblockTx(cardId: string, txId: string | null): void {
  const card = cards.get(cardId);
  if (card) card.magicblockTxId = txId;
}
