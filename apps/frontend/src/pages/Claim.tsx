import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, DEMO_AGENT_B_FALLBACK, type GiftCard } from "../lib/api";
import GiftCardVisual from "../components/GiftCardVisual";

export default function Claim() {
  const { code = "" } = useParams();
  const [card, setCard] = useState<GiftCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [agentB, setAgentB] = useState(DEMO_AGENT_B_FALLBACK);

  useEffect(() => {
    api
      .demoAgents()
      .then((a) => {
        if (a.b) setAgentB(a.b);
      })
      .catch(() => {});
  }, []);

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
      const d = await api.claimGiftCard(code, agentB);
      setCard(d.card);
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-20 pt-12">
      <p className="text-[13px] font-medium text-accent">Gift card</p>
      <h1 className="mt-2 text-center font-display text-[28px] font-semibold tracking-tight">
        Claim your referral
      </h1>
      <p className="mt-2 max-w-xs text-center text-[15px] text-ink-2">
        Accept this card, then redeem it when you pay the API.
      </p>
      <div className="mt-8 w-full">
        <GiftCardVisual card={card} highlight />
      </div>
      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}
      {card && card.status === "minted" && !claimed && (
        <button
          type="button"
          disabled={busy}
          onClick={onClaim}
          className="btn-primary mt-8"
        >
          {busy ? "Claiming…" : "Claim as Agent B"}
        </button>
      )}
      {(claimed || card?.owner) && (
        <Link to="/demo" className="mt-8 text-[15px] font-medium text-accent">
          Continue in demo →
        </Link>
      )}
    </div>
  );
}
