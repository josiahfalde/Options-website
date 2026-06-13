import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Supabase client singleton.
//
// Env (Vite, client-safe): VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY live in
// .env.local (gitignored). The anon key is PUBLIC by design — Row-Level
// Security on the database is what protects data, not key secrecy.
//
// If the env vars are missing (e.g. a fork without a backend), the app still
// runs in pure local/demo mode — `supabase` is null and the store falls back
// to localStorage + seed data.
// ============================================================================

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// ---------------------------------------------------------------------------
// Resilient auth storage.
//
// PKCE stashes a one-time `code_verifier` before redirecting to Google and
// must read it back on return. Some privacy browsers (Brave on mobile,
// Private/incognito tabs) drop localStorage across that cross-site round-trip,
// so the verifier vanishes and sign-in silently bounces. We mirror ONLY the
// small verifier key into a first-party cookie (which survives where the redirect
// would otherwise clear storage) and read the cookie as a fallback. The larger
// session token stays in localStorage only, to stay well under cookie size
// limits. On non-verifier keys this behaves exactly like plain localStorage —
// so the already-working flows are unchanged.
// ---------------------------------------------------------------------------
const isVerifierKey = (k: string) => k.includes("verifier");
const cookieSecure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";

function cookieGet(key: string): string | null {
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp("(?:^|; )" + safe + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

const resilientStorage = {
  getItem(key: string): string | null {
    try {
      const v = window.localStorage.getItem(key);
      if (v != null) return v;
    } catch {
      /* localStorage may throw in some privacy modes */
    }
    return isVerifierKey(key) ? cookieGet(key) : null;
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    if (isVerifierKey(key)) {
      // 10 minutes is ample for the OAuth round-trip.
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=600; SameSite=Lax${cookieSecure}`;
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    if (isVerifierKey(key)) {
      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax${cookieSecure}`;
    }
  },
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        storage: resilientStorage,
        // We handle the OAuth (Google) return ourselves in AuthProvider so a
        // failed exchange surfaces a real error instead of silently bouncing
        // back logged-out (see handleOAuthReturn). Letting supabase-js also
        // auto-detect would double-consume the one-time code.
        detectSessionInUrl: false,
      },
    })
  : null;
