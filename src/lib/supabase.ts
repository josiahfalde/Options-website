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

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // needed for the OAuth (Google) redirect
      },
    })
  : null;
