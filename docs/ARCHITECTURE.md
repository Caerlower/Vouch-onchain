# Architecture

## System overview

Vouch turns **seller-sponsored agent referrals** into endpoint-bound gift cards
on Solana x402, with private rebate/tip settlement through MagicBlock Private
Ephemeral Rollups (PER).

```text
┌─────────────┐   SSE / REST    ┌──────────────────┐   402 proxy    ┌────────────┐
│  Frontend   │◄───────────────►│     Backend      │◄──────────────►│   Seller   │
│  :5174      │                 │     :4100        │                │   :4101    │
└─────────────┘                 └────────┬─────────┘                └────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
       Solana Devnet              MagicBlock API              In-memory index
   vault PDAs + memos           private SPL remits           code → card lookup
```

## Trust & custody model

| Flow | Who moves funds | Notes |
|------|-----------------|-------|
| x402 API payment | Buyer → seller (pass-through) | Backend relays; does not custody list-price USDC in demo mode |
| Gift-card pool | Seller prepaid SPL | **On-chain vault** (`gift_card_vault`) holds tokens; soft-locks on mint |
| Referral remits | Vault → operator → buyer/issuer | Redeem debits vault to operator; MagicBlock privately remits |

**Program ID (Devnet):** `8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT`

## Runtime components

### `apps/frontend`

React 19 + Vite + Tailwind + Motion. Surfaces:

- Landing / How it works / Register / Claim / Demo
- Live SSE activity rail (`GET /events`)
- On-chain ledger at end of demo (Explorer links)

### `apps/backend`

Express API:

- Seller probe/register, pool fund, gift-card mint/claim/redeem
- x402 pass-through (`/r/:sellerId/resource`)
- Solana Devnet memo attestations (`SOLANA_ONCHAIN`)
- **Anchor vault client** (`lib/vault.ts`, `VAULT_ENABLED`)
- MagicBlock private remits (`MAGICBLOCK_ENABLED`)
- SSE event bus for the live rail

Operator keypair auto-created at `apps/backend/.data/operator-keypair.json`
(gitignored). Demo agents A/B are real Devnet keypairs in the same folder.

### `apps/seller`

Minimal native Solana x402 resource (`/x402/thanks`) used as the demo endpoint.

### `programs/gift-card-vault`

Anchor 1.x Rust program:

- `initialize_vault` / `fund` / `mint_card` / `claim_card` / `redeem_card` / `withdraw`
- Vault ATA custody of `MAGICBLOCK_REMIT_MINT`
- Gift-card + remit-receipt PDAs

See [`programs/gift-card-vault/README.md`](../programs/gift-card-vault/README.md).

## On-chain vs off-chain (honest map)

| Concern | Today (Devnet) | Notes |
|---------|----------------|-------|
| Pool balances / card PDAs | **Anchor vault** | Live on Devnet |
| Code → card lookup / SSE UX | In-memory mirror | Mutations always hit the vault when enabled |
| Settle / fund / mint proof | Memo txs + vault txs | Explorer links on the rail |
| Referral remits | MagicBlock **private** SPL | After vault redeem |
| Agent wallets (demo) | Generated Devnet keypairs | Operator signs vault ixs |
| x402 payment payload | `DEMO_MODE` synthetic header | Live facilitator next |

## Redeem path

```text
redeem(gift) → finishSettlement
                 → redeemCardOnchain (vault: debit → operator ATA + RemitReceipt)
                 → redeemGiftCard (in-memory index)
                 → remitGiftCardSplit
                      → POST /v1/spl/transfer (private) ×2
                      → sign with operator
                      → POST /v1/transaction/send
                      → publish remit.magicblock + Explorer URLs
```

Remits use `MAGICBLOCK_REMIT_MINT` (same mint as vault custody) so private PER
splits work without Circle faucet USDC.

## Data flow (demo cycle)

1. **Fund pool** → vault `fund` + memo attestation + in-memory credit  
2. **Agent A pays** → settle attestation  
3. **Mint card** → vault `mint_card` + in-memory card + mint attestation  
4. **Share / claim** → vault `claim_card` + bind owner  
5. **Agent B redeems** → vault `redeem_card` + MagicBlock private rebate/tip  

## Ports

| Service | Port |
|---------|------|
| Frontend | 5174 |
| Backend | 4100 |
| Seller | 4101 |
