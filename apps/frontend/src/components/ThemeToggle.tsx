import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "../lib/theme";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-accent transition active:scale-95"
      style={{ background: "var(--fill)" }}
    >
      {isDark ? <Sun size={17} weight="fill" /> : <Moon size={17} weight="fill" />}
    </button>
  );
}
