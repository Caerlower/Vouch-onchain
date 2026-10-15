/**
 * Native Solana x402 seller — unlocks product after settle.
 * Works with real @x402/svm when a facilitator is available,
 * and always supports DEMO_MODE for local gift-card walkthroughs.
 */
import express from "express";
import cors from "cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";

const PORT = Number(process.env.PORT || 4101);
const NETWORK = (process.env.NETWORK ||
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1") as Network;
const USDC =
  process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const PAY_TO =
  process.env.SELLER_PAY_TO || "DemoSeller1111111111111111111111111111111";
const PRICE = process.env.BASE_PRICE_USDC
  ? `$${Number(process.env.BASE_PRICE_USDC).toFixed(2)}`
  : "$0.05";
const PUBLIC_URL = (
  process.env.PUBLIC_SELLER_URL || `http://localhost:${PORT}`
).replace(/\/+$/, "");
const DEMO_MODE =
  String(process.env.DEMO_MODE || "true").toLowerCase() === "true";
const RESOURCE_PATH = "/x402/thanks";
const RESOURCE_URL = `${PUBLIC_URL}${RESOURCE_PATH}`;

export function productPayload(extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    message: "This is Vouch on MagicBlock — thanks for using it",
    product: "vouch-thanks-solana",
    network: NETWORK,
    payTo: PAY_TO,
    generatedAt: new Date().toISOString(),
    ...extra,
  };
}

/** Minimal Solana-shaped PAYMENT-REQUIRED for demo probes / local walkthrough. */
function demoPaymentRequiredHeader(): string {
  const amount = Math.round(
    (Number(process.env.BASE_PRICE_USDC) || 0.05) * 1_000_000,
  ).toString();
  const payload = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        maxAmountRequired: amount,
        amount,
        asset: USDC,
        payTo: PAY_TO,
        resource: RESOURCE_URL,
        description: "Vouch MagicBlock demo thank-you payload",
        mimeType: "application/json",
        maxTimeoutSeconds: 60,
        extra: { name: "USDC", decimals: 6 },
      },
    ],
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

const app = express();
app.use(
  cors({
    origin: true,
    exposedHeaders: [
      "PAYMENT-REQUIRED",
      "PAYMENT-RESPONSE",
      "Payment-Required",
      "Payment-Response",
      "X-PAYMENT-RESPONSE",
    ],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "PAYMENT-SIGNATURE",
      "Payment-Signature",
      "X-PAYMENT",
      "X-PAYMENT-RESPONSE",
      "Access-Control-Expose-Headers",
    ],
  }),
);

let x402Ready = false;

async function tryInitX402() {
  try {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
    });
    const exactScheme = new ExactSvmScheme();
    exactScheme.registerMoneyParser(async (amount, network) => {
      if (network === NETWORK || String(network).startsWith("solana:")) {
        const n = typeof amount === "number" ? amount : Number(amount);
        return {
          amount: Math.floor(n * 1_000_000).toString(),
          asset: USDC,
          extra: { name: "USDC", decimals: 6 },
        };
      }
      return null;
    });

    const resourceServer = new x402ResourceServer(facilitatorClient).register(
      NETWORK,
      exactScheme,
    );
    await resourceServer.initialize();

    app.use(
      paymentMiddleware(
        {
          [`GET ${RESOURCE_PATH}`]: {
            accepts: {
              scheme: "exact",
              price: PRICE,
              network: NETWORK,
              payTo: PAY_TO,
            },
            description: "Vouch MagicBlock demo thank-you payload",
            mimeType: "application/json",
          },
        },
        resourceServer,
      ),
    );
    x402Ready = true;
    console.log(`[seller] x402 ExactSvmScheme ready via ${FACILITATOR_URL}`);
  } catch (err) {
    console.warn(
      "[seller] x402 facilitator init failed — demo header fallback active:",
      err instanceof Error ? err.message : err,
    );
  }
}

await tryInitX402();

app.get(RESOURCE_PATH, (req, res) => {
  const payment =
    req.get("PAYMENT-SIGNATURE") ||
    req.get("Payment-Signature") ||
    req.get("X-PAYMENT");

  // Demo settle
  if (DEMO_MODE && payment?.startsWith("demo:")) {
    const payer = payment.slice(5);
    return res.json(
      productPayload({
        surface: "demo-x402",
        payer,
        note: "Unlocked via demo payment header (local walkthrough).",
      }),
    );
  }

  // If real x402 middleware already handled auth, we only get here when paid.
  if (x402Ready && payment) {
    return res.json(
      productPayload({
        surface: "native-x402-solana",
        note: "Unlocked after Solana USDC settle via x402.",
      }),
    );
  }

  // Fallback 402 for local demos / probe
  const header = demoPaymentRequiredHeader();
  res.setHeader("PAYMENT-REQUIRED", header);
  res.setHeader("Payment-Required", header);
  return res.status(402).json({
    error: "payment_required",
    price: PRICE,
    network: NETWORK,
    payTo: PAY_TO,
    resource: RESOURCE_URL,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "vouch-magicblock-seller",
    port: PORT,
    resourceUrl: RESOURCE_URL,
    payTo: PAY_TO,
    price: PRICE,
    network: NETWORK,
    facilitator: FACILITATOR_URL,
    x402Ready,
    demoMode: DEMO_MODE,
    message: "This is Vouch on MagicBlock — thanks for using it",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[seller] listening on ${PUBLIC_URL}`);
  console.log(`[seller] GET ${RESOURCE_PATH}`);
  console.log(`[seller] Register in Vouch UI with: ${RESOURCE_URL}`);
});
