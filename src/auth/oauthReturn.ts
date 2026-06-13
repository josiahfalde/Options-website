import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// OAuth (Google) redirect-return handling.
//
// After Google → Supabase, the browser lands back on the app at
// `…/?code=<authcode>&state=…` (PKCE) or `…/?error=…&error_description=…`.
// We process that here explicitly (instead of supabase-js's detectSessionInUrl)
// so a failed exchange shows a real, actionable error rather than a silent
// bounce back to the logged-out demo — which is exactly what privacy browsers
// (e.g. Brave on mobile, or any Private/incognito tab) can cause when they
// block the temporary `code_verifier` the PKCE exchange needs from storage.
//
// PKCE puts its params in the QUERY string, not the hash, so we never touch
// window.location.hash — that belongs to HashRouter.
//
// The work is cached as a single promise: the one-time `code` must be exchanged
// exactly once, and React StrictMode (dev) mounts AuthProvider twice. Caching
// the promise means both mounts await the same exchange and read the same
// result, instead of the first mount consuming the code and the second failing.
// ============================================================================

const OAUTH_PARAMS = ["code", "error", "error_description", "error_code", "state", "provider"];

function cleanUrl() {
  const u = new URL(window.location.href);
  for (const k of OAUTH_PARAMS) u.searchParams.delete(k);
  window.history.replaceState({}, document.title, u.pathname + u.search + u.hash);
}

function friendly(message: string): string {
  if (/verifier|code challenge|non-empty/i.test(message)) {
    return (
      "Couldn't finish Google sign-in — this browser blocked the temporary " +
      "login data the sign-in needs. If you're in a Private tab or have Brave " +
      "Shields up, switch to a normal tab or allow site data for this site, " +
      `then try again. (${message})`
    );
  }
  return `Couldn't finish Google sign-in: ${message}`;
}

let pending: Promise<string | null> | null = null;

/**
 * If the current URL is an OAuth return, finish (or report) it and resolve to a
 * user-facing error message, or null on success / when it's not an OAuth return.
 * Idempotent: safe to call from multiple mounts — the exchange runs once.
 */
export function handleOAuthReturn(sb: SupabaseClient): Promise<string | null> {
  if (pending) return pending;

  const params = new URLSearchParams(window.location.search);
  const errParam = params.get("error_description") || params.get("error");
  const code = params.get("code");
  if (!errParam && !code) return Promise.resolve(null); // not an OAuth return

  pending = (async () => {
    if (errParam) {
      cleanUrl();
      return decodeURIComponent(errParam.replace(/\+/g, " "));
    }
    let msg: string | null = null;
    try {
      const { error } = await sb.auth.exchangeCodeForSession(code!);
      if (error) msg = friendly(error.message);
    } catch (e) {
      msg = friendly(e instanceof Error ? e.message : String(e));
    }
    cleanUrl();
    return msg;
  })();

  return pending;
}
