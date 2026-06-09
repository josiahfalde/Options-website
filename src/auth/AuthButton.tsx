import { useState } from "react";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { AuthModal } from "./AuthModal";

// Minimal auth entry point: a "Sign in" trigger when logged out, and the
// signed-in email + sign-out when logged in. The polished account menu and
// settings page are JF-9 — this is the smallest surface that makes the
// signup → login → logout → login loop testable end to end.
export function AuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, configured, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // No backend wired up → nothing to sign into. Stay invisible.
  if (!configured) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
        <Loader2 size={14} className="animate-spin" /> {!compact && "…"}
      </div>
    );
  }

  if (user) {
    return (
      <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-2"}>
        {!compact && (
          <div className="truncate px-2 text-xs text-slate-400" title={user.email ?? ""}>
            Signed in as <span className="font-medium text-slate-200">{user.email}</span>
          </div>
        )}
        <button
          onClick={async () => {
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
          }}
          disabled={signingOut}
          className="btn-ghost w-full text-xs"
        >
          {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary w-full text-sm">
        <LogIn size={16} />
        {compact ? "Sign in" : "Sign in to save"}
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} initialMode="login" />
    </>
  );
}
