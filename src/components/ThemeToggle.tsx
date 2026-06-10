import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";
import { cls } from "../lib/format";

// Accessible dark/light switch. `compact` renders an icon-only button for the
// mobile header; the default renders a labelled control for the sidebar footer.
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        title={label}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/60"
      >
        {isDark ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cls(
        "flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium",
        "text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/60"
      )}
    >
      {isDark ? <Moon size={15} /> : <Sun size={15} />}
      <span>{isDark ? "Dark" : "Light"} mode</span>
      <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">
        {isDark ? "Light" : "Dark"} →
      </span>
    </button>
  );
}
