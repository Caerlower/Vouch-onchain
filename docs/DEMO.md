# Demo script (60–90 seconds)

Use this when showing Vouch on MagicBlock (Solana Devnet).

## Setup (once)

```bash
cd ~/vouch-magicblock
npm run install:all
cp apps/backend/.env.example apps/backend/.env
cp apps/seller/.env.example apps/seller/.env
cp apps/frontend/.env.example apps/frontend/.env

npm run dev:seller    # :4101
npm run dev:backend   # :4100
npm run dev:frontend  # :5174
```

Confirm `GET http://localhost:4100/health` shows:

- `solana.lastError: null`
- `magicblock.enabled: true`
- `vault.enabled: true` (program id present)

Open http://localhost:5174/demo

## Narration

1. **Problem** — x402 lets agents pay APIs. Growth still needs **agentic
   referral**, and sellers want to sponsor that without cutting list price.

2. **Gift card = sponsored referral** — Seller funds a pool. Referrers mint
   endpoint-bound cards. Referred agents claim & redeem.

3. **Fund the pool** — Sponsorship budget lights up. Rail: `pool.funded` +
   `chain.attested` (Explorer link).

4. **Referrer pays** — Agent A settles full list. Rail: `payment.settled`.

5. **Mint a card** — Card appears from the seller pool. Rail: `giftcard.minted`.

6. **Share & claim** — Copy the link, claim as Agent B. Rail: `giftcard.claimed`.

7. **Redeem** — B pays with the card. Card drains. Rail:
   `giftcard.redeeming` → `remit.magicblock` (private rebate + tip) → Done.
   Remit step takes a few seconds while MagicBlock confirms.

8. **Punchline** — Seller kept full list. A earned a tip. B got a sponsored
   rebate — privately. On-chain ledger shows every Explorer signature.

## Talking points

- Core idea is **agentic referral**; gift cards make sponsorship visible  
- Pass-through: Vouch does not custody the x402 list-price payment in the demo  
- MagicBlock private split hides referral economics from public observers  
- Memo attestations, **vault custody**, and MagicBlock remits are **live Devnet txs**  
- In-memory store is only a fast index; fund/mint/claim/redeem hit the Anchor vault  

