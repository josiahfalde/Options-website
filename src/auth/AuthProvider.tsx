import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// ============================================================================
// Auth: single source of truth for the current session.
//
// The store (src/data/store.tsx) consumes useAuth() to decide demo vs cloud
// mode. Login *UI* (forms/pages) is built on top of these methods in Phase 2.
// ============================================================================

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean; // true until the initial session check resolves
  configured: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const notConfigured = { error: "Auth is not configured." as string | null };
    return {
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,

      signUp: async (email, password) => {
        if (!supabase) return notConfigured;
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },

      signInWithPassword: async (email, password) => {
        if (!supabase) return notConfigured;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },

      signInWithGoogle: async () => {
        if (!supabase) return notConfigured;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin + window.location.pathname },
        });
        return { error: error?.message ?? null };
      },

      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },

      resetPassword: async (email) => {
        if (!supabase) return notConfigured;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        return { error: error?.message ?? null };
      },
    };
  }, [session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
