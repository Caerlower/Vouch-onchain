import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  api,
  DEMO_AGENT_A_FALLBACK,
  DEMO_AGENT_B_FALLBACK,
  shortAddr,
  type GiftCard,
} from "../lib/api";
import GiftCardVisual from "../components/GiftCardVisual";
import EventStream from "../components/EventStream";
import AnimatedUsd from "../components/AnimatedUsd";

type TxnRow = {
  label: string;
  kind: string;
  signature?: string | null;
  explorerUrl?: string | null;
  detail?: string;
};

const STEPS = [
  {
    id: "sponsor",
    title: "Fund the pool",
    role: "Seller",
    blurb: "Deposit USDC so referrals can be sponsored — without cutting list price.",
    happening: "Registering the endpoint and seeding the gift-card pool.",
  },
  {
    id: "referrer-pays",
    title: "Referrer pays",
    role: "Agent A",
    blurb: "Agent A pays the API at full price. That unlocks minting a gift card.",
    happening: "Settling the payment. The seller receives full list.",
  },
  {
    id: "mint-referral",
    title: "Mint a card",
    role: "Agent A",
    blurb: "Create an endpoint-bound gift from the seller’s pool.",
    happening: "Minting rebate for B and a tip for A into one shareable card.",
  },
  {
    id: "pass-card",
    title: "Share & claim",
    role: "A → B",
    blurb: "Copy the link as Agent A, then claim it as Agent B. That’s the referral.",
    happening: "Copy the share link, then claim as Agent B.",
  },
  {
    id: "referred-pays",
    title: "Redeem",
    role: "Agent B",
    blurb: "B pays full list with the card. The pool privately pays rebate and tip.",
    happening: "Settling B’s payment and remitting via MagicBlock.",
  },
  {
    id: "settled",
    title: "Done",
    role: "Summary",
    blurb: "Seller kept full list. A earned a tip. B received a sponsored rebate.",
    happening: "Complete. Replay anytime or review the proof below.",
  },
];

type PayResult = {
  message?: string;
  vouch?: {
    settleTxId?: string;
    explorerUrl?: string | null;
    chain?: {
      ok?: boolean;
      signature?: string | null;
      explorerUrl?: string | null;
      mode?: string;
      note?: string;
    };
    remit?: {
      ok?: boolean;
      rebateUsdc?: number;
      commissionUsdc?: number;
      buyer?: string;
      issuer?: string;
      magicblock?: Record<string, unknown>;
      pool?: Record<string, unknown>;
      card?: GiftCard;
    };
  };
};

type HealthInfo = {
  demoMode?: boolean;
  cluster?: string;
  solana?: {
    onchain?: boolean;
    operator?: string | null;
    lastError?: string | null;
    faucetUrl?: string;
    explorerAddress?: string | null;
  };
  magicblock?: {
    enabled?: boolean;
    remitMint?: string;
    cluster?: string;
  };
  agents?: { a?: string; b?: string };
};

