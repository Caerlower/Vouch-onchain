/**
 * Vouch MagicBlock backend — x402 pass-through + endpoint gift cards + live events.
 */
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import {
  SOLANA_DEVNET_CAIP,
  USDC_DEVNET,
  SOLANA_EXPLORER,
  roundUsdc,
  atomicToUsdc,
  isSolanaAddress,
  shortAddr,
} from "./lib/chain.js";
import {
  getConfig,
  getPrice,
  extractGiftCard,
  extractSellerId,
} from "./lib/pricing.js";
import {
  getSeller,
  listSellers,
  registerSeller,
  clearSellers,
  deleteSeller,
} from "./lib/sellers.js";
import {
  mintGiftCard,
  claimGiftCard,
  getGiftCard,
  getGiftCardByCode,
  listGiftCards,
  redeemGiftCard,
  attachMagicblockTx,
} from "./lib/gift-cards.js";
import {
  getPool,
  listPools,
  fundPool,
  seedDemoPool,
} from "./lib/pool.js";
import {
  recordPayment,
  recordGiftMint,
  recordGiftRedeem,
  hasPaymentHistory,
  getStats,
  allAccounts,
  storeRemit,
  getRemit,
} from "./lib/payments.js";
import { magicblockStatus, remitGiftCardSplit } from "./lib/magicblock.js";
import { attachSse, publish, recentEvents } from "./lib/events.js";
import { assertSafeOutboundUrl } from "./lib/url-safety.js";
import { seedDemoSellerFromEnv } from "./lib/seed-demo.js";
import {
  pickPaymentHeader,
  decodePaymentPayload,
  decodePaymentResponseHeader,
  resolveSettleTxId,
  resolvePayer,
  forwardPaymentToSeller,
  fetchSellerPaymentRequired,
  parsePaymentRequired,
} from "./lib/pass-through.js";

const PORT = Number(process.env.PORT || 4100);
const PUBLIC_SITE_URL = (
  process.env.PUBLIC_SITE_URL || "http://localhost:5174"
).replace(/\/+$/, "");
const DEMO_MODE =
  String(process.env.DEMO_MODE || "true").toLowerCase() === "true";
const USDC = process.env.USDC_MINT || USDC_DEVNET;
const NETWORK = process.env.NETWORK || SOLANA_DEVNET_CAIP;
const CLUSTER = process.env.SOLANA_CLUSTER || "devnet";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const OPERATOR =
  process.env.VOUCH_OPERATOR_PUBKEY ||
  "VouchOper1111111111111111111111111111111111";

const app = express();
app.set("trust proxy", 1);
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
      "PAYMENT-REQUIRED",
      "Payment-Required",
      "X-PAYMENT",
      "X-PAYMENT-RESPONSE",
      "X-GIFT-CARD",
      "Access-Control-Expose-Headers",
    ],
  }),
);
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Health / events / quote / ledger
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "vouch-magicblock-backend",
    network: NETWORK,
    cluster: CLUSTER,
    facilitator: FACILITATOR_URL,
    usdc: USDC,
    demoMode: DEMO_MODE,
    explorer: SOLANA_EXPLORER,
    paymentMode: "pass-through",
    giftCards: true,
    magicblock: magicblockStatus(),
    note: "Endpoint gift cards for Solana x402 — remits via MagicBlock private split.",
  });
});

app.get("/events", (req, res) => {
  attachSse(res);
});

app.get("/events/recent", (_req, res) => {
  res.json({ events: recentEvents(50) });
});

app.get("/quote", async (req, res) => {
  try {
    const gift = extractGiftCard(req);
    const sellerId = extractSellerId(req);
    if (!sellerId) return res.status(400).json({ error: "seller_required" });
    const quote = await getPrice(gift, { sellerId });
    res.json(quote);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "quote_failed";
    res.status(400).json({ error: msg });
  }
});

app.get("/stats/:address", (req, res) => {
  res.json(getStats(req.params.address));
});

app.get("/ledger", (_req, res) => {
  res.json({
    accounts: allAccounts(),
    pools: listPools(),
    cards: listGiftCards(),
  });
});

// ---------------------------------------------------------------------------
// Sellers
// ---------------------------------------------------------------------------
app.get("/sellers", (_req, res) => {
  res.json({ sellers: listSellers() });
});

app.delete("/sellers", (_req, res) => {
  clearSellers();
  res.json({ ok: true });
});

app.delete("/sellers/:id", (req, res) => {
  const ok = deleteSeller(req.params.id);
  res.status(ok ? 200 : 404).json({ ok });
});

