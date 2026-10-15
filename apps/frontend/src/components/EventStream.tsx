import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api, type LiveEvent } from "../lib/api";

const TYPE_COLOR: Record<string, string> = {
  hello: "text-muted",
  "seller.registered": "text-ink-2",
  "pool.funded": "text-ink-2",
  "payment.challenge": "text-accent",
  "payment.settled": "text-ok",
  "giftcard.minted": "text-accent",
  "giftcard.claimed": "text-accent",
  "giftcard.redeeming": "text-accent",
  "remit.queued": "text-muted",
  "remit.magicblock": "text-ok",
  "giftcard.balance_updated": "text-ink-2",
  "chain.attested": "text-ok",
  "demo.step": "text-ink",
  error: "text-danger",
};

function explorerFrom(ev: LiveEvent): string | null {
  const d = ev.data || {};
  if (typeof d.explorerUrl === "string") return d.explorerUrl;
  if (typeof d.rebateExplorerUrl === "string") return d.rebateExplorerUrl;
  if (typeof d.commissionExplorerUrl === "string")
    return d.commissionExplorerUrl;
  const sig =
    (typeof d.signature === "string" && d.signature) ||
    (typeof d.rebateTxId === "string" && d.rebateTxId) ||
    (typeof d.commissionTxId === "string" && d.commissionTxId) ||
    null;
  if (sig && sig.length > 40 && !sig.startsWith("sim_") && !sig.startsWith("demo_")) {
    return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
  }
  return null;
}

export default function EventStream({ active }: { active?: boolean }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    api
      .recentEvents()
      .then((d) => {
        if (!cancelled) setEvents(d.events || []);
      })
      .catch(() => {});

    try {
      es = new EventSource(api.eventsUrl());
      es.addEventListener("vouch", (msg) => {
        try {
          const ev = JSON.parse((msg as MessageEvent).data) as LiveEvent;
          setEvents((prev) => {
            if (prev.some((p) => p.id === ev.id)) return prev;
            return [...prev.slice(-80), ev];
          });
        } catch {
          /* ignore */
        }
      });
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
    } catch {
      setConnected(false);
    }

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [events.length]);

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[1.125rem] border border-line bg-elevated ${
        active ? "border-line-strong" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-[15px] font-semibold text-ink">Activity</p>
          <p className="text-[12px] text-muted">Live · scrolls here</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${
            connected ? "text-ok" : "text-danger"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "bg-ok" : "bg-danger"
            }`}
          />
          {connected ? "live" : "offline"}
        </span>
      </div>
      <div
        ref={scroller}
        className="event-rail min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3 font-mono text-[11px] leading-relaxed"
      >
        <AnimatePresence initial={false}>
          {events.map((ev) => {
            const href = explorerFrom(ev);
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[10px] px-2.5 py-2 hover:bg-bg"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={TYPE_COLOR[ev.type] || "text-ink-2"}>
                    {ev.type}
                  </span>
                  <span className="shrink-0 text-muted">
                    {new Date(ev.ts).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-0.5 text-ink-2">{ev.message}</p>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-accent hover:underline"
                  >
                    View on Explorer →
                  </a>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {events.length === 0 && (
          <p className="px-1 py-10 text-center text-muted">No events yet</p>
        )}
      </div>
    </div>
  );
}
