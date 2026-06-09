import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AuthModal } from "./AuthModal";

// ============================================================================
// One app-wide auth modal, opened from anywhere (sidebar button, demo banner,
// account-settings gate). Keeping a single <AuthModal> instance here avoids
// each trigger rendering its own copy.
// ============================================================================

type Mode = "login" | "signup" | "reset";

interface AuthUICtx {
  openAuth: (mode?: Mode) => void;
  closeAuth: () => void;
}

const Ctx = createContext<AuthUICtx | null>(null);

export function AuthUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  const openAuth = useCallback((m: Mode = "login") => {
    setMode(m);
    setOpen(true);
  }, []);
  const closeAuth = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openAuth, closeAuth }), [openAuth, closeAuth]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuthModal open={open} onClose={closeAuth} initialMode={mode} />
    </Ctx.Provider>
  );
}

export function useAuthUI(): AuthUICtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuthUI must be used within AuthUIProvider");
  return c;
}
