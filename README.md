# Vouch · MagicBlock

**Endpoint gift cards for native [x402](https://x402.org) agents on [Solana](https://solana.com), with private remits via [MagicBlock](https://www.magicblock.xyz) Private Ephemeral Rollups.**

Standalone repo — not part of the Monad Vouch build. Same attribution idea, reframed so demos are visual and alive.

---

## Why gift cards?

Referral escrow rebates are correct economics but weak on stage. Here the rebate is a **gift card**:

- Bound to one x402 endpoint URL  
- Minted by Agent A after paying  
- Claimed by Agent B  
- Redeemed on settle → **MagicBlock private split** (rebate → B, commission → A)  
- **Live event rail** streams every hop so nothing happens “behind the curtain”

Seller still receives **full list price**. Gift-card value comes from a seller-prepaid pool.

```text
Agent A pays x402 ──► mints Gift Card (endpoint-bound)
                              │
Agent B claims card ◄─────────┘
        │
        ▼
Agent B pays full list via Vouch (?gift=CODE)
        │
        ├─► Seller settles USDC (pass-through)
        └─► MagicBlock private remit: rebate→B + commission→A
```

---

## Quick start

```bash
cd ~/vouch-magicblock
npm run install:all

cp apps/backend/.env.example apps/backend/.env
cp apps/seller/.env.example apps/seller/.env
cp apps/frontend/.env.example apps/frontend/.env

npm run dev:seller     # :4101
npm run dev:backend    # :4100
npm run dev:frontend   # :5174
```

Open **http://localhost:5174/demo** and click through the five steps.

Demo script: [`docs/DEMO.md`](./docs/DEMO.md)

---

## Architecture

```text
vouch-magicblock/
  apps/frontend/     Gift-card stage + live SSE rail
  apps/backend/      x402 pass-through · mint/claim/redeem · MagicBlock remits
  apps/seller/       Native Solana x402 demo resource
  programs/          On-chain vault sketch for later Anchor deploy
  docs/              Demo narration
```

| Layer | Role |
|---|---|
| **Frontend** | Foil gift-card UI, staged Agent A→B flow, live event stream |
| **Backend** | Relay seller 402, gift-card lifecycle, pool accounting, MagicBlock split |
| **Seller** | Canonical x402 `/x402/thanks` on Solana |
| **MagicBlock** | Private USDC remits (`visibility: private`, base→base) for rebate + commission |

`DEMO_MODE=true` (default) completes the full story without funded wallets. Set `MAGICBLOCK_ENABLED=true` to hit the live Private Payments API.

---

## API surface (gift cards)

| Method | Path | Purpose |
|---|---|---|
| GET | `/events` | SSE live rail |
| POST | `/sellers/probe` | Discover payTo + price from live 402 |
| POST | `/sellers` | Register endpoint + seed pool |
| POST | `/pool/:id/fund` | Top up gift-card pool |
| POST | `/gift-cards/mint` | Agent A mints card |
| POST | `/gift-cards/claim` | Agent B claims |
| GET | `/r/:sellerId/resource?gift=` | x402 proxy (redeem on settle) |
| POST | `/demo/pay` | Demo settle (local walkthrough) |

---

## Stack

- **Chain:** Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)  
- **Payments:** x402 v2 · Exact SVM · USDC  
- **Private remits:** MagicBlock SPL Private Payments API  
- **Runtime:** Node ≥ 20 · Express · Vite · React 19 · Motion  

---

## License

MIT