app.post("/sellers/probe", async (req, res) => {
  try {
    const resourceUrl = String(req.body?.resourceUrl || "").trim();
    if (!resourceUrl) return res.status(400).json({ error: "resourceUrl_required" });
    assertSafeOutboundUrl(resourceUrl);
    const probed = await fetchSellerPaymentRequired(resourceUrl);
    if (!probed.paymentRequiredHeader && probed.status !== 402) {
      return res.status(400).json({
        error: "not_x402",
        message: "URL did not return 402 PAYMENT-REQUIRED",
        status: probed.status,
      });
    }
    const parsed = probed.paymentRequiredHeader
      ? parsePaymentRequired(probed.paymentRequiredHeader)
      : { payTo: null, amountAtomic: null, network: null, asset: null };
    const priceUsdc = parsed.amountAtomic
      ? atomicToUsdc(Number(parsed.amountAtomic))
      : getConfig().basePriceUsdc;
    res.json({
      ok: true,
      resourceUrl,
      status: probed.status,
      payTo: parsed.payTo,
      amountAtomic: parsed.amountAtomic,
      priceUsdc,
      network: parsed.network || NETWORK,
      asset: parsed.asset || USDC,
      paymentRequiredHeader: probed.paymentRequiredHeader,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "probe_failed",
    });
  }
});

app.post("/sellers", async (req, res) => {
  try {
    const resourceUrl = String(req.body?.resourceUrl || req.body?.endpointUrl || "").trim();
    if (!resourceUrl) return res.status(400).json({ error: "resourceUrl_required" });
    assertSafeOutboundUrl(resourceUrl);

    let payTo = String(req.body?.payoutAddress || "").trim();
    let basePriceUsdc = Number(req.body?.basePriceUsdc);
    if (!payTo || !Number.isFinite(basePriceUsdc)) {
      const probed = await fetchSellerPaymentRequired(resourceUrl);
      const parsed = probed.paymentRequiredHeader
        ? parsePaymentRequired(probed.paymentRequiredHeader)
        : null;
      if (!payTo && parsed?.payTo) payTo = parsed.payTo;
      if (!Number.isFinite(basePriceUsdc) && parsed?.amountAtomic) {
        basePriceUsdc = atomicToUsdc(Number(parsed.amountAtomic));
      }
    }
    if (!payTo) return res.status(400).json({ error: "payoutAddress_required" });
    if (!Number.isFinite(basePriceUsdc) || basePriceUsdc <= 0) {
      basePriceUsdc = getConfig().basePriceUsdc;
    }

    const seller = registerSeller({
      id: req.body?.id,
      name: String(req.body?.name || "Untitled seller"),
      endpointUrl: resourceUrl,
      resourceUrl,
      payoutAddress: payTo,
      basePriceUsdc: roundUsdc(basePriceUsdc),
      giftCardRebatePercent: Number(req.body?.giftCardRebatePercent) || getConfig().rebatePercent,
      giftCardCommissionPercent:
        Number(req.body?.giftCardCommissionPercent) || getConfig().commissionPercent,
    });

    const seedAmount = Number(req.body?.seedPoolUsdc);
    if (Number.isFinite(seedAmount) && seedAmount > 0) {
      fundPool(seller.id, seedAmount, "register");
    } else if (DEMO_MODE) {
      seedDemoPool(seller.id, 5);
    }

    publish("seller.registered", `Registered ${seller.name} · gift cards enabled`, {
      sellerId: seller.id,
      resourceUrl: seller.resourceUrl,
      payTo: seller.payoutAddress,
      basePriceUsdc: seller.basePriceUsdc,
    });

    res.json({ seller, pool: getPool(seller.id) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "register_failed",
    });
  }
});

// ---------------------------------------------------------------------------
// Gift-card pool
// ---------------------------------------------------------------------------
app.get("/pool/:sellerId", (req, res) => {
  res.json(getPool(req.params.sellerId));
});

app.post("/pool/:sellerId/fund", (req, res) => {
  try {
    const amount = Number(req.body?.amountUsdc);
    const from = String(req.body?.from || "");
    const pool = fundPool(req.params.sellerId, amount, from || undefined);
    res.json({ ok: true, pool });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "fund_failed",
    });
  }
});

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------
app.get("/gift-cards", (req, res) => {
  res.json({
    cards: listGiftCards({
      sellerId: req.query.sellerId ? String(req.query.sellerId) : undefined,
      owner: req.query.owner ? String(req.query.owner) : undefined,
      issuer: req.query.issuer ? String(req.query.issuer) : undefined,
    }),
  });
});

app.get("/gift-cards/:code", (req, res) => {
  const card = getGiftCardByCode(req.params.code) || getGiftCard(req.params.code);
  if (!card) return res.status(404).json({ error: "card_not_found" });
  res.json({ card });
});

