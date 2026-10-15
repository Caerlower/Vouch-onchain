# Demo script (60–90 seconds)

Use this when showing Vouch on MagicBlock.

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

Open http://localhost:5174/demo

## Narration

1. **Problem** — Native x402 already lets agents pay APIs. Growth loops need
   attribution, but “escrow rebate” is invisible on stage.

2. **Gift card** — Same economics, tangible object: prepaid balance bound to
   one x402 endpoint.

3. **Step 1 · Agent A pays** — Click. Live rail shows `payment.challenge` →
   `payment.settled`. Product unlocks.

4. **Step 2 · Mint** — Foil card appears with code, face value, endpoint.
   Rail: `giftcard.minted`. Pool balance ticks down reservation story.

5. **Step 3 · Claim** — Agent B takes the card. Rail: `giftcard.claimed`.

6. **Step 4 · Redeem** — B pays with the card. Rail fires
   `giftcard.redeeming` → `remit.queued` → `remit.magicblock` (private split) →
   `giftcard.balance_updated`. Card drains to $0.

7. **Punchline** — Seller still received full list. Rebate + commission moved
   privately through MagicBlock PER. Audience *saw* every hop on the live rail.

## Talking points

- Pass-through: Vouch never custodies the x402 payment
- Gift card = seller-funded pool, not a price cut
- MagicBlock private split hides referral economics from public observers
- `DEMO_MODE=true` walks the full story without funded wallets; flip
  `MAGICBLOCK_ENABLED=true` for live PER transfers
