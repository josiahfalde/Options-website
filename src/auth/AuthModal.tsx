import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Loader2, Cog } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { BRAND } from "../brand";

type Mode = "login" | "signup" | "reset";

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
  const { user, signUp, signInWithPassword, resetPassword } = useAuth();
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

  return (
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
    </div>
  );
}
