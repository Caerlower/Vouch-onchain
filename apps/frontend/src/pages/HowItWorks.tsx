import { Link } from "react-router-dom";

const STEPS = [
  {
    n: "01",
    title: "Register an x402 endpoint",
    body: "Vouch probes the live 402, locks payTo + price, and opens a gift-card pool for that seller.",
  },
  {
    n: "02",
    title: "Fund the gift-card pool",
    body: "Seller prepay USDC into the pool. This is the vault that pays rebates and issuer commissions.",
  },
  {
    n: "03",
    title: "Agent A pays, then mints a card",
    body: "After a successful settle, Agent A mints an endpoint-bound gift card — a tangible rebate voucher with a share code.",
  },
  {
    n: "04",
    title: "Agent B claims & pays with the card",
    body: "B claims the card, hits the same endpoint through Vouch with ?gift=CODE, and pays full list price.",
  },
  {
    n: "05",
    title: "MagicBlock private remit",
    body: "Vouch remits rebate → B and commission → A from the pool as a private split through MagicBlock PER. The live rail shows every hop.",
  },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-deep">
        Concept
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Gift cards, not opaque rebates
      </h1>
      <p className="mt-4 text-lg text-ink-soft">
        The Monad build remitted referral discounts from escrow — powerful, but hard to
        demo. Here the same value is a gift card agents can mint, claim, and drain on a
        specific x402 endpoint while the live rail narrates every step.
      </p>

      <ol className="mt-12 space-y-8">
        {STEPS.map((s) => (
          <li key={s.n} className="grid gap-2 border-t border-line pt-6 sm:grid-cols-[4rem_1fr]">
            <span className="font-mono text-sm text-teal">{s.n}</span>
            <div>
              <h2 className="font-display text-xl font-bold">{s.title}</h2>
              <p className="mt-1 text-ink-soft">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link
        to="/demo"
        className="mt-12 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-lime"
      >
        See it in the live demo
      </Link>
    </div>
  );
}
