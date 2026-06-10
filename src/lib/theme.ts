import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "flywheel-theme";

/** Read the persisted choice, falling back to the OS preference. */
export function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Imperatively apply a theme to <html> + the address-bar meta color. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f1f5f9" : "#080b12");
}

type ThemeCtx = { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void };

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The pre-paint script in index.html has already set the class; mirror it
  // here so React state agrees with the DOM on first render.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("light")
      ? "light"
      : "dark"
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep the DOM class authoritative to React state. The pre-paint script may
  // have set a class from OS preference before React mounted; reconcile here so
  // the <html> class, color-scheme and React state never drift apart.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Follow OS changes only while the user hasn't made an explicit choice.
  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (stored !== "light" && stored !== "dark") {
        const next: Theme = e.matches ? "light" : "dark";
        setThemeState(next);
        applyTheme(next);
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return createElement(Ctx.Provider, { value: { theme, toggleTheme, setTheme } }, children);
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Theme-aware colors for Recharts (axes/grid/cursor/tooltip), which take raw
 * color props that don't follow CSS classes. Semantic series colors (green for
 * credit, rose for loss, amber for capital) stay constant across themes.
 */
export function useChartTheme() {
  const { theme } = useTheme();
  const light = theme === "light";
  return {
    theme,
    axis: "#64748b", // slate-500 reads on both surfaces
    grid: light ? "#0f172a14" : "#ffffff10",
    cursor: light ? "#0f172a0a" : "#ffffff08",
    // Tooltip surface (used via Tailwind classes on the custom tip, but exposed
    // here for any inline use).
    tooltipBg: light ? "#ffffff" : "#141c2b",
    tooltipBorder: light ? "#e2e8f0" : "#ffffff1a",
  };
}
