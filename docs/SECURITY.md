# Security notes

This repo is a **Devnet demo**. Defaults are intentionally loose for local
walkthroughs. Do **not** expose the backend to the public internet with
`DEMO_MODE=true` and a funded operator.

## What is safe to publish

- Source code, IDL, Anchor program sources  
- `.env.example` (no secrets)  
- Program ID and Explorer links  

## What must never be committed

- `apps/backend/.env` / any `.env`  
- `apps/backend/.data/` (operator + demo agent keypairs)  
- `target/deploy/*-keypair.json`  

## Demo risks (by design today)

| Risk | Mitigation for any shared deploy |
|------|----------------------------------|
| `DEMO_MODE=true` accepts synthetic x402 payments | Set `DEMO_MODE=false`; use live facilitator |
| Unauthenticated `POST /pool/:id/fund` spends operator SPL into vaults | Add auth / allowlist / rate limits |
| Operator signs mint/claim/redeem for agents | Wallet adapter + user signatures |
| Hot operator key on disk | KMS / hardware wallet / multisig upgrade authority |

## Vault program

- Operator is the vault `operator` and (in the demo) also `owner`.  
- Redeem is operator-mediated — suitable for custodial demo agents only.  
- Rotate upgrade authority before mainnet.
