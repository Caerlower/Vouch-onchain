# Project audit (2026-10-16)

Status of what works on **Solana Devnet** today, what is simulated, and known gaps.

## Verified working

| Item | Evidence |
|------|----------|
| Backend health + MagicBlock enabled | `GET /health` → `magicblock.enabled: true`, `solana.lastError: null` |
| **Gift-card vault (Rust/Anchor)** | Program `8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT` deployed; init/fund/mint/claim/redeem live |
| Seller x402 resource | `GET :4101/x402/thanks` → HTTP 402 |
| Frontend | Vite on `:5174` |
| Typecheck | `npm run typecheck` clean |
| Operator funded | Devnet SOL + remittance mint |
| Fund / settle / mint attestations | Real Devnet **memo** signatures + Explorer links |
| MagicBlock private remits | `mode: magicblock-private`, rebate + tip txs **finalized** |
| Live SSE rail | `chain.attested`, `payment.settled`, `remit.magicblock`, vault txs streamed |

## Partially real / intentional shortcuts

| Item | Reality |
|------|---------|
| Gift-card **index** (code → card lookup) | Still mirrored **in-memory** for fast demo UX; mutations go on-chain |
| `DEMO_MODE` x402 payments | Synthetic `demo:<pubkey>` payment header — no facilitator USDC settle |
| Remittance / vault asset | Custom Devnet mint (`MAGICBLOCK_REMIT_MINT`), not Circle USDC |
| Claim / redeem signatures | Operator-mediated (agents don’t sign; operator is authority) |

## Why Rust is here now

The vault was deferred while the MagicBlock + x402 UX was proven with memo
attestations. It is now implemented and deployed so seller pool balances and
card PDAs have **real on-chain custody**.

## Security notes (demo scope)

- Operator secret lives in `apps/backend/.data/` (gitignored) — treat as hot key.
- `DEMO_MODE=true` must stay **off** for any public deployment accepting real payments.
- Vault upgrade authority is the operator keypair — rotate before production.
- No production auth, rate limits, or durable database yet.

## Recommended next steps

1. Wire live x402 facilitator settle (`DEMO_MODE=false`) with funded agent wallets.  
2. Prefer Circle Devnet USDC for remits when faucet access is available.  
3. Add persistence (Postgres / Redis) for sellers, cards, remits + rehydrate from vault.  
4. Wallet adapter for operators / agents instead of server-side demo keypairs.  
5. Program audits + mainnet deploy with multisig upgrade authority.  
