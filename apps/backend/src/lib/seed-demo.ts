import { registerSeller, getSeller } from "./sellers.js";
import { seedDemoPool } from "./pool.js";
import { publish } from "./events.js";
import { assertSafeOutboundUrl } from "./url-safety.js";
import { fetchSellerPaymentRequired, parsePaymentRequired } from "./pass-through.js";
import { atomicToUsdc, roundUsdc } from "./chain.js";
import { getConfig } from "./pricing.js";

export async function seedDemoSellerFromEnv(): Promise<void> {
  const url = process.env.DEMO_SELLER_URL?.trim();
  if (!url) return;
  if (getSeller("demo-thanks")) return;

  try {
    assertSafeOutboundUrl(url);
    const probed = await fetchSellerPaymentRequired(url);
    let payTo = process.env.SELLER_PAY_TO || "DemoSeller1111111111111111111111111111111";
    let price = getConfig().basePriceUsdc;

    if (probed.paymentRequiredHeader) {
      const parsed = parsePaymentRequired(probed.paymentRequiredHeader);
      if (parsed.payTo) payTo = parsed.payTo;
      if (parsed.amountAtomic) {
        price = roundUsdc(atomicToUsdc(Number(parsed.amountAtomic)));
      }
    }

    const seller = registerSeller({
      id: "demo-thanks",
      name: "Vouch Thanks",
      endpointUrl: url,
      resourceUrl: url,
      payoutAddress: payTo,
      basePriceUsdc: price || 0.05,
      giftCardRebatePercent: getConfig().rebatePercent,
      giftCardCommissionPercent: getConfig().commissionPercent,
    });
    seedDemoPool(seller.id, 5);
    publish("seller.registered", `Demo seller seeded · ${seller.resourceUrl}`, {
      sellerId: seller.id,
      payTo,
      price,
    });
    console.log(`[seed] demo seller ${seller.id} @ ${url}`);
  } catch (err) {
    console.warn("[seed] demo seller skipped:", err);
  }
}
