/**
 * Seller-prepaid gift-card pool (escrow analogue).
 * Demo keeps balances in-memory; production wires to the on-chain vault program.
 */
import type { GiftCardPool } from "./types.js";
import { roundUsdc } from "./chain.js";
import { publish } from "./events.js";

const pools = new Map<string, GiftCardPool>();

function ensure(sellerId: string): GiftCardPool {
  let p = pools.get(sellerId);
  if (!p) {
    p = {
      sellerId,
      balanceUsdc: 0,
      fundedUsdc: 0,
      remittedUsdc: 0,
      cardsMinted: 0,
      cardsRedeemed: 0,
    };
    pools.set(sellerId, p);
  }
  return p;
}

export function getPool(sellerId: string): GiftCardPool {
  return { ...ensure(sellerId) };
}

export function listPools(): GiftCardPool[] {
  return [...pools.values()].map((p) => ({ ...p }));
}

export function fundPool(
  sellerId: string,
  amountUsdc: number,
  from?: string,
): GiftCardPool {
  if (!(amountUsdc > 0)) throw new Error("invalid_amount");
  const p = ensure(sellerId);
  p.balanceUsdc = roundUsdc(p.balanceUsdc + amountUsdc);
  p.fundedUsdc = roundUsdc(p.fundedUsdc + amountUsdc);
  publish("pool.funded", `Gift-card pool +$${amountUsdc.toFixed(4)} USDC`, {
    sellerId,
    amountUsdc,
    balanceUsdc: p.balanceUsdc,
    from: from || null,
  });
  return { ...p };
}

export function debitPool(sellerId: string, amountUsdc: number): GiftCardPool {
  const p = ensure(sellerId);
  if (p.balanceUsdc < amountUsdc - 1e-9) throw new Error("insufficient_pool");
  p.balanceUsdc = roundUsdc(p.balanceUsdc - amountUsdc);
  p.remittedUsdc = roundUsdc(p.remittedUsdc + amountUsdc);
  return { ...p };
}

export function bumpCardsMinted(sellerId: string): void {
  ensure(sellerId).cardsMinted += 1;
}

export function bumpCardsRedeemed(sellerId: string): void {
  ensure(sellerId).cardsRedeemed += 1;
}

/** Seed a demo pool so the live demo works without a wallet deposit. */
export function seedDemoPool(sellerId: string, amountUsdc = 5): GiftCardPool {
  const p = ensure(sellerId);
  if (p.balanceUsdc > 0) return { ...p };
  return fundPool(sellerId, amountUsdc, "demo-seed");
}
