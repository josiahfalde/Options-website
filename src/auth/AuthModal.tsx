import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Cog } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { BRAND } from "../brand";

type Mode = "login" | "signup" | "reset";

// Official Google "G" mark (4-color), rendered inline since lucide-react
// doesn't ship a brand logo.
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

const COPY: Record<Mode, { title: string; cta: string; sub: string }> = {
  login: { title: "Welcome back", cta: "Sign in", sub: "Sign in to sync and save your trades." },
  signup: {
    title: `Create your ${BRAND.name} account`,
    cta: "Create account",
    sub: "Free to start. Your trades sync securely to the cloud.",
  },
  reset: {
    title: "Reset your password",
    cta: "Send reset link",
    sub: "We'll email you a link to set a new password.",
  },
};

export function AuthModal({
  open,
  onClose,
  initialMode = "login",
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
}) {
  const { user, signUp, signInWithPassword, resetPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Reset transient state whenever the modal opens or the mode changes.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setInfo(null);
    }
  }, [open, initialMode]);

  useEffect(() => {
    setError(null);
    setInfo(null);
    if (open) emailRef.current?.focus();
  }, [mode, open]);

  // A successful sign-in/sign-up that yields a session closes the modal.
  useEffect(() => {
    if (open && user) onClose();
  }, [user, open, onClose]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = COPY[mode];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === "reset") {
      const { error } = await resetPassword(email.trim());
      setBusy(false);
      if (error) setError(error);
      else setInfo("If an account exists for that email, a reset link is on its way.");
      return;
    }

    const fn = mode === "signup" ? signUp : signInWithPassword;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === "signup") {
      // With email confirmation on, no session arrives until they confirm.
      // (If confirmation is off, the user effect above closes the modal.)
      setInfo("Account created. Check your email to confirm, then sign in.");
    }
    // login success closes via the `user` effect.
  }

  async function google() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await signInWithGoogle();
    // On success the browser redirects to Google, so this component unmounts
    // and we never reach here. We only land here on failure.
    setBusy(false);
    if (error) setError(error);
  }

  // Portal to <body> so the overlay escapes the sidebar's backdrop-filter
  // ancestor — otherwise `position: fixed` resolves against the sidebar, not
  // the viewport, and the modal lands trapped on the left.
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        className="card card-pad w-full max-w-sm animate-fade-up"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-flux-500/10 ring-1 ring-flux-500/30">
              <Cog className="text-flux-400" size={20} />
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold tracking-tight text-slate-100">{copy.title}</div>
              <div className="text-xs text-slate-400">{copy.sub}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Email</span>
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          {mode !== "reset" && (
            <label className="flex flex-col gap-1">
              <span className="stat-label">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}

          {error && (
            <div className="rounded-lg border border-loss-500/25 bg-loss-500/10 px-3 py-2 text-xs text-loss-400">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-flux-500/25 bg-flux-500/10 px-3 py-2 text-xs text-flux-300">
              {info}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary mt-1">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {copy.cta}
          </button>

          {mode !== "reset" && (
            <>
              <div className="my-1 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  or
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 active:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GoogleG size={18} />
                )}
                Continue with Google
              </button>
            </>
          )}
        </form>

        <div className="mt-4 flex flex-col gap-1 text-center text-xs text-slate-400">
          {mode === "login" && (
            <>
              <button onClick={() => setMode("reset")} className="hover:text-slate-200">
                Forgot your password?
              </button>
              <div>
                New here?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="font-semibold text-flux-300 hover:text-flux-200"
                >
                  Create an account
                </button>
              </div>
            </>
          )}
          {mode === "signup" && (
            <div>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="font-semibold text-flux-300 hover:text-flux-200"
              >
                Sign in
              </button>
            </div>
          )}
          {mode === "reset" && (
            <button onClick={() => setMode("login")} className="hover:text-slate-200">
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
