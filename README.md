# Vouch · MagicBlock

[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Devnet-purple)](https://explorer.solana.com/?cluster=devnet)
[![MagicBlock](https://img.shields.io/badge/MagicBlock-Private%20PER-0A84FF)](https://www.magicblock.xyz)

**Seller-sponsored referral gift cards for Solana [x402](https://x402.org) agents, with private rebate/tip settlement via [MagicBlock](https://www.magicblock.xyz) Private Ephemeral Rollups.**

Standalone monorepo (not part of the Monad Vouch build). Same attribution idea — reframed so demos are visual, interactive, and land **real Devnet signatures**.

---

## Table of contents

- [Problem](#problem)
- [Solution](#solution)
- [How it works](#how-it-works)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Environment](#environment)
- [Architecture](#architecture)
- [On-chain status (Devnet)](#on-chain-status-devnet)
- [Gift-card vault (Rust)](#gift-card-vault-rust)
- [API](#api)
- [Demo script](#demo-script)
- [Development](#development)
- [License](#license)

---

## Problem

Native x402 lets agents pay APIs at full list price. Growth still needs
**agentic referral** — and sellers need a way to *sponsor* that loop without
discounting their API.

## Solution

| Piece | Role |
|-------|------|
| **Gift card** | Endpoint-bound, seller-funded sponsorship visible as a card |
| **Referrer (A)** | Pays once → mints card from the pool → shares it |
| **Referred (B)** | Claims → redeems while paying full list |
| **MagicBlock** | Private remit: rebate → B, tip → A (observers don’t see the split) |
| **Live rail** | SSE stream of every hop (settle, mint, remit) |

Seller still receives **full list price**. Card value comes from the prepaid pool.

---

## How it works

```text
Seller funds pool
        │
Agent A pays x402 (full list) ──► mints Gift Card (endpoint-bound)
                                        │
Agent B claims card ◄───────────────────┘
        │
        ▼
Agent B pays full list via Vouch (?gift=CODE)
        │
        ├─► Seller receives list price (pass-through)
        └─► MagicBlock private remit: rebate→B + tip→A
```

Narrated walkthrough: [`docs/DEMO.md`](./docs/DEMO.md)

---

## Repository layout

```text
vouch-magicblock/
├── apps/
│   ├── frontend/          # React 19 · Vite · demo + live SSE rail (:5174)
│   ├── backend/           # Express · x402 proxy · gift cards · MagicBlock (:4100)
│   └── seller/            # Demo Solana x402 resource (:4101)
├── programs/
│   └── gift-card-vault/   # Anchor/Rust vault (deployed on Devnet)
├── Anchor.toml            # Anchor workspace
├── docs/
│   ├── ARCHITECTURE.md    # System design, trust model, data flow
│   ├── AUDIT.md           # Honest Devnet capability matrix
│   └── DEMO.md            # 60–90s demo script
├── LICENSE
├── package.json           # Workspace scripts
└── README.md
```

---

## Quick start

**Requirements:** Node.js ≥ 20, npm, Devnet SOL for the operator (auto-created keypair).

```bash
git clone <repo-url> && cd vouch-magicblock
npm run install:all

cp apps/backend/.env.example  apps/backend/.env
cp apps/seller/.env.example   apps/seller/.env
cp apps/frontend/.env.example apps/frontend/.env

# three terminals
npm run dev:seller     # http://localhost:4101
npm run dev:backend    # http://localhost:4100
npm run dev:frontend   # http://localhost:5174
```

Open **http://localhost:5174/demo**.

If the UI badge says **Solana · needs SOL**, fund the operator from
`GET http://localhost:4100/health` → `solana.faucetUrl`.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEMO_MODE` | `true` | Synthetic x402 payment headers for walkthroughs |
| `SOLANA_ONCHAIN` | `true` | Post Devnet memo txs for fund / settle / mint |
| `MAGICBLOCK_ENABLED` | `true` | Live private PER remits (build → sign → send) |
| `MAGICBLOCK_REMIT_MINT` | (see `.env`) | Devnet mint for vault custody + private remits |
| `VAULT_ENABLED` | `true` | Call on-chain Anchor vault for fund/mint/claim/redeem |
| `VAULT_PROGRAM_ID` | `8Nbhcps…HbFT` | Deployed Devnet program id |
| `SOLANA_CLUSTER` | `devnet` | Cluster for Explorer links + RPC |
| `VOUCH_OPERATOR_SECRET` | unset | Optional; else keypair under `apps/backend/.data/` |

See `apps/*/.env.example` for the full set.

---

## Architecture

High-level diagram, trust model, and MagicBlock remit path:

**→ [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)**

```text
Frontend (:5174)  ←SSE/REST→  Backend (:4100)  ←402→  Seller (:4101)
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             Solana Devnet   MagicBlock API   In-memory index
           vault + memos     private remits    code → card
```

---

## On-chain status (Devnet)

| Capability | Status |
|------------|--------|
| Memo attestations (fund / settle / mint) | **Live** |
| Gift-card vault (Anchor / Rust) | **Live** — `8NbhcpsM2VojigW8GRy1ZcY3XhKEpdV9Rte24PmWHbFT` |
| MagicBlock private rebate + tip | **Live** (`magicblock-private`) |
| SSE activity + Explorer links | **Live** |
| Facilitator USDC x402 settle | **Demo mode** (`DEMO_MODE=true`) |

Full matrix and gaps: **[`docs/AUDIT.md`](./docs/AUDIT.md)**

---

## Gift-card vault (Rust)

Anchor program under [`programs/gift-card-vault/`](./programs/gift-card-vault/):

- **Custody** — seller pool SPL in a vault ATA  
- **Soft-lock** — `mint_card` reserves face + commission  
- **Redeem** — transfers to operator ATA + writes `RemitReceipt`  
- **Client** — `apps/backend/src/lib/vault.ts` (`VAULT_ENABLED=true`)

```bash
npm run build:program
npm run deploy:program   # Devnet; uses operator keypair
```

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Cluster, vault, MagicBlock, operator, demo agents |
| `GET` | `/events` | SSE live rail |
| `GET` | `/demo/agents` | Real Devnet pubkeys for Agents A / B |
| `POST` | `/sellers/probe` | Discover payTo + price from a live 402 |
| `POST` | `/sellers` | Register endpoint + seed pool (on-chain vault) |
| `POST` | `/pool/:id/fund` | Top up pool (vault `fund` + memo) |
| `POST` | `/gift-cards/mint` | Referrer mints card (vault `mint_card`) |
| `POST` | `/gift-cards/claim` | Referred agent claims (vault `claim_card`) |
| `GET` | `/r/:sellerId/resource` | x402 proxy (redeem with `?gift=`) |
| `POST` | `/demo/pay` | Demo settle walkthrough |

---

## Demo script

See **[`docs/DEMO.md`](./docs/DEMO.md)** for a 60–90 second narration.

---

## Development

```bash
npm run typecheck          # backend + frontend + seller
npm run build:frontend     # production Vite build
npm run build:program      # Anchor gift-card-vault
```

**Stack:** Node 20 · Express · Vite · React 19 · Motion · Tailwind v4 ·
Rust / Anchor 1.x · `@solana/web3.js` · MagicBlock Private Payments API

**Conventions:**

- Secrets and keypairs: never commit `.env` or `apps/backend/.data/`
- Prefer Explorer links in the UI over opaque IDs
- Keep MagicBlock remits `visibility: private`

---

## License

[MIT](./LICENSE)
