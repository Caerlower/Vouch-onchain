import { getSeller } from "./sellers.js";
import { resolveGiftCardParam } from "./gift-cards.js";
import { roundUsdc } from "./chain.js";
import type { Quote } from "./types.js";

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

export function getConfig() {
  return {
    basePriceUsdc: envNumber("BASE_PRICE_USDC", 0.05),
    rebatePercent: envNumber("GIFT_CARD_REBATE_PERCENT", 20),
    commissionPercent: envNumber("GIFT_CARD_COMMISSION_PERCENT", 8),
  };
}

export function extractGiftCard(req: {
  query?: Record<string, unknown>;
  get?: (n: string) => string | undefined;
}): string | null {
  const q = req.query?.gift || req.query?.card || req.query?.gc || req.query?.ref;
  if (typeof q === "string" && q.trim()) return q.trim();
  const h = req.get?.("x-gift-card") || req.get?.("x-referral");
  if (typeof h === "string" && h.trim()) return h.trim();
  return null;
}

export function extractSellerId(req: {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): string | null {
  if (req.params?.sellerId) return String(req.params.sellerId);
  if (req.query?.sellerId) return String(req.query.sellerId);
  return null;
}

export async function getPrice(
  rawGift: string | null,
  opts: { sellerId?: string } = {},
): Promise<Quote> {
  const sellerId = opts.sellerId;
  if (!sellerId) throw new Error("seller_required");
  const seller = getSeller(sellerId);
  if (!seller) throw new Error("seller_not_found");

  const base = seller.basePriceUsdc;
  const { card, reason } = resolveGiftCardParam(rawGift);
  const eligible =
    Boolean(card) &&
    card!.sellerId === sellerId &&
    (card!.status === "minted" || card!.status === "claimed") &&
    card!.remainingUsdc > 0;

  return {
    price: roundUsdc(base),
    priceLabel: `$${roundUsdc(base).toFixed(2)}`,
    basePrice: roundUsdc(base),
    sellerShareUsdc: roundUsdc(base),
    giftCardEligible: eligible,
    giftCardReason: eligible ? "ok" : reason,
    rebateUsdc: eligible ? card!.remainingUsdc : 0,
    commissionUsdc: eligible ? card!.commissionUsdc : 0,
    giftCard: eligible && card ? { ...card } : null,
    sellerId,
    sellerMode: "native",
  };
}
