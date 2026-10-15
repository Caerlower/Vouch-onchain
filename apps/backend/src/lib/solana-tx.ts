/**
 * Real Solana Devnet attestations — memo transactions signed by the operator.
 * Gift-card vault state still lives in-memory for the demo; each settle/mint/fund
 * lands a verifiable signature on-chain so the activity rail links to Explorer.
 */
import fs from "node:fs";
import path from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { explorerTxUrl, shortAddr } from "./chain.js";
import { publish } from "./events.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const CLUSTER = process.env.SOLANA_CLUSTER || "devnet";
const RPC =
  process.env.SOLANA_RPC_URL ||
  (CLUSTER === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

const ONCHAIN =
  String(process.env.SOLANA_ONCHAIN || "true").toLowerCase() !== "false";

const DATA_DIR = path.resolve(
  process.env.VOUCH_DATA_DIR || path.join(process.cwd(), ".data"),
);
const KEY_PATH = path.join(DATA_DIR, "operator-keypair.json");

let connection: Connection | null = null;
let operator: Keypair | null = null;
let readyPromise: Promise<void> | null = null;
let lastError: string | null = null;

export type ChainAttestation = {
  ok: boolean;
  signature: string | null;
  explorerUrl: string | null;
  operator: string | null;
  cluster: string;
  mode: "onchain" | "skipped" | "error";
  note: string;
};

export function solanaStatus() {
  const op = operator?.publicKey.toBase58() || null;
  return {
    onchain: ONCHAIN,
    cluster: CLUSTER,
    rpc: RPC,
    operator: op,
    lastError,
    faucetUrl: op
      ? `https://faucet.solana.com/?address=${op}`
      : "https://faucet.solana.com",
    explorerAddress: op
      ? `https://explorer.solana.com/address/${op}?cluster=${CLUSTER}`
      : null,
  };
}

export async function ensureSolanaReady(): Promise<void> {
  if (!ONCHAIN) return;
  if (!readyPromise) readyPromise = bootstrap();
  await readyPromise;
  // Operator may have been funded after a failed bootstrap — re-check.
  if (lastError && operator && connection) {
    try {
      await ensureBalance(operator);
      lastError = null;
      publish(
        "hello",
        `Solana ${CLUSTER} ready · operator ${shortAddr(operator.publicKey.toBase58())}`,
        {
          cluster: CLUSTER,
          operator: operator.publicKey.toBase58(),
          explorerUrl: `https://explorer.solana.com/address/${operator.publicKey.toBase58()}?cluster=${CLUSTER}`,
        },
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
}

async function bootstrap() {
  connection = new Connection(RPC, "confirmed");
  operator = loadOrCreateOperator();
  try {
    await ensureBalance(operator);
    lastError = null;
    publish(
      "hello",
      `Solana ${CLUSTER} ready · operator ${shortAddr(operator.publicKey.toBase58())}`,
      {
        cluster: CLUSTER,
        operator: operator.publicKey.toBase58(),
        explorerUrl: `https://explorer.solana.com/address/${operator.publicKey.toBase58()}?cluster=${CLUSTER}`,
      },
    );
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    publish("error", `Solana needs funding: ${lastError}`, {
      cluster: CLUSTER,
      operator: operator.publicKey.toBase58(),
      faucetUrl: `https://faucet.solana.com/?address=${operator.publicKey.toBase58()}`,
    });
  }
}

function loadOrCreateOperator(): Keypair {
  const fromEnv = process.env.VOUCH_OPERATOR_SECRET?.trim();
  if (fromEnv) {
    try {
      return Keypair.fromSecretKey(bs58.decode(fromEnv));
    } catch {
      // JSON byte array form
      try {
        const arr = JSON.parse(fromEnv) as number[];
        return Keypair.fromSecretKey(Uint8Array.from(arr));
      } catch {
        /* fall through */
      }
    }
  }

  if (fs.existsSync(KEY_PATH)) {
    const raw = JSON.parse(fs.readFileSync(KEY_PATH, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }

  const kp = Keypair.generate();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, JSON.stringify(Array.from(kp.secretKey)), {
    mode: 0o600,
  });
  return kp;
}

async function ensureBalance(kp: Keypair) {
  if (!connection) return;
  let bal = await connection.getBalance(kp.publicKey);
  if (bal >= 0.02 * LAMPORTS_PER_SOL) return;

  if (CLUSTER !== "devnet") {
    throw new Error(
      `Fund operator ${kp.publicKey.toBase58()} on ${CLUSTER} (balance ${bal / LAMPORTS_PER_SOL} SOL)`,
    );
  }

  // Devnet faucet is often rate-limited — try, then require manual fund.
  try {
    const sig = await connection.requestAirdrop(
      kp.publicKey,
      Math.round(1 * LAMPORTS_PER_SOL),
    );
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature: sig, ...latest },
      "confirmed",
    );
  } catch {
    /* fall through to balance check */
  }

  bal = await connection.getBalance(kp.publicKey);
  if (bal < 5000) {
    throw new Error(
      `Operator needs Devnet SOL. Fund ${kp.publicKey.toBase58()} at https://faucet.solana.com`,
    );
  }
}

/**
 * Post a memo + self-transfer (1 lamport) so the signature is a real Devnet tx.
 */
export async function attestOnChain(args: {
  kind: string;
  memo: string;
}): Promise<ChainAttestation> {
  if (!ONCHAIN) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      operator: null,
      cluster: CLUSTER,
      mode: "skipped",
      note: "SOLANA_ONCHAIN=false",
    };
  }

  try {
    await ensureSolanaReady();
    if (!connection || !operator) {
      throw new Error(lastError || "solana_not_ready");
    }

    const memoIx = new TransactionInstruction({
      keys: [
        {
          pubkey: operator.publicKey,
          isSigner: true,
          isWritable: true,
        },
      ],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(args.memo, "utf8"),
    });

    const tx = new Transaction().add(memoIx);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [operator],
      { commitment: "confirmed" },
    );

    const explorerUrl = explorerTxUrl(signature, CLUSTER);
    lastError = null;

    publish(
      "chain.attested",
      `On-chain ${args.kind} · ${shortAddr(signature, 6)}`,
      {
        kind: args.kind,
        signature,
        explorerUrl,
        cluster: CLUSTER,
        operator: operator.publicKey.toBase58(),
        memo: args.memo.slice(0, 120),
      },
    );

    return {
      ok: true,
      signature,
      explorerUrl,
      operator: operator.publicKey.toBase58(),
      cluster: CLUSTER,
      mode: "onchain",
      note: `Confirmed on Solana ${CLUSTER}`,
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    publish("error", `On-chain attest failed: ${lastError}`, {
      kind: args.kind,
    });
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      operator: operator?.publicKey.toBase58() || null,
      cluster: CLUSTER,
      mode: "error",
      note: lastError,
    };
  }
}

export function getOperatorPubkey(): string | null {
  return operator?.publicKey.toBase58() || null;
}

/** Operator keypair (null until bootstrap). Used by the on-chain vault client. */
export function getOperatorKeypair(): Keypair | null {
  return operator;
}

export function getSolanaConnection(): Connection | null {
  return connection;
}

export function getSolanaCluster(): string {
  return CLUSTER;
}

export function isSolanaOnchain(): boolean {
  return ONCHAIN;
}
