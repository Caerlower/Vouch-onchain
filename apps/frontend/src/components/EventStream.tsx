import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api, type LiveEvent } from "../lib/api";

const TYPE_COLOR: Record<string, string> = {
  hello: "text-muted",
  "seller.registered": "text-teal-deep",
  "pool.funded": "text-teal-deep",
  "payment.challenge": "text-coral",
  "payment.settled": "text-ok",
  "giftcard.minted": "text-teal",
  "giftcard.claimed": "text-teal",
  "giftcard.redeeming": "text-coral",
  "remit.queued": "text-ink-soft",
  "remit.magicblock": "text-ok",
  "giftcard.balance_updated": "text-teal-deep",
  "demo.step": "text-ink",
  error: "text-danger",
};

export default function EventStream({ active }: { active?: boolean }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    api.recentEvents()
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
      className={`flex h-full min-h-[280px] flex-col rounded-2xl border border-line bg-ink text-surface ${
        active ? "ring-2 ring-lime/60" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">
            Live rail
          </p>
          <p className="text-sm font-semibold">Behind the scenes</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${
            connected ? "text-lime" : "text-coral"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "bg-lime animate-pulse" : "bg-coral"
            }`}
          />
          {connected ? "streaming" : "reconnecting"}
        </span>
      </div>
      <div
        ref={scroller}
        className="event-rail flex-1 space-y-2 overflow-y-auto px-3 py-3 font-mono text-[11px] leading-relaxed"
      >
        <AnimatePresence initial={false}>
          {events.map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg bg-white/5 px-2.5 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={TYPE_COLOR[ev.type] || "text-white/70"}>
                  {ev.type}
                </span>
                <span className="text-white/35">
                  {new Date(ev.ts).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-0.5 text-white/85">{ev.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <p className="px-1 py-6 text-center text-white/40">
            Waiting for gift-card activity…
          </p>
        )}
      </div>
    </div>
  );
}
