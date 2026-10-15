# Gift Card Vault (Anchor / Rust)

**Program ID (Devnet):** `8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT`

Seller-prepaid SPL vault that backs endpoint gift cards for Vouch x402 referrals.
Deployed on Solana Devnet; the backend (`apps/backend/src/lib/vault.ts`) is the
operator client.

## Build & deploy

```bash
# from repo root (requires Anchor 1.x + Solana CLI)
anchor build --ignore-keys
anchor program deploy --provider.cluster devnet
```

Upgrade authority / fee payer: `apps/backend/.data/operator-keypair.json`

## Accounts

| Account | Seeds | Purpose |
|---------|-------|---------|
| `Vault` | `["vault", seller_id]` | Balance, reserved, operator, mint |
| Vault ATA | ATA(vault, mint) | SPL custody |
| `GiftCard` | `["card", code_hash]` | Face, commission, issuer, owner, status |
| `RemitReceipt` | `["remit", settle_sig_hash]` | Idempotency after redeem |

`seller_id` must be 1–32 UTF-8 bytes (e.g. `demo-thanks`).  
`code_hash` / `settle_sig_hash` are SHA-256 digests.

## Instructions

1. **`initialize_vault(seller_id)`** — create vault PDA + ATA  
2. **`fund(seller_id, amount)`** — SPL transfer into vault  
3. **`mint_card(...)`** — soft-lock `face + commission`, create card PDA  
4. **`claim_card(seller_id, code_hash)`** — bind owner (operator-mediated)  
5. **`redeem_card(...)`** — debit vault → operator ATA; write remit receipt  
6. **`withdraw(seller_id, amount)`** — owner pulls unreserved funds  

After redeem, the backend calls MagicBlock private PER transfers
(rebate → buyer, tip → issuer).

## Types

TypeScript account mirror: [`state.ts`](./state.ts)  
IDL (copied for backend): `apps/backend/idl/gift_card_vault.json`
