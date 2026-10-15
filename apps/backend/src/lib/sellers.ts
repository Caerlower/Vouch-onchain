import type { PublicSeller, Seller } from "./types.js";

const sellers = new Map<string, Seller>();

export function listSellers(): PublicSeller[] {
  return [...sellers.values()].map(toPublic);
}

export function getSeller(id: string): Seller | undefined {
  return sellers.get(id);
}

export function clearSellers(): void {
  sellers.clear();
}

export function deleteSeller(id: string): boolean {
  return sellers.delete(id);
}

export function registerSeller(input: {
  id?: string;
  name: string;
  endpointUrl: string;
  resourceUrl: string;
  payoutAddress: string;
  basePriceUsdc: number;
  giftCardRebatePercent?: number;
  giftCardCommissionPercent?: number;
}): Seller {
  const id =
    input.id?.trim() ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) ||
    `seller-${Date.now().toString(36)}`;

  const seller: Seller = {
    id,
    mode: "native",
    name: input.name,
    endpointUrl: input.endpointUrl,
    resourceUrl: input.resourceUrl,
    payoutAddress: input.payoutAddress,
    basePriceUsdc: input.basePriceUsdc,
    giftCardRebatePercent: input.giftCardRebatePercent ?? 20,
    giftCardCommissionPercent: input.giftCardCommissionPercent ?? 8,
    createdAt: new Date().toISOString(),
  };
  sellers.set(id, seller);
  return seller;
}

function toPublic(s: Seller): PublicSeller {
  return {
    id: s.id,
    name: s.name,
    mode: s.mode,
    resourceUrl: s.resourceUrl,
    payoutAddress: s.payoutAddress,
    basePriceUsdc: s.basePriceUsdc,
    giftCardRebatePercent: s.giftCardRebatePercent,
    giftCardCommissionPercent: s.giftCardCommissionPercent,
    createdAt: s.createdAt,
  };
}
