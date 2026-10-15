/**
 * Native x402 payment pass-through for Solana sellers.
 * Vouch relays PAYMENT-REQUIRED / PAYMENT-SIGNATURE; seller settles.
 */
import { createHash } from "node:crypto";

export function pickPaymentHeader(req: {
  get: (n: string) => string | undefined;
}): string | null {
  return (
    req.get("PAYMENT-SIGNATURE") ||
    req.get("Payment-Signature") ||
    req.get("X-PAYMENT") ||
    null
  );
}

export function decodePaymentPayload(paymentHeader: string): unknown | null {
  try {
    return JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function decodePaymentResponseHeader(
  header: string | null,
): Record<string, unknown> | null {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    try {
      return JSON.parse(header);
    } catch {
      return null;
    }
  }
}

export function resolveSettleTxId(
  paymentHeader: string,
  upstream: { headerTx?: string | null; body?: unknown },
): string {
  const fromHeader = upstream.headerTx?.trim();
  if (fromHeader) return fromHeader;
  const body = (upstream.body || {}) as Record<string, unknown>;
  const payment = body.payment as Record<string, unknown> | undefined;
  const fromBody =
    body.transaction ||
    body.txId ||
    body.settleTxId ||
    body.signature ||
    payment?.transaction ||
    null;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
  return `sim_${createHash("sha256").update(paymentHeader).digest("hex").slice(0, 40)}`;
}

export function resolvePayer(
  paymentPayload: unknown,
  paymentResponse: Record<string, unknown> | null,
  body: unknown,
): string | null {
  const b = (body || {}) as Record<string, unknown>;
  const p = (paymentPayload || {}) as Record<string, unknown>;
  const payload = (p.payload || {}) as Record<string, unknown>;
  const auth = (payload.authorization || {}) as Record<string, unknown>;
  const accepted = (p.accepted || {}) as Record<string, unknown>;
  const candidates = [
    paymentResponse?.payer,
    b.payer,
    auth.from,
    accepted.payer,
    payload.from,
    p.payer,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length >= 32) return c;
  }
  return null;
}

export async function forwardPaymentToSeller(opts: {
  resourceUrl: string;
  paymentHeader: string;
}): Promise<{
  status: number;
  ok: boolean;
  headers: Headers;
  body: unknown;
  paymentRequiredHeader: string | null;
  paymentResponseHeader: string | null;
}> {
  const upstream = await fetch(opts.resourceUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "PAYMENT-SIGNATURE": opts.paymentHeader,
    },
  });
  const paymentRequiredHeader =
    upstream.headers.get("PAYMENT-REQUIRED") ||
    upstream.headers.get("Payment-Required");
  const paymentResponseHeader =
    upstream.headers.get("PAYMENT-RESPONSE") ||
    upstream.headers.get("Payment-Response") ||
    upstream.headers.get("X-PAYMENT-RESPONSE");

  let body: unknown = null;
  const text = await upstream.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return {
    status: upstream.status,
    ok: upstream.ok,
    headers: upstream.headers,
    body,
    paymentRequiredHeader,
    paymentResponseHeader,
  };
}

export async function fetchSellerPaymentRequired(resourceUrl: string): Promise<{
  status: number;
  paymentRequiredHeader: string | null;
  body: unknown;
}> {
  const upstream = await fetch(resourceUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const paymentRequiredHeader =
    upstream.headers.get("PAYMENT-REQUIRED") ||
    upstream.headers.get("Payment-Required");
  let body: unknown = null;
  const text = await upstream.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: upstream.status, paymentRequiredHeader, body };
}

/** Decode x402 PAYMENT-REQUIRED accepts to lock payTo + price. */
export function parsePaymentRequired(header: string): {
  payTo: string | null;
  amountAtomic: string | null;
  network: string | null;
  asset: string | null;
} {
  try {
    const json = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
      accepts?: Array<{
        payTo?: string;
        amount?: string;
        network?: string;
        asset?: string;
        price?: string;
      }>;
      accept?: Array<{
        payTo?: string;
        amount?: string;
        network?: string;
        asset?: string;
      }>;
    };
    const accepts = json.accepts || json.accept || [];
    const first = accepts[0];
    if (!first) {
      return { payTo: null, amountAtomic: null, network: null, asset: null };
    }
    return {
      payTo: first.payTo || null,
      amountAtomic: first.amount || null,
      network: first.network || null,
      asset: first.asset || null,
    };
  } catch {
    return { payTo: null, amountAtomic: null, network: null, asset: null };
  }
}