app.post("/gift-cards/mint", (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || "").trim();
    const issuer = String(req.body?.issuer || "").trim();
    const seller = getSeller(sellerId);
    if (!seller) return res.status(404).json({ error: "seller_not_found" });
    if (!issuer || !isSolanaAddress(issuer)) {
      return res.status(400).json({ error: "issuer_required" });
    }
    if (!DEMO_MODE && !hasPaymentHistory(issuer)) {
      return res.status(403).json({
        error: "payment_history_required",
        message: "Issuer must pay the endpoint once before minting a gift card",
      });
    }

    const card = mintGiftCard({
      seller,
      issuer,
      visibility: req.body?.visibility === "public" ? "public" : "private",
    });
    recordGiftMint(issuer);

    const shareUrl = `${PUBLIC_SITE_URL}/claim/${card.code}`;
    res.json({ card, shareUrl, claimPath: `/claim/${card.code}` });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "mint_failed",
    });
  }
});

app.post("/gift-cards/claim", (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    const owner = String(req.body?.owner || "").trim();
    if (!code || !owner) {
      return res.status(400).json({ error: "code_and_owner_required" });
    }
    const card = claimGiftCard(code, owner);
    res.json({ card });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "claim_failed",
    });
  }
});

app.get("/links/:code", (req, res) => {
  const card = getGiftCardByCode(req.params.code);
  if (!card) return res.status(404).json({ error: "not_found" });
  const seller = getSeller(card.sellerId);
  res.json({
    type: "gift-card",
    code: card.code,
    card,
    seller: seller
      ? {
          id: seller.id,
          name: seller.name,
          resourceUrl: seller.resourceUrl,
          basePriceUsdc: seller.basePriceUsdc,
        }
      : null,
    payUrl: `${PUBLIC_SITE_URL}/pay/${card.sellerId}?gift=${card.code}`,
  });
});

// ---------------------------------------------------------------------------
// Remits
// ---------------------------------------------------------------------------
app.get("/remit/:settleTxId", (req, res) => {
  const r = getRemit(req.params.settleTxId);
  if (!r) return res.status(404).json({ error: "not_ready" });
  res.json(r);
});

// ---------------------------------------------------------------------------
// x402 resource proxy
// ---------------------------------------------------------------------------
async function handleResource(req: Request, res: Response) {
  try {
    const sellerId = extractSellerId(req);
    if (!sellerId) return res.status(400).json({ error: "seller_required" });
    const seller = getSeller(sellerId);
    if (!seller) return res.status(404).json({ error: "seller_not_found" });

    const giftRaw = extractGiftCard(req);
    const quote = await getPrice(giftRaw, { sellerId });
    const paymentHeader = pickPaymentHeader(req);

    if (!paymentHeader) {
      publish("payment.challenge", `402 · ${seller.name} requires payment`, {
        sellerId,
        priceUsdc: quote.price,
        giftCardEligible: quote.giftCardEligible,
        giftCode: quote.giftCard?.code || null,
      });
      const upstream = await fetchSellerPaymentRequired(seller.resourceUrl);
      if (upstream.paymentRequiredHeader) {
        res.setHeader("PAYMENT-REQUIRED", upstream.paymentRequiredHeader);
        res.setHeader("Payment-Required", upstream.paymentRequiredHeader);
      }
      return res.status(402).json({
        error: "payment_required",
        quote,
        seller: {
          id: seller.id,
          name: seller.name,
          resourceUrl: seller.resourceUrl,
        },
      });
    }

    // Demo settle path — when DEMO_MODE and payment header is "demo:<pubkey>"
    if (DEMO_MODE && paymentHeader.startsWith("demo:")) {
      const payer = paymentHeader.slice(5);
      const settleTxId = `demo_settle_${Date.now().toString(36)}`;
      return await finishSettlement({
        req,
        res,
        seller,
        quote,
        payer,
        settleTxId,
        paymentHeader,
        body: {
          ok: true,
          message: "This is Vouch on MagicBlock — thanks for using it",
          product: "vouch-thanks-solana",
          demo: true,
          network: NETWORK,
        },
        paymentResponseHeader: null,
      });
    }

    const upstream = await forwardPaymentToSeller({
      resourceUrl: seller.resourceUrl,
      paymentHeader,
    });

    if (!upstream.ok) {
      if (upstream.paymentRequiredHeader) {
        res.setHeader("PAYMENT-REQUIRED", upstream.paymentRequiredHeader);
      }
      return res.status(upstream.status).json(upstream.body);
    }

    if (upstream.paymentResponseHeader) {
      res.setHeader("PAYMENT-RESPONSE", upstream.paymentResponseHeader);
      res.setHeader("Payment-Response", upstream.paymentResponseHeader);
    }

    const paymentPayload = decodePaymentPayload(paymentHeader);
    const paymentResponse = decodePaymentResponseHeader(
      upstream.paymentResponseHeader,
    );
    const settleTxId = resolveSettleTxId(paymentHeader, {
      headerTx:
        (paymentResponse?.transaction as string) ||
        (paymentResponse?.signature as string) ||
        null,
      body: upstream.body,
    });
    const payer =
      resolvePayer(paymentPayload, paymentResponse, upstream.body) ||
      String(req.query.payer || "");

    return await finishSettlement({
      req,
      res,
      seller,
      quote,
      payer,
      settleTxId,
      paymentHeader,
      body: upstream.body,
      paymentResponseHeader: upstream.paymentResponseHeader,
    });
  } catch (err) {
    publish("error", err instanceof Error ? err.message : "resource_failed");
    res.status(500).json({
      error: err instanceof Error ? err.message : "resource_failed",
    });
  }
}

