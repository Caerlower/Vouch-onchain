import { motion } from "motion/react";
import type { GiftCard } from "../lib/api";
import { shortAddr } from "../lib/api";

type Props = {
  card: GiftCard | null;
  highlight?: boolean;
  compact?: boolean;
  label?: string;
};

export default function GiftCardVisual({
  card,
  highlight,
  compact,
  label,
}: Props) {
  if (!card) {
    return (
      <div
        className={`flex aspect-[1.6/1] w-full max-w-md items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 ${
          compact ? "max-w-xs" : ""
        }`}
      >
        <p className="font-mono text-xs text-muted">No gift card yet</p>
      </div>
    );
  }

  const drained = card.remainingUsdc <= 0 || card.status === "redeemed";

  return (
    <motion.div
      layout
      initial={{ rotateY: -12, opacity: 0, y: 16 }}
      animate={{
        rotateY: 0,
        opacity: 1,
        y: 0,
        scale: highlight ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`foil-card aspect-[1.6/1] w-full max-w-md rounded-2xl p-5 text-surface shadow-[0_20px_50px_-20px_rgba(15,23,42,0.55)] ${
        compact ? "max-w-xs p-4" : ""
      } ${drained ? "grayscale-[0.35] opacity-80" : ""}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime/90">
              {label || "Endpoint gift card"}
            </p>
            <p className="mt-1 font-display text-lg font-bold tracking-tight md:text-xl">
              Vouch
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-lime">
            {card.visibility}
          </span>
        </div>

        <div>
          <p className="font-mono text-[10px] text-white/55">Bound endpoint</p>
          <p className="mt-0.5 truncate font-mono text-xs text-white/90">
            {card.endpointUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] text-white/55">Remaining</p>
            <p className="font-display text-3xl font-bold tracking-tight text-lime md:text-4xl">
              ${card.remainingUsdc.toFixed(4)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-white/50">
              face ${card.faceValueUsdc.toFixed(4)} · tip $
              {card.commissionUsdc.toFixed(4)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-medium tracking-wider text-white">
              {card.code}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/50">
              {card.owner
                ? `holder ${shortAddr(card.owner)}`
                : `from ${shortAddr(card.issuer)}`}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-lime/80">
              {card.status}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
