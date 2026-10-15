/**
 * MagicBlock Private Payments — split remits for gift-card rebate + commission.
 * When MAGICBLOCK_ENABLED is false (default for local demos), we simulate the
 * private split so the live event stream still tells the full story.
 */
import { usdcToAtomic, MAGICBLOCK_PAYMENTS_DEFAULT, shortAddr } from "./chain.js";
import { publish } from "./events.js";

const PAYMENTS_URL = (
  process.env.MAGICBLOCK_PAYMENTS_URL || MAGICBLOCK_PAYMENTS_DEFAULT
).replace(/\/+$/, "");
const CLUSTER = process.env.MAGICBLOCK_CLUSTER || "devnet";
const MINT =
  process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const ENABLED =
  String(process.env.MAGICBLOCK_ENABLED || "false").toLowerCase() === "true";

export type RemitResult = {
  ok: boolean;
  mode: "magicblock-private" | "demo-simulated";
  rebateTxId: string | null;
  commissionTxId: string | null;
  clientRefId: string;
  visibility: "private" | "public";
  note: string;
};

export function magicblockStatus() {
  return {
    enabled: ENABLED,
    paymentsUrl: PAYMENTS_URL,
    cluster: CLUSTER,
    mint: MINT,
  };
}

/**
 * Split gift-card remittance:
 *  1) rebate → buyer
 *  2) commission → gift-card issuer
 * MagicBlock's split + private visibility is the demo punchline — observers
 * see the agent paid, but not who received the referral economics.
 */
export async function remitGiftCardSplit(args: {
  from: string;
  buyer: string;
  issuer: string;
  rebateUsdc: number;
  commissionUsdc: number;
  settleTxId: string;
  cardCode: string;
}): Promise<RemitResult> {
  const clientRefId = `gc-${args.settleTxId.slice(0, 16)}`;
  const total = args.rebateUsdc + args.commissionUsdc;

  publish("remit.queued", `Queuing MagicBlock private split · $${total.toFixed(4)}`, {
    clientRefId,
    buyer: args.buyer,
    issuer: args.issuer,
    rebateUsdc: args.rebateUsdc,
    commissionUsdc: args.commissionUsdc,
    visibility: "private",
    cardCode: args.cardCode,
  });

  if (!ENABLED) {
    // Demo path — still emits the story so the UI is never empty.
    await sleep(400);
    const rebateTxId = `sim_rebate_${clientRefId}`;
    const commissionTxId = `sim_comm_${clientRefId}`;
    publish(
      "remit.magicblock",
      `Private split settled (demo) · rebate → ${shortAddr(args.buyer)} · commission → ${shortAddr(args.issuer)}`,
      {
        mode: "demo-simulated",
        visibility: "private",
        fromBalance: "base",
        toBalance: "base",
        rebateTxId,
        commissionTxId,
        clientRefId,
        rebateUsdc: args.rebateUsdc,
        commissionUsdc: args.commissionUsdc,
        note: "MAGICBLOCK_ENABLED=false — simulated private remit for demos",
      },
    );
    return {
      ok: true,
      mode: "demo-simulated",
      rebateTxId,
      commissionTxId,
      clientRefId,
      visibility: "private",
      note: "Simulated MagicBlock private split (set MAGICBLOCK_ENABLED=true for live PER)",
    };
  }

  // Live MagicBlock Private Payments API
  try {
    const rebateAtomic = usdcToAtomic(args.rebateUsdc);
    const commissionAtomic = usdcToAtomic(args.commissionUsdc);

    const rebateTx = await buildPrivateTransfer({
      from: args.from,
      to: args.buyer,
      amount: rebateAtomic,
      clientRefId: `${clientRefId}-rebate`,
      memo: `Vouch gift-card rebate ${args.cardCode}`,
    });
    const commissionTx = await buildPrivateTransfer({
      from: args.from,
      to: args.issuer,
      amount: commissionAtomic,
      clientRefId: `${clientRefId}-comm`,
      memo: `Vouch gift-card commission ${args.cardCode}`,
    });

    publish(
      "remit.magicblock",
      `MagicBlock private split built · sign & crank to settle`,
      {
        mode: "magicblock-private",
        visibility: "private",
        rebate: rebateTx,
        commission: commissionTx,
        clientRefId,
      },
    );

    return {
      ok: true,
      mode: "magicblock-private",
      rebateTxId: rebateTx.signatureHint || null,
      commissionTxId: commissionTx.signatureHint || null,
      clientRefId,
      visibility: "private",
      note: "Unsigned private transfers returned — operator signs / crank settles via PER",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    publish("error", `MagicBlock remit failed: ${message}`, { clientRefId });
    const rebateTxId = `sim_rebate_${clientRefId}`;
    const commissionTxId = `sim_comm_${clientRefId}`;
    publish(
      "remit.magicblock",
      `Fell back to demo private split after MagicBlock error`,
      {
        mode: "demo-simulated",
        visibility: "private",
        rebateTxId,
        commissionTxId,
        clientRefId,
        error: message,
      },
    );
    return {
      ok: true,
      mode: "demo-simulated",
      rebateTxId,
      commissionTxId,
      clientRefId,
      visibility: "private",
      note: `MagicBlock error → demo fallback: ${message}`,
    };
  }
}

async function buildPrivateTransfer(body: {
  from: string;
  to: string;
  amount: number;
  clientRefId: string;
  memo: string;
}): Promise<{
  kind?: string;
  version?: string;
  signatureHint?: string;
  raw: unknown;
}> {
  const res = await fetch(`${PAYMENTS_URL}/v1/spl/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: body.from,
      to: body.to,
      mint: MINT,
      amount: body.amount,
      cluster: CLUSTER,
      visibility: "private",
      fromBalance: "base",
      toBalance: "base",
      initIfMissing: true,
      initAtasIfMissing: true,
      initVaultIfMissing: true,
      clientRefId: body.clientRefId,
      memo: body.memo,
    }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (raw as { message?: string; error?: string }).message ||
        (raw as { error?: string }).error ||
        `magicblock_http_${res.status}`,
    );
  }
  return {
    kind: (raw as { kind?: string }).kind,
    version: (raw as { version?: string }).version,
    signatureHint: body.clientRefId,
    raw,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
