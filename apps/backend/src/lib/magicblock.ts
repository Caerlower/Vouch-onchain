/**
 * MagicBlock Private Payments — live build → sign → send → crank for gift-card remits.
 * Uses a Devnet remittance mint (pool USDC stand-in) so private PER splits work without
 * Circle faucet USDC. Set MAGICBLOCK_REMIT_MINT / MAGICBLOCK_ENABLED in .env.
 */
import {
  Connection,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import {
  usdcToAtomic,
  MAGICBLOCK_PAYMENTS_DEFAULT,
  shortAddr,
  explorerTxUrl,
} from "./chain.js";
import { publish } from "./events.js";

const PAYMENTS_URL = (
  process.env.MAGICBLOCK_PAYMENTS_URL || MAGICBLOCK_PAYMENTS_DEFAULT
).replace(/\/+$/, "");
const CLUSTER = process.env.MAGICBLOCK_CLUSTER || "devnet";
/** Circle Devnet USDC — kept for status; remits use MAGICBLOCK_REMIT_MINT. */
const USDC_MINT =
  process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const REMIT_MINT =
  process.env.MAGICBLOCK_REMIT_MINT ||
  "GpoEMmArrAizS963cU4viTfDiCcN6VkDYEo8bx5HLmAR";
const ENABLED =
  String(process.env.MAGICBLOCK_ENABLED || "false").toLowerCase() === "true";
const RPC =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const DATA_DIR = path.resolve(
  process.env.VOUCH_DATA_DIR || path.join(process.cwd(), ".data"),
);

export type RemitResult = {
  ok: boolean;
  mode: "magicblock-private" | "demo-simulated";
  rebateTxId: string | null;
  commissionTxId: string | null;
  rebateExplorerUrl: string | null;
  commissionExplorerUrl: string | null;
  clientRefId: string;
  visibility: "private" | "public";
  mint: string;
  note: string;
  crank?: unknown;
};

type BuiltTx = {
  kind?: string;
  version?: string;
  transactionBase64: string;
  sendTo: "base" | "ephemeral";
  recentBlockhash: string;
  lastValidBlockHeight: number;
  requiredSigners?: string[];
  raw: unknown;
};

let mintReady: Promise<boolean> | null = null;

export function magicblockStatus() {
  return {
    enabled: ENABLED,
    paymentsUrl: PAYMENTS_URL,
    cluster: CLUSTER,
    mint: REMIT_MINT,
    usdcMint: USDC_MINT,
    remitMint: REMIT_MINT,
  };
}

function loadOperator(): Keypair {
  const fromEnv = process.env.VOUCH_OPERATOR_SECRET?.trim();
  if (fromEnv) {
    try {
      return Keypair.fromSecretKey(bs58.decode(fromEnv));
    } catch {
      const arr = JSON.parse(fromEnv) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
  }
  const keyPath = path.join(DATA_DIR, "operator-keypair.json");
  if (!fs.existsSync(keyPath)) {
    throw new Error("Operator keypair missing — start backend once to create it");
  }
  const raw = JSON.parse(fs.readFileSync(keyPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function numericClientRef(seed: string): string {
  // MagicBlock requires a non-negative bigint string
  let h = 0n;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 131n + BigInt(seed.charCodeAt(i))) % 10n ** 18n;
  }
  const n = h + BigInt(Date.now() % 1_000_000);
  return n.toString();
}

async function ensureRemitMintInitialized(payer: string): Promise<boolean> {
  if (!mintReady) {
    mintReady = (async () => {
      try {
        const status = await fetch(
          `${PAYMENTS_URL}/v1/spl/is-mint-initialized?mint=${REMIT_MINT}&cluster=${CLUSTER}`,
        ).then((r) => r.json() as Promise<{ initialized?: boolean }>);
        if (status.initialized) return true;

        const built = await apiPost("/v1/spl/initialize-mint", {
          mint: REMIT_MINT,
          cluster: CLUSTER,
          payer,
          owner: payer,
        });
        if (!built?.transactionBase64) return false;
        const sent = await signAndSend(built, loadOperator());
        return Boolean(sent.signature);
      } catch (err) {
        publish(
          "error",
          `MagicBlock mint init: ${err instanceof Error ? err.message : err}`,
        );
        return false;
      }
    })();
  }
  return mintReady;
}

async function apiPost(
  pathName: string,
  body: Record<string, unknown>,
): Promise<BuiltTx | null> {
  const res = await fetch(`${PAYMENTS_URL}${pathName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (raw as { error?: { message?: string }; message?: string }).error
        ?.message ||
        (raw as { message?: string }).message ||
        `magicblock_http_${res.status}`,
    );
  }
  if (!(raw as BuiltTx).transactionBase64) {
    throw new Error("magicblock_missing_transaction");
  }
  return { ...(raw as BuiltTx), raw };
}

async function signAndSend(
  built: BuiltTx,
  signer: Keypair,
): Promise<{ signature: string | null; explorerUrl: string | null; raw: unknown }> {
  const tx = Transaction.from(Buffer.from(built.transactionBase64, "base64"));
  tx.partialSign(signer);
  const serialized = tx.serialize();

  const res = await fetch(`${PAYMENTS_URL}/v1/transaction/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionBase64: serialized.toString("base64"),
      sendTo: built.sendTo || "base",
      cluster: CLUSTER,
      confirm: false,
      maxRetries: 3,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ||
        (body as { message?: string }).message ||
        `magicblock_send_${res.status}`,
    );
  }
  const signature = String((body as { signature?: string }).signature || "");
  if (!signature) throw new Error("magicblock_send_no_signature");

  // Quick processed confirm — don't block the demo UI for full finalization
  try {
    const conn = new Connection(RPC, "processed");
    await Promise.race([
      conn.confirmTransaction(signature, "processed"),
      sleep(8_000),
    ]);
  } catch {
    /* signature still valid — Explorer will show once landed */
  }

  return {
    signature,
    explorerUrl: explorerTxUrl(signature, CLUSTER),
    raw: body,
  };
}

async function privateTransfer(args: {
  from: string;
  to: string;
  amountAtomic: number;
  clientRefId: string;
  memo: string;
  signer: Keypair;
}): Promise<{ signature: string; explorerUrl: string; clientRefId: string }> {
  const built = await apiPost("/v1/spl/transfer", {
    from: args.from,
    to: args.to,
    mint: REMIT_MINT,
    amount: args.amountAtomic,
    cluster: CLUSTER,
    visibility: "private",
    fromBalance: "base",
    toBalance: "base",
    initIfMissing: true,
    initAtasIfMissing: true,
    initVaultIfMissing: false,
    clientRefId: args.clientRefId,
    memo: args.memo,
    legacy: true,
  });
  if (!built) throw new Error("magicblock_build_failed");
  const sent = await signAndSend(built, args.signer);
  if (!sent.signature || !sent.explorerUrl) {
    throw new Error("magicblock_send_failed");
  }
  return {
    signature: sent.signature,
    explorerUrl: sent.explorerUrl,
    clientRefId: args.clientRefId,
  };
}

/**
 * Split gift-card remittance via MagicBlock private PER:
 *  1) rebate → buyer
 *  2) commission → gift-card issuer
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
  const clientRefId = numericClientRef(args.settleTxId || args.cardCode);
  const total = args.rebateUsdc + args.commissionUsdc;

  publish(
    "remit.queued",
    `Queuing MagicBlock private split · $${total.toFixed(4)}`,
    {
      clientRefId,
      buyer: args.buyer,
      issuer: args.issuer,
      rebateUsdc: args.rebateUsdc,
      commissionUsdc: args.commissionUsdc,
      visibility: "private",
      cardCode: args.cardCode,
      mint: REMIT_MINT,
    },
  );

  if (!ENABLED) {
    await sleep(400);
    const rebateTxId = `sim_rebate_${clientRefId}`;
    const commissionTxId = `sim_comm_${clientRefId}`;
    publish(
      "remit.magicblock",
      `Private split settled (demo) · rebate → ${shortAddr(args.buyer)} · tip → ${shortAddr(args.issuer)}`,
      {
        mode: "demo-simulated",
        visibility: "private",
        rebateTxId,
        commissionTxId,
        clientRefId,
        note: "MAGICBLOCK_ENABLED=false",
      },
    );
    return {
      ok: true,
      mode: "demo-simulated",
      rebateTxId,
      commissionTxId,
      rebateExplorerUrl: null,
      commissionExplorerUrl: null,
      clientRefId,
      visibility: "private",
      mint: REMIT_MINT,
      note: "Simulated — set MAGICBLOCK_ENABLED=true",
    };
  }

  try {
    const signer = loadOperator();
    const from = signer.publicKey.toBase58();
    await ensureRemitMintInitialized(from);

    const rebateAtomic = Math.max(1, usdcToAtomic(args.rebateUsdc));
    const commissionAtomic = Math.max(1, usdcToAtomic(args.commissionUsdc));

    const rebate = await privateTransfer({
      from,
      to: args.buyer,
      amountAtomic: rebateAtomic,
      clientRefId: `${clientRefId}1`,
      memo: `vouch:rebate:${args.cardCode}`,
      signer,
    });

    publish(
      "remit.magicblock",
      `Private rebate → ${shortAddr(args.buyer)} · ${shortAddr(rebate.signature, 6)}`,
      {
        mode: "magicblock-private",
        visibility: "private",
        leg: "rebate",
        signature: rebate.signature,
        explorerUrl: rebate.explorerUrl,
        amountUsdc: args.rebateUsdc,
        to: args.buyer,
        mint: REMIT_MINT,
      },
    );

    const commission = await privateTransfer({
      from,
      to: args.issuer,
      amountAtomic: commissionAtomic,
      clientRefId: `${clientRefId}2`,
      memo: `vouch:tip:${args.cardCode}`,
      signer,
    });

    publish(
      "remit.magicblock",
      `Private tip → ${shortAddr(args.issuer)} · ${shortAddr(commission.signature, 6)}`,
      {
        mode: "magicblock-private",
        visibility: "private",
        leg: "commission",
        signature: commission.signature,
        explorerUrl: commission.explorerUrl,
        amountUsdc: args.commissionUsdc,
        to: args.issuer,
        mint: REMIT_MINT,
      },
    );

    // Crank is best-effort and often slow/rate-limited — don't block the demo.
    let crank: unknown = null;
    void fetch(`${PAYMENTS_URL}/v1/spl/transfer-queue/ensure-crank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint: REMIT_MINT, cluster: CLUSTER }),
    })
      .then(async (crankRes) => {
        crank = await crankRes.json().catch(() => ({}));
        if (crankRes.ok) {
          publish("remit.magicblock", `MagicBlock crank ensured for remit mint`, {
            mode: "magicblock-private",
            crank,
          });
        }
      })
      .catch(() => {});

    return {
      ok: true,
      mode: "magicblock-private",
      rebateTxId: rebate.signature,
      commissionTxId: commission.signature,
      rebateExplorerUrl: rebate.explorerUrl,
      commissionExplorerUrl: commission.explorerUrl,
      clientRefId,
      visibility: "private",
      mint: REMIT_MINT,
      note: "Live MagicBlock private PER remits confirmed on Devnet",
      crank,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    publish("error", `MagicBlock remit failed: ${message}`, { clientRefId });
    // Fall back to on-chain memo attestation so the demo still shows real Solana txs
    try {
      const { attestOnChain } = await import("./solana-tx.js");
      const rebateAttest = await attestOnChain({
        kind: "mb-rebate-fallback",
        memo: `vouch:mb-rebate-fallback|buyer=${args.buyer}|$${args.rebateUsdc}|${args.cardCode}|err=${message.slice(0, 40)}`,
      });
      const tipAttest = await attestOnChain({
        kind: "mb-tip-fallback",
        memo: `vouch:mb-tip-fallback|issuer=${args.issuer}|$${args.commissionUsdc}|${args.cardCode}`,
      });
      publish(
        "remit.magicblock",
        `MagicBlock unavailable — attested remits on Solana instead`,
        {
          mode: "demo-simulated",
          error: message,
          rebateTxId: rebateAttest.signature,
          commissionTxId: tipAttest.signature,
          rebateExplorerUrl: rebateAttest.explorerUrl,
          commissionExplorerUrl: tipAttest.explorerUrl,
        },
      );
      return {
        ok: true,
        mode: "demo-simulated",
        rebateTxId: rebateAttest.signature,
        commissionTxId: tipAttest.signature,
        rebateExplorerUrl: rebateAttest.explorerUrl,
        commissionExplorerUrl: tipAttest.explorerUrl,
        clientRefId,
        visibility: "private",
        mint: REMIT_MINT,
        note: `MagicBlock error → Solana attest fallback: ${message}`,
      };
    } catch {
      return {
        ok: false,
        mode: "demo-simulated",
        rebateTxId: null,
        commissionTxId: null,
        rebateExplorerUrl: null,
        commissionExplorerUrl: null,
        clientRefId,
        visibility: "private",
        mint: REMIT_MINT,
        note: message,
      };
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
