const API = import.meta.env.VITE_VOUCH_API || "/api";

export class ApiError extends Error {
  data: unknown;
  status: number;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function req<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      String(data.message || data.error || res.statusText),
      res.status,
      data,
    );
  }
  return data as T;
}

export type GiftCard = {
  id: string;
  code: string;
  sellerId: string;
  endpointUrl: string;
  issuer: string;
  owner: string | null;
  faceValueUsdc: number;
  remainingUsdc: number;
  commissionUsdc: number;
  status: string;
  mintedAt: string;
  claimedAt?: string;
  redeemedAt?: string;
  settleTxId?: string;
  magicblockTxId?: string | null;
  visibility: "private" | "public";
};

export type LiveEvent = {
  id: string;
  type: string;
  ts: string;
  message: string;
  data?: Record<string, unknown>;
};

export const api = {
  health: () =>
    req<{
      demoMode?: boolean;
      cluster?: string;
      solana?: {
        onchain?: boolean;
        operator?: string | null;
        lastError?: string | null;
      };
      magicblock?: { enabled?: boolean };
    }>("/health"),
  sellers: () => req<{ sellers: Array<Record<string, unknown>> }>("/sellers"),
  probeSeller: (resourceUrl: string) =>
    req("/sellers/probe", {
      method: "POST",
      body: JSON.stringify({ resourceUrl }),
    }),
  registerSeller: (body: Record<string, unknown>) =>
    req("/sellers", { method: "POST", body: JSON.stringify(body) }),
  pool: (sellerId: string) => req(`/pool/${sellerId}`),
  fundPool: (sellerId: string, amountUsdc: number, from?: string) =>
    req<{
      ok?: boolean;
      pool?: Record<string, unknown>;
      chain?: {
        ok?: boolean;
        signature?: string | null;
        explorerUrl?: string | null;
      };
      explorerUrl?: string | null;
    }>(`/pool/${sellerId}/fund`, {
      method: "POST",
      body: JSON.stringify({ amountUsdc, from }),
    }),
  demoAgents: () =>
    req<{ a: string; b: string; roleA?: string; roleB?: string }>(
      "/demo/agents",
    ),
  quote: (sellerId: string, gift?: string | null) => {
    const q = new URLSearchParams({ sellerId });
    if (gift) q.set("gift", gift);
    return req(`/quote?${q}`);
  },
  mintGiftCard: (body: { sellerId: string; issuer: string; visibility?: string }) =>
    req<{ card: GiftCard; shareUrl: string }>("/gift-cards/mint", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  claimGiftCard: (code: string, owner: string) =>
    req<{ card: GiftCard }>("/gift-cards/claim", {
      method: "POST",
      body: JSON.stringify({ code, owner }),
    }),
  getGiftCard: (code: string) => req<{ card: GiftCard }>(`/gift-cards/${code}`),
  listGiftCards: (q?: { sellerId?: string; owner?: string; issuer?: string }) => {
    const params = new URLSearchParams();
    if (q?.sellerId) params.set("sellerId", q.sellerId);
    if (q?.owner) params.set("owner", q.owner);
    if (q?.issuer) params.set("issuer", q.issuer);
    const s = params.toString();
    return req<{ cards: GiftCard[] }>(`/gift-cards${s ? `?${s}` : ""}`);
  },
  demoPay: (body: { sellerId: string; payer: string; gift?: string | null }) =>
    req("/demo/pay", { method: "POST", body: JSON.stringify(body) }),
  getRemit: (settleTxId: string) => req(`/remit/${settleTxId}`),
  waitForRemit: async (settleTxId: string, attempts = 12) => {
    for (let i = 0; i < attempts; i++) {
      try {
        return await req(`/remit/${settleTxId}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Remit not ready");
  },
  recentEvents: () => req<{ events: LiveEvent[] }>("/events/recent"),
  eventsUrl: () => {
    const base = API.startsWith("http") ? API : `${window.location.origin}${API}`;
    return `${base}/events`;
  },
  link: (code: string) => req(`/links/${code}`),
  stats: (address: string) => req(`/stats/${address}`),
};

export function shortAddr(s: string | null | undefined, n = 4): string {
  if (!s || s.length < 10) return s || "—";
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

/** Fallback only — prefer /demo/agents from the backend (real Devnet keypairs). */
export const DEMO_AGENT_A_FALLBACK =
  "AgntA111111111111111111111111111111111111111";
export const DEMO_AGENT_B_FALLBACK =
  "AgntB222222222222222222222222222222222222222";
