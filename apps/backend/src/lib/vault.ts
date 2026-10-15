/**
 * On-chain gift-card vault client (Anchor program on Solana Devnet).
 * Program: gift_card_vault @ 8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT
 */
import { createHash } from "node:crypto";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { explorerTxUrl, shortAddr, usdcToAtomic } from "./chain.js";
import { publish } from "./events.js";
import {
  ensureSolanaReady,
  getOperatorKeypair,
  getSolanaCluster,
  getSolanaConnection,
} from "./solana-tx.js";

export const VAULT_PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID ||
    "8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT",
);

const VAULT_ENABLED =
  String(process.env.VAULT_ENABLED || "true").toLowerCase() !== "false";

const REMIT_MINT = new PublicKey(
  process.env.MAGICBLOCK_REMIT_MINT ||
    process.env.VAULT_MINT ||
    "GpoEMmArrAizS963cU4viTfDiCcN6VkDYEo8bx5HLmAR",
);

const IX = {
  initialize_vault: Buffer.from([48, 191, 163, 44, 71, 129, 63, 164]),
  fund: Buffer.from([218, 188, 111, 221, 152, 113, 174, 7]),
  mint_card: Buffer.from([58, 198, 225, 36, 193, 210, 202, 108]),
  claim_card: Buffer.from([156, 202, 234, 208, 16, 159, 52, 215]),
  redeem_card: Buffer.from([131, 111, 251, 88, 180, 136, 12, 25]),
  withdraw: Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]),
} as const;

export type VaultTxResult = {
  ok: boolean;
  signature: string | null;
  explorerUrl: string | null;
  mode: "onchain" | "skipped" | "error";
  note: string;
  vault?: string;
  cardPda?: string;
};

export function vaultStatus() {
  return {
    enabled: VAULT_ENABLED,
    programId: VAULT_PROGRAM_ID.toBase58(),
    mint: REMIT_MINT.toBase58(),
    explorerProgram: `https://explorer.solana.com/address/${VAULT_PROGRAM_ID.toBase58()}?cluster=${getSolanaCluster()}`,
  };
}

export function isVaultEnabled(): boolean {
  return VAULT_ENABLED;
}

export function sha256Bytes(input: string | Buffer): Buffer {
  return createHash("sha256").update(input).digest();
}

export function vaultPda(sellerId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(sellerId, "utf8")],
    VAULT_PROGRAM_ID,
  )[0];
}

export function cardPda(codeHash: Buffer): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("card"), codeHash],
    VAULT_PROGRAM_ID,
  )[0];
}

export function remitPda(settleSigHash: Buffer): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("remit"), settleSigHash],
    VAULT_PROGRAM_ID,
  )[0];
}

function encodeString(s: string): Buffer {
  const body = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length, 0);
  return Buffer.concat([len, body]);
}

function encodeU64(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n), 0);
  return buf;
}

async function sendIx(
  ixs: TransactionInstruction[],
  label: string,
): Promise<VaultTxResult> {
  if (!VAULT_ENABLED) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "skipped",
      note: "VAULT_ENABLED=false",
    };
  }

  try {
    await ensureSolanaReady();
    const connection = getSolanaConnection();
    const operator = getOperatorKeypair();
    if (!connection || !operator) {
      throw new Error("solana_not_ready");
    }

    const tx = new Transaction().add(...ixs);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [operator],
      { commitment: "confirmed" },
    );
    const explorerUrl = explorerTxUrl(signature, getSolanaCluster());

    publish(
      "chain.attested",
      `Vault ${label} · ${shortAddr(signature, 6)}`,
      {
        kind: `vault.${label}`,
        signature,
        explorerUrl,
        programId: VAULT_PROGRAM_ID.toBase58(),
        cluster: getSolanaCluster(),
      },
    );

    return {
      ok: true,
      signature,
      explorerUrl,
      mode: "onchain",
      note: `Vault ${label} confirmed`,
    };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    publish("error", `Vault ${label} failed: ${note}`, { label });
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note,
    };
  }
}

async function accountExists(
  connection: Connection,
  pubkey: PublicKey,
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey, "confirmed");
  return Boolean(info);
}

/** Ensure vault PDA + ATA exist for seller. */
export async function ensureVaultInitialized(
  sellerId: string,
): Promise<VaultTxResult> {
  if (!VAULT_ENABLED) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "skipped",
      note: "VAULT_ENABLED=false",
    };
  }
  if (!sellerId || sellerId.length > 32) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "invalid_seller_id",
    };
  }

  await ensureSolanaReady();
  const connection = getSolanaConnection();
  const operator = getOperatorKeypair();
  if (!connection || !operator) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "solana_not_ready",
    };
  }

  const vault = vaultPda(sellerId);
  if (await accountExists(connection, vault)) {
    return {
      ok: true,
      signature: null,
      explorerUrl: null,
      mode: "onchain",
      note: "vault_already_initialized",
      vault: vault.toBase58(),
    };
  }

  const vaultAta = getAssociatedTokenAddressSync(
    REMIT_MINT,
    vault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const data = Buffer.concat([IX.initialize_vault, encodeString(sellerId)]);
  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: operator.publicKey, isSigner: true, isWritable: true },
      { pubkey: operator.publicKey, isSigner: false, isWritable: false }, // owner
      { pubkey: operator.publicKey, isSigner: true, isWritable: false }, // operator
      { pubkey: REMIT_MINT, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
    data,
  });

  const result = await sendIx([ix], "initialize");
  return { ...result, vault: vault.toBase58() };
}

