/**
 * Persistent real Solana keypairs for demo Agent A (referrer) and B (referred).
 * MagicBlock remits require valid pubkeys that can hold ATAs.
 */
import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";

const DATA_DIR = path.resolve(
  process.env.VOUCH_DATA_DIR || path.join(process.cwd(), ".data"),
);

function loadOrCreate(name: string): Keypair {
  const p = path.join(DATA_DIR, name);
  if (fs.existsSync(p)) {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const kp = Keypair.generate();
  fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

const agentA = loadOrCreate("agent-a.json");
const agentB = loadOrCreate("agent-b.json");

export const DEMO_AGENT_A = agentA.publicKey.toBase58();
export const DEMO_AGENT_B = agentB.publicKey.toBase58();

export function demoAgentsStatus() {
  return {
    a: DEMO_AGENT_A,
    b: DEMO_AGENT_B,
    roleA: "referrer",
    roleB: "referred",
  };
}
