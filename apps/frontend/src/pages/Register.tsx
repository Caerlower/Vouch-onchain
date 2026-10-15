import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Register() {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && url.trim().length > 0;

  async function onProbe() {
    if (!url.trim()) {
      setError("Enter an x402 resource URL to probe");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const d = await api.probeSeller(url.trim());
      setProbe(d as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    if (!canSubmit) {
      setError("Name and x402 URL are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const d = (await api.registerSeller({
        name: name.trim(),
        resourceUrl: url.trim(),
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
    <div className="mx-auto max-w-lg px-5 pb-20 pt-10 md:px-8">
      <p className="text-[13px] font-medium text-accent">Seller</p>
      <h1 className="mt-2 font-display text-[34px] font-semibold tracking-tight">
        Register your endpoint
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        Check a Solana x402 URL, then fund a pool so referrals can be sponsored.
      </p>

      <label className="mt-8 block">
        <span className="text-[12px] font-medium text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your seller name"
          autoComplete="off"
          className="mt-1.5 w-full rounded-[10px] border border-line bg-elevated px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[12px] font-medium text-muted">
          x402 resource URL
        </span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 w-full rounded-[10px] border border-line bg-elevated px-3.5 py-2.5 font-mono text-[14px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={onProbe}
          className="btn-ghost disabled:opacity-40"
        >
          Probe 402
        </button>
        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={onRegister}
          className="btn-primary disabled:opacity-40"
        >
          Register + seed pool
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {probe && (
        <pre className="code-panel mt-4 max-h-64 overflow-auto">
          {JSON.stringify(probe, null, 2)}
        </pre>
      )}
      {result && (
        <div className="mt-4 space-y-3">
          <pre className="code-panel max-h-64 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
          <Link to="/demo" className="text-[15px] font-medium text-accent">
            Continue to demo →
          </Link>
        </div>
      )}
    </div>
  );
}
