import { Link, NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm tracking-wide transition ${
    isActive ? "text-ink font-semibold" : "text-muted hover:text-ink"
  }`;

export default function Shell() {
  return (
    <div className="min-h-screen mesh-hero grain">
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
            Vouch
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-deep">
            MagicBlock
          </span>
        </Link>
        <nav className="flex items-center gap-5 md:gap-7">
          <NavLink to="/how" className={linkClass}>
            How
          </NavLink>
          <NavLink to="/register" className={linkClass}>
            Register
          </NavLink>
          <NavLink
            to="/demo"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-lime transition hover:bg-teal-deep hover:text-surface"
          >
            Live demo
          </NavLink>
        </nav>
      </header>
      <main className="relative z-10">
        <Outlet />
      </main>
      <footer className="relative z-10 mx-auto max-w-6xl px-5 py-10 md:px-8">
        <p className="font-mono text-xs text-muted">
          Endpoint gift cards for Solana x402 · private remits via MagicBlock PER
        </p>
      </footer>
    </div>
  );
}
