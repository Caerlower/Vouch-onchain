import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  DEMO_AGENT_B,
  type GiftCard,
} from "../lib/api";
import GiftCardVisual from "../components/GiftCardVisual";

export default function Claim() {
  const { code = "" } = useParams();
  const [card, setCard] = useState<GiftCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .getGiftCard(code)
      .then((d) => setCard(d.card))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Card not found"),
      );
  }, [code]);

  async function onClaim() {
    setBusy(true);
    setError("");
    try {
      const d = await api.claimGiftCard(code, DEMO_AGENT_B);
      setCard(d.card);
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 pb-20 pt-10 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-deep">
        Claim
      </p>
      <h1 className="mt-2 text-center font-display text-3xl font-bold tracking-tight">
        Your endpoint gift card
      </h1>
      <div className="mt-8 w-full">
        <GiftCardVisual card={card} highlight />
      </div>
      {error && (
        <p className="mt-4 text-sm text-coral">{error}</p>
      )}
      {card && card.status === "minted" && !claimed && (
        <button
          type="button"
          disabled={busy}
          onClick={onClaim}
          className="mt-8 rounded-full bg-ink px-8 py-3 text-sm font-semibold text-lime disabled:opacity-50"
        >
          Claim as Agent B
        </button>
      )}
      {(claimed || card?.owner) && (
        <Link
          to="/demo"
          className="mt-8 text-sm font-semibold text-teal-deep underline"
        >
          Open live demo to redeem →
        </Link>
      )}
    </div>
  );
}