/** Fund vault with remittance-mint tokens (atomic or USDC units). */
export async function fundVaultOnchain(args: {
  sellerId: string;
  amountUsdc: number;
}): Promise<VaultTxResult> {
  const amount = usdcToAtomic(args.amountUsdc);
  if (!(amount > 0)) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "invalid_amount",
    };
  }

  const init = await ensureVaultInitialized(args.sellerId);
  if (!init.ok && init.mode === "error") return init;

  await ensureSolanaReady();
  const connection = getSolanaConnection();
  const operator = getOperatorKeypair();
  if (!connection || !operator) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "solana_not_ready",
    };
  }

  const vault = vaultPda(args.sellerId);
  const vaultAta = getAssociatedTokenAddressSync(REMIT_MINT, vault, true);
  const funderAta = getAssociatedTokenAddressSync(
    REMIT_MINT,
    operator.publicKey,
  );

  const data = Buffer.concat([
    IX.fund,
    encodeString(args.sellerId),
    encodeU64(amount),
  ]);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: operator.publicKey, isSigner: true, isWritable: true },
      { pubkey: REMIT_MINT, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: funderAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const result = await sendIx([ix], "fund");
  return { ...result, vault: vault.toBase58() };
}

export async function mintCardOnchain(args: {
  sellerId: string;
  code: string;
  endpointUrl: string;
  issuer: string;
  faceValueUsdc: number;
  commissionUsdc: number;
}): Promise<VaultTxResult> {
  await ensureSolanaReady();
  const operator = getOperatorKeypair();
  if (!operator) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "solana_not_ready",
    };
  }

  const codeHash = sha256Bytes(args.code.trim().toUpperCase());
  const endpointHash = sha256Bytes(args.endpointUrl);
  const vault = vaultPda(args.sellerId);
  const card = cardPda(codeHash);
  const issuer = new PublicKey(args.issuer);

  const data = Buffer.concat([
    IX.mint_card,
    encodeString(args.sellerId),
    codeHash,
    endpointHash,
    encodeU64(usdcToAtomic(args.faceValueUsdc)),
    encodeU64(usdcToAtomic(args.commissionUsdc)),
  ]);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: operator.publicKey, isSigner: true, isWritable: true },
      { pubkey: operator.publicKey, isSigner: true, isWritable: false },
      { pubkey: issuer, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: card, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const result = await sendIx([ix], "mint");
  return { ...result, vault: vault.toBase58(), cardPda: card.toBase58() };
}

export async function claimCardOnchain(args: {
  sellerId: string;
  code: string;
  owner: string;
}): Promise<VaultTxResult> {
  await ensureSolanaReady();
  const operator = getOperatorKeypair();
  if (!operator) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "solana_not_ready",
    };
  }

  const codeHash = sha256Bytes(args.code.trim().toUpperCase());
  const vault = vaultPda(args.sellerId);
  const card = cardPda(codeHash);
  const owner = new PublicKey(args.owner);

  const data = Buffer.concat([
    IX.claim_card,
    encodeString(args.sellerId),
    codeHash,
  ]);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: operator.publicKey, isSigner: true, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: card, isSigner: false, isWritable: true },
    ],
    data,
  });

  const result = await sendIx([ix], "claim");
  return { ...result, vault: vault.toBase58(), cardPda: card.toBase58() };
}

export async function redeemCardOnchain(args: {
  sellerId: string;
  code: string;
  buyer: string;
  settleTxId: string;
}): Promise<VaultTxResult> {
  await ensureSolanaReady();
  const connection = getSolanaConnection();
  const operator = getOperatorKeypair();
  if (!connection || !operator) {
    return {
      ok: false,
      signature: null,
      explorerUrl: null,
      mode: "error",
      note: "solana_not_ready",
    };
  }

  const codeHash = sha256Bytes(args.code.trim().toUpperCase());
  const settleSigHash = sha256Bytes(args.settleTxId);
  const vault = vaultPda(args.sellerId);
  const card = cardPda(codeHash);
  const receipt = remitPda(settleSigHash);
  const buyer = new PublicKey(args.buyer);
  const vaultAta = getAssociatedTokenAddressSync(REMIT_MINT, vault, true);
  const operatorAta = getAssociatedTokenAddressSync(
    REMIT_MINT,
    operator.publicKey,
  );

  const ensureAta = createAssociatedTokenAccountIdempotentInstruction(
    operator.publicKey,
    operatorAta,
    operator.publicKey,
    REMIT_MINT,
  );

  const data = Buffer.concat([
    IX.redeem_card,
    encodeString(args.sellerId),
    codeHash,
    settleSigHash,
  ]);

  const redeemIx = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: operator.publicKey, isSigner: true, isWritable: true },
      { pubkey: operator.publicKey, isSigner: true, isWritable: false },
      { pubkey: buyer, isSigner: false, isWritable: false },
      { pubkey: REMIT_MINT, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: operatorAta, isSigner: false, isWritable: true },
      { pubkey: card, isSigner: false, isWritable: true },
      { pubkey: receipt, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const result = await sendIx([ensureAta, redeemIx], "redeem");
  return { ...result, vault: vault.toBase58(), cardPda: card.toBase58() };
}
