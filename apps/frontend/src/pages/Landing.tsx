import { Link } from "react-router-dom";
import { motion } from "motion/react";
import GiftCardVisual from "../components/GiftCardVisual";
import type { GiftCard } from "../lib/api";

const SAMPLE: GiftCard = {
  id: "sample",
  code: "VOUCH-A1B2-C3D4",
  sellerId: "demo-thanks",
  endpointUrl: "https://api.example.com/x402/thanks",
  issuer: "AgntA111111111111111111111111111111111111111",
  owner: null,
  faceValueUsdc: 0.01,
  remainingUsdc: 0.01,
  commissionUsdc: 0.004,
  status: "minted",
  mintedAt: new Date().toISOString(),
  visibility: "private",
};

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 md:px-8 md:pt-12">
      <section className="grid min-h-[min(70dvh,620px)] items-center gap-10 md:grid-cols-2 md:gap-8">
        <div>
          <h1 className="font-display text-[clamp(3.25rem,9vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-ink">
            Vouch
          </h1>
          <p className="mt-3 text-[15px] font-medium text-accent">
            Built for Solana x402 · Settled on MagicBlock
          </p>
          <p className="mt-5 max-w-[26rem] text-[17px] leading-relaxed text-ink-2">
            Turn agent referrals into gift cards. Sellers fund a pool. Referrers
            share a card. Referred agents redeem — privately, at full list price.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/demo" className="btn-primary">
              Try the demo
            </Link>
            <Link to="/how" className="btn-ghost">
              How it works
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="flex justify-center lg:justify-end"
        >
          <div className="w-full max-w-[22rem]">
            <GiftCardVisual card={SAMPLE} highlight label="Referral gift card" />
            <p className="mt-4 text-center text-[13px] text-muted">
              Fund · Share · Redeem
            </p>
          </div>
        </motion.div>
      </section>

      <section className="mt-20 grid gap-x-10 gap-y-10 border-t border-line pt-12 md:grid-cols-3">
        {[
          {
            t: "Sellers fund growth",
            d: "Prepaid USDC covers rebates and tips. Your list price never changes.",
          },
          {
            t: "Agents pass cards",
            d: "After one payment, a referrer mints an endpoint-bound gift and shares it.",
          },
          {
            t: "Settles in private",
            d: "On redeem, MagicBlock splits rebate and tip away from the public ledger.",
          },
        ].map((item) => (
          <div key={item.t}>
            <h2 className="font-display text-[17px] font-semibold tracking-tight text-ink">
              {item.t}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{item.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
