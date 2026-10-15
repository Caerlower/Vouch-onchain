import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { GiftCard } from "../lib/api";
import { shortAddr } from "../lib/api";
import AnimatedUsd from "./AnimatedUsd";

type Props = {
  card: GiftCard | null;
  highlight?: boolean;
  compact?: boolean;
  label?: string;
  draining?: boolean;
};

export default function GiftCardVisual({
  card,
  highlight,
  compact,
  label,
  draining,
}: Props) {
  const reduce = useReducedMotion();
  const [drainFlash, setDrainFlash] = useState(false);

  useEffect(() => {
    if (!draining) return;
    setDrainFlash(true);
    const t = window.setTimeout(() => setDrainFlash(false), 1400);
    return () => window.clearTimeout(t);
  }, [draining]);

  const shellClass = `gift-card-shell ${compact ? "gift-card-shell--compact" : ""}`;

  if (!card) {
    return (
      <div className={shellClass}>
        <div className="foil-card foil-card--empty flex items-center justify-center">
          <p className="text-[13px] text-muted">Card appears here</p>
        </div>
      </div>
    );
  }

  const drained = card.remainingUsdc <= 0 || card.status === "redeemed";
  const fillPct = Math.max(
    0,
    Math.min(100, (card.remainingUsdc / Math.max(card.faceValueUsdc, 1e-9)) * 100),
  );
  const endpoint = card.endpointUrl.replace(/^https?:\/\//, "");

  return (
    <div className={shellClass}>
      <motion.div
        layout
        initial={false}
        animate={{
          y: highlight ? -2 : 0,
          scale: drainFlash ? [1, 1.015, 1] : 1,
        }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className={`foil-card ${drained ? "foil-card--drained" : ""} ${
          drainFlash ? "foil-card--drain" : ""
        }`}
      >
        <div className="foil-card__inner">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="foil-card__label truncate">{label || "Gift card"}</p>
              <p className="foil-card__brand">Vouch</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="foil-card__badge">{card.visibility}</span>
              <div className="foil-card__chip" aria-hidden />
            </div>
          </div>

          {/* Balance */}
          <div className="foil-card__balance">
            <p className="foil-card__label">Balance</p>
            <p className="foil-card__amount">
              <AnimatedUsd
                value={card.remainingUsdc}
                digits={4}
                flash={!drained || drainFlash}
              />
            </p>
            <div className="foil-card__bar">
              <motion.div
                className="foil-card__bar-fill"
                initial={false}
                animate={{ width: `${fillPct}%` }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 160, damping: 22 }
                }
              />
            </div>
            <p className="foil-card__meta">
              Face ${card.faceValueUsdc.toFixed(4)}
              <span className="foil-card__dot">·</span>
              Tip ${card.commissionUsdc.toFixed(4)}
            </p>
          </div>

          {/* Footer — stacked so code never overlaps tip */}
          <div className="foil-card__footer">
            <div className="min-w-0">
              <p className="foil-card__label">Endpoint</p>
              <p className="foil-card__endpoint truncate" title={endpoint}>
                {endpoint}
              </p>
            </div>
            <div className="foil-card__code-block">
              <p className="foil-card__code">{card.code}</p>
              <p className="foil-card__holder">
                {card.owner
                  ? `Held by ${shortAddr(card.owner)}`
                  : `From ${shortAddr(card.issuer)}`}
              </p>
              <p className="foil-card__status">{card.status}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
