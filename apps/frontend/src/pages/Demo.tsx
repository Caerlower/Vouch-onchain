import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  api,
  DEMO_AGENT_A,
  DEMO_AGENT_B,
  shortAddr,
  type GiftCard,
} from "../lib/api";
import GiftCardVisual from "../components/GiftCardVisual";
import EventStream from "../components/EventStream";

const STEPS = [
  {
    id: "a-pay",
    title: "Agent A pays",
    blurb: "Full list price through Vouch → seller settles.",
  },
  {
    id: "mint",
    title: "Mint gift card",
    blurb: "A mints an endpoint-bound card from the seller pool.",
  },
  {
    id: "claim",
    title: "Agent B claims",
    blurb: "B takes the card — balance is now theirs to spend.",
  },
  {
    id: "b-pay",
    title: "B pays with card",
    blurb: "Full list again. Card redeems → MagicBlock private split.",
  },
  {
    id: "proof",
    title: "Proof",
    blurb: "Watch the live rail — every hop is visible.",
  },
];

type PayResult = {
  message?: string;
  vouch?: {
    settleTxId?: string;
    remit?: Record<string, unknown>;
  };
};

export default function Demo() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sellers, setSellers] = useState<Array<Record<string, unknown>>>([]);
  const [sellerId, setSellerId] = useState("");
  const [pool, setPool] = useState<Record<string, unknown> | null>(null);
  const [card, setCard] = useState<GiftCard | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [payA, setPayA] = useState<PayResult | null>(null);
  const [payB, setPayB] = useState<PayResult | null>(null);
  const [productMsg, setProductMsg] = useState<string | null>(null);
  const [status, setStatus] = useState("Pick a seller and press Run step");

  const refreshSellers = useCallback(async () => {
    try {
      const d = await api.sellers();
      const list = d.sellers || [];
      setSellers(list);
      const stored = localStorage.getItem("vouch-mb:sellerId");
      const pick =
        list.find((s) => s.id === stored) ||
        list.find((s) => s.id === "demo-thanks") ||
        list[0];
      if (pick?.id && !sellerId) setSellerId(String(pick.id));
    } catch {
      /* ignore */
    }
  }, [sellerId]);

  useEffect(() => {
    refreshSellers();
  }, [refreshSellers]);

  useEffect(() => {
    if (!sellerId) return;
    api
      .pool(sellerId)
      .then((p) => setPool(p as Record<string, unknown>))
      .catch(() => setPool(null));
  }, [sellerId, card, payB]);

  const seller = useMemo(
    () => sellers.find((s) => s.id === sellerId),
    [sellers, sellerId],
  );

  const primaryLabel = useMemo(() => {
    if (busy) return "Working…";
    return [
      "1 · Agent A pays",
      "2 · Mint gift card",
      "3 · Agent B claims",
      "4 · B pays with card",
      "5 · Done — replay",
    ][step];
  }, [busy, step]);

  async function ensureSeller(): Promise<string> {
    if (sellerId) return sellerId;
    const url =
      import.meta.env.VITE_DEMO_SELLER_URL ||
      "http://localhost:4101/x402/thanks";
    const d = (await api.registerSeller({
      id: "demo-thanks",
      name: "Vouch Thanks",
      resourceUrl: url,
      seedPoolUsdc: 5,
    })) as { seller: { id: string } };
    await refreshSellers();
    setSellerId(d.seller.id);
    localStorage.setItem("vouch-mb:sellerId", d.seller.id);
    return d.seller.id;
  }

  async function runStep() {
    setBusy(true);
    setError("");
    try {
      const sid = await ensureSeller();

      if (step === 0) {
        setStatus("Agent A hitting x402 via Vouch…");
        const result = (await api.demoPay({
          sellerId: sid,
          payer: DEMO_AGENT_A,
        })) as PayResult & { message?: string };
        setPayA(result);
        setProductMsg(result.message || null);
        setStatus("Agent A settled · ready to mint a gift card");
        setStep(1);
      } else if (step === 1) {
        setStatus("Minting endpoint gift card…");
        const minted = await api.mintGiftCard({
          sellerId: sid,
          issuer: DEMO_AGENT_A,
          visibility: "private",
        });
        setCard(minted.card);
        setShareUrl(minted.shareUrl);
        setStatus(`Gift card ${minted.card.code} minted`);
        setStep(2);
      } else if (step === 2) {
        if (!card) throw new Error("Mint a card first");
        setStatus("Agent B claiming gift card…");
        const claimed = await api.claimGiftCard(card.code, DEMO_AGENT_B);
        setCard(claimed.card);
        setStatus(`Claimed by ${shortAddr(DEMO_AGENT_B)}`);
        setStep(3);
      } else if (step === 3) {
        if (!card) throw new Error("Need a claimed card");
        setStatus("Agent B paying with gift card…");
        const result = (await api.demoPay({
          sellerId: sid,
          payer: DEMO_AGENT_B,
          gift: card.code,
        })) as PayResult & { message?: string };
        setPayB(result);
        setProductMsg(result.message || null);
        // Refresh card state
        try {
          const fresh = await api.getGiftCard(card.code);
          setCard(fresh.card);
        } catch {
          setCard((c) =>
            c
              ? {
                  ...c,
                  remainingUsdc: 0,
                  status: "redeemed",
                  redeemedAt: new Date().toISOString(),
                }
              : c,
          );
        }
        if (result.vouch?.settleTxId) {
          try {
            await api.waitForRemit(result.vouch.settleTxId, 8);
          } catch {
            /* remit may already be inline */
          }
        }
        setStatus("Gift card redeemed · MagicBlock private split complete");
        setStep(4);
      } else {
        // replay
        setStep(0);
        setCard(null);
        setShareUrl("");
        setPayA(null);
        setPayB(null);
        setProductMsg(null);
        setStatus("Replay ready");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Step failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-4 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-deep">
            Live demo
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Gift card stage
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="rounded-full border border-line bg-surface px-4 py-2 font-mono text-xs outline-none"
          >
            {sellers.length === 0 && <option value="">No sellers — auto-register</option>}
            {sellers.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.name || s.id)}
              </option>
            ))}
          </select>
          <Link to="/register" className="font-mono text-xs text-teal-deep underline">
            Register
          </Link>
        </div>
      </div>

      {/* Step rail */}
      <ol className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={`min-w-[8.5rem] rounded-2xl border px-3 py-3 text-left transition ${
                i === step
                  ? "border-ink bg-ink text-lime"
                  : i < step
                    ? "border-teal/40 bg-teal/10 text-ink"
                    : "border-line bg-surface/70 text-muted"
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                Step {i + 1}
              </p>
              <p className="mt-0.5 text-sm font-semibold">{s.title}</p>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Stage */}
        <div className="rounded-3xl border border-line bg-surface/80 p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Now
              </p>
              <h2 className="font-display text-2xl font-bold">
                {STEPS[step]?.title}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{STEPS[step]?.blurb}</p>
            </div>
            <div className="rounded-xl bg-paper-2 px-3 py-2 font-mono text-[11px] text-ink-soft">
              pool{" "}
              <span className="font-semibold text-ink">
                ${Number(pool?.balanceUsdc ?? 0).toFixed(4)}
              </span>
              {seller && (
                <span className="ml-2 text-muted">
                  · list ${Number(seller.basePriceUsdc ?? 0.05).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Agents */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <AgentChip
              label="Agent A · issuer"
              address={DEMO_AGENT_A}
              active={step <= 1}
              detail={payA?.vouch?.settleTxId ? `paid ${shortAddr(String(payA.vouch.settleTxId), 6)}` : "waiting"}
            />
            <AgentChip
              label="Agent B · redeemer"
              address={DEMO_AGENT_B}
              active={step >= 2}
              detail={
                payB?.vouch?.settleTxId
                  ? `paid ${shortAddr(String(payB.vouch.settleTxId), 6)}`
                  : card?.owner
                    ? "holds card"
                    : "waiting"
              }
            />
          </div>

          <div className="mt-8 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={card?.code || "empty"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full max-w-md"
              >
                <GiftCardVisual
                  card={card}
                  highlight={step === 1 || step === 3}
                  label={
                    step >= 3 && card?.status === "redeemed"
                      ? "Redeemed · drained"
                      : "Endpoint gift card"
                  }
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {shareUrl && step >= 2 && (
            <p className="mt-4 break-all text-center font-mono text-[11px] text-muted">
              share {shareUrl}
            </p>
          )}

          {productMsg && (
            <p className="mt-4 rounded-xl border border-teal/30 bg-teal/5 px-4 py-3 text-center text-sm text-teal-deep">
              Unlocked: “{productMsg}”
            </p>
          )}

          <p className="mt-5 font-mono text-xs text-muted">{status}</p>
          {error && (
            <p className="mt-2 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={runStep}
            className="mt-6 w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-lime transition hover:bg-teal-deep hover:text-surface disabled:opacity-50"
          >
            {primaryLabel}
          </button>

          {step === 4 && payB?.vouch?.remit && (
            <div className="mt-6 rounded-2xl border border-line bg-paper p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Remit proof
              </p>
              <pre className="mt-2 overflow-auto font-mono text-[11px] text-ink-soft">
                {JSON.stringify(payB.vouch.remit, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Live events */}
        <EventStream active={busy || step > 0} />
      </div>
    </div>
  );
}

function AgentChip({
  label,
  address,
  active,
  detail,
}: {
  label: string;
  address: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition ${
        active ? "border-teal bg-teal/5" : "border-line bg-paper/50"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-medium">{shortAddr(address, 6)}</p>
      <p className="mt-1 text-xs text-ink-soft">{detail}</p>
    </div>
  );
}
