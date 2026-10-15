# Gift Card Vault (Solana program sketch)

Seller-prepaid USDC vault that backs endpoint gift cards.

The TypeScript demo in `apps/backend` mirrors this state machine in-memory so the
UI is demoable without a deployed program. When you deploy, wire
`apps/backend/src/lib/pool.ts` to these instructions.

## Accounts

| Account | Seeds | Purpose |
|---|---|---|
| `Vault` | `["vault", seller_id]` | USDC token account + metadata |
| `GiftCard` | `["card", code_hash]` | Face value, remaining, issuer, owner, endpoint hash |
| `RemitReceipt` | `["remit", settle_sig]` | Idempotency for rebate + commission |

## Instructions

1. **`initialize_vault(seller_id, owner)`** — create vault ATA, set operator
2. **`fund(amount)`** — SPL transfer USDC into vault
3. **`mint_card(code, face, commission, endpoint_hash, issuer)`** — reserve
   `face + commission` from vault balance (soft lock) and create card PDA
4. **`claim_card(owner)`** — bind owner (≠ issuer)
5. **`redeem_card(settle_sig, buyer)`** — debit vault; emit events for
   MagicBlock private split (rebate → buyer, commission → issuer)
6. **`withdraw(amount)`** — owner pulls unused USDC

## MagicBlock integration

After `redeem_card`, the Vouch operator calls MagicBlock
`POST /v1/spl/transfer` twice (or one split schedule) with
`visibility: "private"`, `fromBalance: "base"`, `toBalance: "base"`:

- rebate → buyer
- commission → issuer

Observers see the agent paid the seller; they do **not** see who received the
gift-card economics.
