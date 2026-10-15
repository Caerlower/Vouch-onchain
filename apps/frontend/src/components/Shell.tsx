import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-[15px] font-medium transition ${
    isActive ? "text-accent" : "text-ink-2 hover:text-ink"
  }`;

export default function Shell() {
  const { pathname } = useLocation();
  const isDemo = pathname.startsWith("/demo");

  return (
    <div
      className={`stage flex flex-col ${
        isDemo ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      }`}
    >
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-5 py-3 md:px-8">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
            Vouch
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <NavLink to="/how" className={linkClass}>
            How it works
          </NavLink>
          <NavLink to="/register" className={linkClass}>
            Register
          </NavLink>
          <ThemeToggle />
          <NavLink to="/demo" className="btn-primary !px-3.5 !py-2 !text-[14px]">
            Demo
          </NavLink>
        </nav>
      </header>
      <main className={`min-h-0 flex-1 ${isDemo ? "overflow-hidden" : ""}`}>
        <Outlet />
      </main>
      {!isDemo && (
        <footer className="mx-auto w-full max-w-6xl shrink-0 px-5 py-10 md:px-8">
          <p className="text-[12px] text-muted">
            Vouch · Solana x402 · MagicBlock
          </p>
        </footer>
      )}
    </div>
  );
}