async function finishSettlement(args: {
  req: Request;
  res: Response;
  seller: NonNullable<ReturnType<typeof getSeller>>;
  quote: Awaited<ReturnType<typeof getPrice>>;
  payer: string;
  settleTxId: string;
  paymentHeader: string;
  body: unknown;
  paymentResponseHeader: string | null;
}) {
  const { res, seller, quote, payer, settleTxId, body } = args;

  if (payer) recordPayment(payer);

  publish("payment.settled", `Settled · ${shortAddr(payer) || "agent"} paid $${quote.price.toFixed(2)}`, {
    sellerId: seller.id,
    settleTxId,
    payer,
    priceUsdc: quote.price,
    giftCardEligible: quote.giftCardEligible,
  });

  let remit: Record<string, unknown> | null = null;

  if (quote.giftCardEligible && quote.giftCard && payer) {
    try {
      const redeemed = redeemGiftCard({
        card: quote.giftCard,
        buyer: payer,
        settleTxId,
      });

      const mb = await remitGiftCardSplit({
        from: OPERATOR,
        buyer: payer,
        issuer: redeemed.issuer,
        rebateUsdc: redeemed.rebateUsdc,
        commissionUsdc: redeemed.commissionUsdc,
        settleTxId,
        cardCode: redeemed.card.code,
      });

      attachMagicblockTx(
        redeemed.card.id,
        mb.rebateTxId || mb.commissionTxId,
      );
      recordGiftRedeem({
        buyer: payer,
        issuer: redeemed.issuer,
        rebateUsdc: redeemed.rebateUsdc,
        commissionUsdc: redeemed.commissionUsdc,
      });

      remit = {
        ok: true,
        settleTxId,
        card: redeemed.card,
        rebateUsdc: redeemed.rebateUsdc,
        commissionUsdc: redeemed.commissionUsdc,
        buyer: payer,
        issuer: redeemed.issuer,
        magicblock: mb,
        pool: getPool(seller.id),
      };
      storeRemit(settleTxId, remit);

      publish("demo.step", "Gift card redeemed · private remits complete", {
        settleTxId,
        cardCode: redeemed.card.code,
      });
    } catch (err) {
      publish(
        "error",
        `Gift-card redeem failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  res.json({
    ...(typeof body === "object" && body ? body : { data: body }),
    vouch: {
      settleTxId,
      payer,
      quote,
      remit,
      pool: getPool(seller.id),
    },
  });
}

app.get("/resource", handleResource);
app.get("/r/:sellerId/resource", handleResource);

// Demo pay endpoint — signs a fake payment for walkthroughs without a wallet
app.post("/demo/pay", async (req, res) => {
  if (!DEMO_MODE) return res.status(403).json({ error: "demo_disabled" });
  try {
    const sellerId = String(req.body?.sellerId || "").trim();
    const payer = String(req.body?.payer || "").trim();
    const gift = req.body?.gift ? String(req.body.gift) : null;
    const seller = getSeller(sellerId);
    if (!seller) return res.status(404).json({ error: "seller_not_found" });
    if (!payer) return res.status(400).json({ error: "payer_required" });

    // Reuse resource handler logic via internal finish
    const quote = await getPrice(gift, { sellerId });
    const settleTxId = `demo_settle_${Date.now().toString(36)}`;
    const fakeReq = req;
    await finishSettlement({
      req: fakeReq,
      res,
      seller,
      quote,
      payer,
      settleTxId,
      paymentHeader: `demo:${payer}`,
      body: {
        ok: true,
        message: "This is Vouch on MagicBlock — thanks for using it",
        product: "vouch-thanks-solana",
        demo: true,
        network: NETWORK,
      },
      paymentResponseHeader: null,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "demo_pay_failed",
    });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[vouch-mb] listening on :${PORT}`);
  console.log(`[vouch-mb] network ${NETWORK} · cluster ${CLUSTER}`);
  console.log(`[vouch-mb] magicblock`, magicblockStatus());
  console.log(`[vouch-mb] demoMode=${DEMO_MODE}`);
  await seedDemoSellerFromEnv();
});
