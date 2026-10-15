import { registerSeller, getSeller } from "./sellers.js";
import { seedDemoPool } from "./pool.js";
import { publish } from "./events.js";
import { assertSafeOutboundUrl } from "./url-safety.js";
import { fetchSellerPaymentRequired, parsePaymentRequired } from "./pass-through.js";
import { atomicToUsdc, roundUsdc } from "./chain.js";
import { getConfig } from "./pricing.js";
import { fundVaultOnchain, isVaultEnabled, vaultPda } from "./vault.js";

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

    const seedAmount = 5;
    seedDemoPool(seller.id, seedAmount);

    if (isVaultEnabled()) {
      const vault = await fundVaultOnchain({
        sellerId: seller.id,
        amountUsdc: seedAmount,
      });
      if (vault.ok) {
        publish(
          "pool.funded",
          `On-chain vault seeded · $${seedAmount} · ${vaultPda(seller.id).toBase58().slice(0, 8)}…`,
          {
            sellerId: seller.id,
            amountUsdc: seedAmount,
            vault: vault.signature,
            explorerUrl: vault.explorerUrl,
            vaultAddress: vaultPda(seller.id).toBase58(),
          },
        );
        console.log(
          `[seed] vault funded ${seller.id} tx=${vault.signature || vault.note}`,
        );
      } else {
        console.warn(`[seed] vault fund skipped/failed: ${vault.note}`);
      }
    }

    publish("seller.registered", `Demo seller seeded · ${seller.resourceUrl}`, {
      sellerId: seller.id,
      payTo,
      price,
      vaultAddress: isVaultEnabled() ? vaultPda(seller.id).toBase58() : null,
    });
    console.log(`[seed] demo seller ${seller.id} @ ${url}`);
  } catch (err) {
    console.warn("[seed] demo seller skipped:", err);
  }
}
