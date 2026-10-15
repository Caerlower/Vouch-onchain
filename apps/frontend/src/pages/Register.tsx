import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const DEFAULT_URL =
  import.meta.env.VITE_DEMO_SELLER_URL || "http://localhost:4101/x402/thanks";

export default function Register() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [name, setName] = useState("Demo Thanks");
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function onProbe() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const d = await api.probeSeller(url);
      setProbe(d as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setBusy(true);
    setError("");
    try {
      const d = (await api.registerSeller({
        name,
        resourceUrl: url,
        seedPoolUsdc: 5,
      })) as Record<string, unknown>;
      setResult(d);
      const seller = d.seller as { id?: string } | undefined;
      if (seller?.id) localStorage.setItem("vouch-mb:sellerId", seller.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-20 pt-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-deep">
        Seller
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">
        Register endpoint
      </h1>
      <p className="mt-3 text-ink-soft">
        Probe a native Solana x402 URL, then open a gift-card pool against it.
      </p>

      <label className="mt-8 block">
        <span className="font-mono text-xs text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-teal"
        />
      </label>
      <label className="mt-4 block">
        <span className="font-mono text-xs text-muted">x402 resource URL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-teal"
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onProbe}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Probe 402
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRegister}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-lime disabled:opacity-50"
        >
          Register + seed pool
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      )}
      {probe && (
        <pre className="mt-4 overflow-auto rounded-xl bg-ink p-4 font-mono text-[11px] text-lime">
          {JSON.stringify(probe, null, 2)}
        </pre>
      )}
      {result && (
        <div className="mt-4 space-y-3">
          <pre className="overflow-auto rounded-xl bg-ink p-4 font-mono text-[11px] text-lime">
            {JSON.stringify(result, null, 2)}
          </pre>
          <Link to="/demo" className="inline-flex text-sm font-semibold text-teal-deep underline">
            Continue to live demo →
          </Link>
        </div>
      )}
    </div>
  );
}