export default function Demo() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draining, setDraining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [sellers, setSellers] = useState<Array<Record<string, unknown>>>([]);
  const [sellerId, setSellerId] = useState("");
  const [pool, setPool] = useState<Record<string, unknown> | null>(null);
  const [card, setCard] = useState<GiftCard | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [payA, setPayA] = useState<PayResult | null>(null);
  const [payB, setPayB] = useState<PayResult | null>(null);
  const [productMsg, setProductMsg] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Ready — fund the pool to begin.",
  );
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [lastExplorer, setLastExplorer] = useState<string | null>(null);
  const [agentA, setAgentA] = useState(DEMO_AGENT_A_FALLBACK);
  const [agentB, setAgentB] = useState(DEMO_AGENT_B_FALLBACK);
  const [ledger, setLedger] = useState<TxnRow[]>([]);

  function pushTxn(row: TxnRow) {
    if (!row.signature && !row.explorerUrl) return;
    setLedger((prev) => {
      if (row.signature && prev.some((p) => p.signature === row.signature)) {
        return prev;
      }
      return [...prev, row];
    });
    if (row.explorerUrl) setLastExplorer(row.explorerUrl);
  }

  const refreshPool = useCallback(async (sid: string) => {
    try {
      const p = await api.pool(sid);
      setPool(p as Record<string, unknown>);
    } catch {
      setPool(null);
    }
  }, []);

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
    api
      .health()
      .then((h) => {
        const info = h as HealthInfo;
        setHealth(info);
        if (info.agents?.a) setAgentA(info.agents.a);
        if (info.agents?.b) setAgentB(info.agents.b);
      })
      .catch(() => setHealth(null));
    api
      .demoAgents()
      .then((a) => {
        if (a.a) setAgentA(a.a);
        if (a.b) setAgentB(a.b);
      })
      .catch(() => {});
  }, [refreshSellers]);

  useEffect(() => {
    if (!sellerId) return;
    refreshPool(sellerId);
  }, [sellerId, card, payB, refreshPool]);

  const seller = useMemo(
    () => sellers.find((s) => s.id === sellerId),
    [sellers, sellerId],
  );

  const listPrice = Number(seller?.basePriceUsdc ?? 0.05);
  const poolBal = Number(pool?.balanceUsdc ?? 0);

  const primaryLabel = useMemo(() => {
    if (busy) return "Working…";
    return [
      "1 · Fund the pool",
      "2 · Pay as Agent A",
      "3 · Mint gift card",
      shared ? "4 · Claim as Agent B" : "4 · Share the card",
      "5 · Pay as Agent B",
      "6 · Replay",
    ][step];
  }, [busy, step, shared]);

  const happeningCopy = busy
    ? STEPS[Math.min(step, STEPS.length - 1)]?.happening
    : STEPS[step]?.happening;

  const cardHolder: "none" | "a" | "b" = !card
    ? "none"
    : card.owner || step >= 4
      ? "b"
      : "a";

  async function ensureSeller(): Promise<string> {
    if (sellerId) {
      const existing = sellers.find((s) => s.id === sellerId);
      if (existing) return sellerId;
    }
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

  function copyShare() {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setShared(true);
    setStatus("Link copied — claim it as Agent B");
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function runStep() {
    setBusy(true);
    setError("");
    try {
      const sid = await ensureSeller();

      if (step === 0) {
        setLedger([]);
        setStatus("Funding the gift-card pool…");
        let p = (await api.pool(sid).catch(() => null)) as Record<
          string,
          unknown
        > | null;
        const fundAmt = !p || Number(p.balanceUsdc ?? 0) < 0.05 ? 5 : 0.05;
        const funded = await api.fundPool(sid, fundAmt, "seller-sponsor");
        p = (funded.pool || (await api.pool(sid))) as Record<string, unknown>;
        setPool(p);
        pushTxn({
          label: "Pool fund",
          kind: "pool.fund",
          signature: funded.chain?.signature,
          explorerUrl: funded.explorerUrl || funded.chain?.explorerUrl,
          detail: `+$${fundAmt.toFixed(2)} sponsorship`,
        });
        setStatus(`Pool funded · $${Number(p.balanceUsdc).toFixed(2)} USDC`);
        setStep(1);
      } else if (step === 1) {
        setStatus("Agent A is paying…");
        const result = (await api.demoPay({
          sellerId: sid,
          payer: agentA,
        })) as PayResult & { message?: string };
        setPayA(result);
        setProductMsg(result.message || null);
        pushTxn({
          label: "Settle · Agent A",
          kind: "payment.settled",
          signature: result.vouch?.settleTxId || result.vouch?.chain?.signature,
          explorerUrl:
            result.vouch?.explorerUrl || result.vouch?.chain?.explorerUrl,
          detail: `Full list $${listPrice.toFixed(2)}`,
        });
        setStatus(
          result.vouch?.chain?.ok
            ? "Payment settled on Solana · ready to mint"
            : "Payment settled · ready to mint",
        );
        setStep(2);
      } else if (step === 2) {
        setStatus("Minting gift card…");
        const minted = await api.mintGiftCard({
          sellerId: sid,
          issuer: agentA,
          visibility: "private",
        });
        setCard(minted.card);
        setShareUrl(minted.shareUrl);
        setShared(false);
        const mintMeta = minted as {
          explorerUrl?: string;
          chain?: { signature?: string; explorerUrl?: string };
        };
        pushTxn({
          label: "Mint gift card",
          kind: "giftcard.mint",
          signature: mintMeta.chain?.signature,
          explorerUrl: mintMeta.explorerUrl || mintMeta.chain?.explorerUrl,
          detail: minted.card.code,
        });
        await refreshPool(sid);
        setStatus(`Minted ${minted.card.code}`);
        setStep(3);
      } else if (step === 3) {
        if (!card) throw new Error("Mint a card first");
        if (!shared) {
          copyShare();
          setBusy(false);
          return;
        }
        setStatus("Agent B is claiming…");
        const claimed = await api.claimGiftCard(card.code, agentB);
        setCard(claimed.card);
        setStatus("Claimed · referral attributed to A");
        setStep(4);
      } else if (step === 4) {
        if (!card) throw new Error("Need a claimed card");
        setStatus("Redeeming on Solana + MagicBlock private remit…");
        setDraining(true);
        // MagicBlock remits take a few seconds — keep status updating
        let tick = 0;
        const redeemStatus = window.setInterval(() => {
          tick += 1;
          setStatus(
            tick % 2 === 0
              ? "Private rebate + tip on MagicBlock…"
              : "Confirming remits on Devnet…",
          );
        }, 3500);
        let result: PayResult & { message?: string };
        try {
          result = (await api.demoPay({
            sellerId: sid,
            payer: agentB,
            gift: card.code,
          })) as PayResult & { message?: string };
        } finally {
          window.clearInterval(redeemStatus);
        }
        setPayB(result);
        setProductMsg(result.message || null);
        const mb = result.vouch?.remit?.magicblock as
          | {
              rebateTxId?: string | null;
              commissionTxId?: string | null;
              rebateExplorerUrl?: string | null;
              commissionExplorerUrl?: string | null;
              mode?: string;
            }
          | undefined;
        pushTxn({
          label: "Settle · Agent B",
          kind: "payment.settled",
          signature: result.vouch?.settleTxId || result.vouch?.chain?.signature,
          explorerUrl:
            result.vouch?.explorerUrl || result.vouch?.chain?.explorerUrl,
          detail: "Redeem with gift card",
        });
        pushTxn({
          label: "MagicBlock · rebate → B",
          kind: "remit.magicblock",
          signature: mb?.rebateTxId,
          explorerUrl: mb?.rebateExplorerUrl,
          detail: mb?.mode || "private",
        });
        pushTxn({
          label: "MagicBlock · tip → A",
          kind: "remit.magicblock",
          signature: mb?.commissionTxId,
          explorerUrl: mb?.commissionExplorerUrl,
          detail: mb?.mode || "private",
        });
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
        // Remit is already inline from /demo/pay — don't poll and hang the UI.
        if (result.vouch?.settleTxId && !result.vouch?.remit) {
          try {
            await api.waitForRemit(result.vouch.settleTxId, 4);
          } catch {
            /* remits may still be in the activity rail */
          }
        }
        void refreshPool(sid);
        setStatus("Referral complete");
        setStep(5);
        setBusy(false);
        window.setTimeout(() => setDraining(false), 1200);
        return;
      } else {
        setStep(0);
        setCard(null);
        setShareUrl("");
        setShared(false);
        setCopied(false);
        setPayA(null);
        setPayB(null);
        setProductMsg(null);
        setDraining(false);
        setLedger([]);
        setStatus("Ready — fund the pool to begin.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Step failed");
      setDraining(false);
    } finally {
      setBusy(false);
    }
  }

  const remit = payB?.vouch?.remit;
  const chainLive = Boolean(
    health?.solana?.onchain && !health?.solana?.lastError,
  );
  const needsSol = Boolean(health?.solana?.lastError);
  const mbLive = Boolean(health?.magicblock?.enabled);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-5 pt-2 pb-3 md:px-8">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-accent">Demo</p>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                chainLive
                  ? "bg-ok/15 text-ok"
                  : needsSol
                    ? "bg-danger/10 text-danger"
                    : "bg-fill text-muted"
              }`}
            >
              {chainLive
                ? `Solana ${health?.cluster || "devnet"} · live`
                : needsSol
                  ? "Solana · needs SOL"
                  : "Solana · connecting…"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                mbLive ? "bg-accent-soft text-accent" : "bg-fill text-muted"
              }`}
            >
              {mbLive ? "MagicBlock · private PER" : "MagicBlock · off"}
            </span>
            {needsSol && health?.solana?.faucetUrl && (
              <a
                href={health.solana.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-accent"
              >
                Fund operator →
              </a>
            )}
          </div>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight text-ink md:text-[28px]">
            Walk through a referral
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="rounded-[10px] border border-line bg-elevated px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
          >
            {sellers.length === 0 && (
              <option value="">Auto-register seller</option>
            )}
            {sellers.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.name || s.id)}
              </option>
            ))}
          </select>
          <Link to="/register" className="text-xs font-medium text-accent">
            Register
          </Link>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i <= step && setStep(i)}
            className={`shrink-0 rounded-[10px] px-3 py-1.5 text-left text-[13px] transition ${
              i === step
                ? "bg-accent text-white"
                : i < step
                  ? "bg-accent-soft text-accent"
                  : "bg-elevated text-muted"
            }`}
          >
            <span className="font-medium">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel flex min-h-0 flex-col overflow-hidden p-4 md:p-5">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted">
                  {STEPS[step]?.role}
                </p>
                <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight md:text-2xl">
                  {STEPS[step]?.title}
                </h2>
                <p className="mt-1.5 max-w-md text-sm text-ink-2">
                  {STEPS[step]?.blurb}
                </p>
              </div>
              <div className="rounded-[10px] bg-bg px-3 py-2 font-mono text-xs text-ink-2">
                pool{" "}
                <span className="font-semibold text-ink">
                  <AnimatedUsd value={poolBal} digits={4} />
                </span>
                <span className="text-muted"> · ${listPrice.toFixed(2)}</span>
              </div>
            </div>

            <div
              className={`mt-3 rounded-[10px] px-3.5 py-2.5 text-sm ${
                busy ? "bg-accent text-white" : "bg-bg text-ink-2"
              }`}
            >
              <span className="text-xs font-medium opacity-60">
                {busy ? "Happening" : "Next"}
              </span>
              <p className="mt-0.5">{happeningCopy}</p>
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <AgentChip
                label="A · referrer"
                address={agentA}
                holding={cardHolder === "a"}
                active={cardHolder === "a" || (step >= 1 && step <= 2)}
              />
              <AgentChip
                label="B · referred"
                address={agentB}
                holding={cardHolder === "b"}
                active={cardHolder === "b" || step >= 4}
              />
            </div>

            <div className="mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={card?.code || "empty"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <GiftCardVisual
                    card={card}
                    compact
                    highlight={step === 2 || step === 4 || draining}
                    draining={draining}
                    label={
                      card?.status === "redeemed"
                        ? "Redeemed"
                        : card?.owner
                          ? "Claimed referral"
                          : card
                            ? "From seller pool"
                            : undefined
                    }
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {step === 3 && shareUrl && (
              <div className="mt-4 rounded-[12px] border border-line bg-bg p-3.5">
                <p className="text-[12px] font-medium text-muted">Share link</p>
                <p className="mt-1 text-[14px] text-ink-2">
                  {shared
                    ? "Copied. Now claim as Agent B."
                    : "Copy this link as if Agent A is sending it to B."}
                </p>
                <p className="mt-2 break-all font-mono text-[11px] text-accent">
                  {shareUrl}
                </p>
                <button
                  type="button"
                  onClick={copyShare}
                  className="btn-ghost mt-3 !px-3 !py-1.5 text-xs"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            )}

            {productMsg && step >= 1 && (
              <p className="mt-3 rounded-[10px] bg-accent-soft px-3 py-2 text-center text-sm text-accent">
                Unlocked: “{productMsg}”
              </p>
            )}

            {step === 5 && (
              <ProofPanel
                remit={remit}
                listPrice={listPrice}
                settleTxId={payB?.vouch?.settleTxId}
                explorerUrl={
                  payB?.vouch?.explorerUrl || lastExplorer || undefined
                }
                ledger={ledger}
                mbEnabled={mbLive}
              />
            )}
          </div>

          <div className="mt-3 shrink-0 border-t border-line pt-3">
            <p className="font-mono text-xs text-muted">{status}</p>
            {lastExplorer && (
              <a
                href={lastExplorer}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[12px] font-medium text-accent"
              >
                Latest Solana tx →
              </a>
            )}
            {error && (
              <p className="mt-2 rounded-[10px] bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={runStep}
              className="btn-primary mt-3 w-full"
            >
              {primaryLabel}
            </button>
          </div>
        </div>

        <div className="min-h-0 h-full">
          <EventStream active={busy || step > 0} />
        </div>
      </div>
    </div>
  );
}

