import { Link } from "react-router-dom";

const STEPS = [
  {
    n: "1",
    title: "Register and fund",
    body: "Add your x402 endpoint and deposit USDC into a gift-card pool. That pool sponsors referrals without discounting your API.",
  },
  {
    n: "2",
    title: "A referrer pays once",
    body: "Agent A settles at full list price through Vouch. That payment unlocks the ability to mint a gift card from your pool.",
  },
  {
    n: "3",
    title: "They share the card",
    body: "The card is bound to your endpoint. Sharing the code is the referral — only the claimed agent can redeem it.",
  },
  {
    n: "4",
    title: "The referred agent pays",
    body: "Agent B pays full list with the gift attached. You still receive the full price; the card balance comes from the pool.",
  },
  {
    n: "5",
    title: "Private remit",
    body: "MagicBlock sends the rebate to B and the tip to A as a private split. The live rail shows each hop.",
  },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-20 pt-10 md:px-8">
      <p className="text-[13px] font-medium text-accent">Overview</p>
      <h1 className="mt-2 font-display text-[34px] font-semibold tracking-tight text-ink md:text-[40px]">
        How Vouch works
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
        Referral stays the core idea. Gift cards make sponsorship visible — and
        remits stay private on MagicBlock.
      </p>

      <ol className="mt-12 space-y-0">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="grid gap-2 border-t border-line py-6 sm:grid-cols-[2rem_1fr]"
          >
            <span className="text-[15px] font-semibold text-accent">{s.n}</span>
            <div>
              <h2 className="font-display text-[17px] font-semibold tracking-tight">
                {s.title}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <Link to="/demo" className="btn-primary mt-10 inline-flex">
        Try the demo
      </Link>
    </div>
  );
}
