/** Lightweight payment / agent stats for the ledger + demo gates. */

type AccountStats = {
  address: string;
  paymentsMade: number;
  giftCardsMinted: number;
  giftCardsRedeemed: number;
  rebateEarnedUsdc: number;
  commissionEarnedUsdc: number;
};

const accounts = new Map<string, AccountStats>();
const remits = new Map<string, Record<string, unknown>>();

function key(addr: string) {
  return addr.trim();
}

function ensure(address: string): AccountStats {
  const k = key(address);
  let a = accounts.get(k);
  if (!a) {
    a = {
      address: k,
      paymentsMade: 0,
      giftCardsMinted: 0,
      giftCardsRedeemed: 0,
      rebateEarnedUsdc: 0,
      commissionEarnedUsdc: 0,
    };
    accounts.set(k, a);
  }
  return a;
}

export function recordPayment(address: string): void {
  ensure(address).paymentsMade += 1;
}

export function recordGiftMint(address: string): void {
  ensure(address).giftCardsMinted += 1;
}

export function recordGiftRedeem(args: {
  buyer: string;
  issuer: string;
  rebateUsdc: number;
  commissionUsdc: number;
}): void {
  ensure(args.buyer).giftCardsRedeemed += 1;
  ensure(args.buyer).rebateEarnedUsdc += args.rebateUsdc;
  ensure(args.issuer).commissionEarnedUsdc += args.commissionUsdc;
}

export function hasPaymentHistory(address: string): boolean {
  return (accounts.get(key(address))?.paymentsMade || 0) > 0;
}

export function getStats(address: string): AccountStats {
  return { ...ensure(address) };
}

export function allAccounts(): AccountStats[] {
  return [...accounts.values()].map((a) => ({ ...a }));
}

export function storeRemit(settleTxId: string, data: Record<string, unknown>) {
  remits.set(settleTxId, { ...data, settleTxId });
}

export function getRemit(settleTxId: string) {
  return remits.get(settleTxId) || null;
}