function ProofPanel({
  remit,
  listPrice,
  settleTxId,
  explorerUrl,
  ledger,
  mbEnabled,
}: {
  remit?: NonNullable<PayResult["vouch"]>["remit"];
  listPrice: number;
  settleTxId?: string;
  explorerUrl?: string;
  ledger: TxnRow[];
  mbEnabled?: boolean;
}) {
  const rebate = Number(remit?.rebateUsdc ?? 0);
  const commission = Number(remit?.commissionUsdc ?? 0);
  const mb = remit?.magicblock as
    | {
        mode?: string;
        visibility?: string;
        rebateTxId?: string | null;
        commissionTxId?: string | null;
        rebateExplorerUrl?: string | null;
        commissionExplorerUrl?: string | null;
        note?: string;
      }
    | undefined;
  const privateLive = mb?.mode === "magicblock-private";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-3"
    >
      <div className="rounded-[12px] bg-ok/10 p-4">
        <p className="text-[12px] font-medium text-ok">Referral complete</p>
        <p className="mt-1 font-display text-[17px] font-semibold tracking-tight">
          Seller received ${listPrice.toFixed(2)} at full list price.
        </p>
        <p className="mt-1 text-[14px] text-ink-2">
          {privateLive
            ? "Rebate and tip settled privately through MagicBlock PER — real Devnet signatures below."
            : mbEnabled
              ? "MagicBlock remit attempted; see ledger for signatures."
              : "Settles attested on Solana Devnet."}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { l: "Seller", v: `$${listPrice.toFixed(2)}`, h: "full list" },
          { l: "Rebate → B", v: `$${rebate.toFixed(4)}`, h: "private" },
          { l: "Tip → A", v: `$${commission.toFixed(4)}`, h: "private" },
        ].map((x) => (
          <div key={x.l} className="rounded-[10px] border border-line p-3">
            <p className="text-[11px] text-muted">{x.l}</p>
            <p className="mt-0.5 font-display text-xl font-semibold">{x.v}</p>
            <p className="text-[10px] text-muted">{x.h}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[12px] border border-line p-3.5">
        <p className="text-[12px] font-semibold text-ink">On-chain ledger</p>
        <p className="mt-0.5 text-[11px] text-muted">
          Every hop from this run — open any signature on Explorer
        </p>
        <ul className="mt-3 space-y-2">
          {ledger.length === 0 && (
            <li className="text-[12px] text-muted">No signatures captured.</li>
          )}
          {ledger.map((row) => (
            <li
              key={`${row.kind}-${row.signature || row.label}`}
              className="flex items-start justify-between gap-3 border-t border-line pt-2 first:border-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{row.label}</p>
                <p className="font-mono text-[10px] text-muted">
                  {row.signature ? shortAddr(row.signature, 8) : "—"}
                  {row.detail ? ` · ${row.detail}` : ""}
                </p>
              </div>
              {row.explorerUrl ? (
                <a
                  href={row.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[12px] font-medium text-accent"
                >
                  Explorer →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        {(mb?.rebateExplorerUrl || mb?.commissionExplorerUrl || explorerUrl) && (
          <div className="mt-3 space-y-1 border-t border-line pt-3 font-mono text-[11px] text-ink-2">
            <p>
              mode {String(mb?.mode || "—")} · visibility{" "}
              {String(mb?.visibility || "private")}
            </p>
            {settleTxId && (
              <p className="truncate">settle {shortAddr(settleTxId, 10)}</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AgentChip({
  label,
  address,
  active,
  holding,
}: {
  label: string;
  address: string;
  active: boolean;
  holding?: boolean;
}) {
  return (
    <div
      className={`min-w-[8rem] rounded-lg border px-3 py-2 ${
        holding
          ? "border-accent-2 bg-accent-2-soft"
          : active
            ? "border-line bg-elevated"
            : "border-transparent bg-bg text-muted"
      }`}
    >
      <p className="text-[11px] font-medium opacity-70">{label}</p>
      <p className="font-mono text-xs font-medium text-ink">
        {shortAddr(address, 5)}
      </p>
    </div>
  );
}
