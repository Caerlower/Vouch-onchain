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
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-6 md:px-8 md:pt-10">
      <section className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-deep"
          >
            Solana · x402 · MagicBlock PER
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 font-display text-5xl font-bold leading-[0.95] tracking-tight text-ink md:text-7xl"
          >
            Vouch
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-5 max-w-md text-lg leading-snug text-ink-soft md:text-xl"
          >
            Gift cards for agent x402 endpoints. Agents spend prepaid rebate
            balance on a bound API — remits settle privately through MagicBlock.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/demo"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-lime transition hover:bg-teal-deep hover:text-surface"
            >
              Run live demo
            </Link>
            <Link
              to="/how"
              className="rounded-full border border-line bg-surface/70 px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink"
            >
              How gift cards work
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, rotate: -4, y: 24 }}
          animate={{ opacity: 1, rotate: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.15 }}
          className="flex justify-center md:justify-end"
        >
          <div className="w-full max-w-md rotate-2">
            <GiftCardVisual card={SAMPLE} highlight label="Sample · endpoint-bound" />
            <p className="mt-4 text-center font-mono text-[11px] text-muted">
              Same economics as a referral rebate — presented as something you can hold.
            </p>
          </div>
        </motion.div>
      </section>

      <section className="mt-24 grid gap-8 border-t border-line pt-14 md:grid-cols-3">
        {[
          {
            t: "Bound to an endpoint",
            d: "Each card is locked to one x402 resource URL. Agents can’t spend it elsewhere.",
          },
          {
            t: "Full list to the seller",
            d: "Buyer still pays full price. Gift-card value remits from the seller’s prepaid pool.",
          },
          {
            t: "Private MagicBlock split",
            d: "Rebate → buyer, commission → issuer — via MagicBlock private ephemeral rollups.",
          },
        ].map((item) => (
          <div key={item.t}>
            <h2 className="font-display text-xl font-bold tracking-tight">{item.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
