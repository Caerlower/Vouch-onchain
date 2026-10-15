import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Props = {
  value: number;
  digits?: number;
  prefix?: string;
  className?: string;
  /** Flash tint when value decreases / increases */
  flash?: boolean;
};

/** Counts USD balances toward the latest value so pool/card ticks read on stage. */
export default function AnimatedUsd({
  value,
  digits = 4,
  prefix = "$",
  className = "",
  flash = true,
}: Props) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const [delta, setDelta] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;

    if (flash) setDelta(to > from ? "up" : "down");
    prev.current = to;

    if (reduce) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const dur = 720;
    if (raf.current) cancelAnimationFrame(raf.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(to);
    };
    raf.current = requestAnimationFrame(tick);

    const clear = window.setTimeout(() => setDelta(null), 900);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.clearTimeout(clear);
    };
  }, [value, reduce, flash]);

  return (
    <motion.span
      className={`inline-tabular relative ${className}`}
      animate={
        delta && flash
          ? {
              color:
                delta === "down" ? "var(--danger)" : "var(--accent-2)",
            }
          : { color: "inherit" }
      }
      transition={{ duration: 0.35 }}
    >
      {prefix}
      {display.toFixed(digits)}
      {delta && flash && (
        <motion.span
          key={`${delta}-${value}`}
          initial={{ opacity: 0, y: delta === "down" ? -4 : 4 }}
          animate={{ opacity: [0, 1, 0], y: delta === "down" ? 10 : -10 }}
          transition={{ duration: 0.85 }}
          className={`pointer-events-none absolute left-full ml-1 whitespace-nowrap font-mono text-[10px] ${
            delta === "down" ? "text-danger" : "text-ok"
          }`}
        >
          {delta === "down" ? "↓" : "↑"}
        </motion.span>
      )}
    </motion.span>
  );
}
