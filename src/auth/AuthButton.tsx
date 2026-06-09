import { LogIn, Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useAuthUI } from "./AuthUI";
import { AccountMenu } from "./AccountMenu";

// Auth entry point in the app chrome: a "Sign in" trigger when logged out, and
// the AccountMenu (email + settings + sign-out) when logged in. The modal
// itself is owned by AuthUIProvider, so this just asks it to open.
export function AuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, configured } = useAuth();
  const { openAuth } = useAuthUI();

  // No backend wired up → nothing to sign into. Stay invisible.
  if (!configured) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
        <Loader2 size={14} className="animate-spin" /> {!compact && "…"}
      </div>
    );
  }

  if (user) return <AccountMenu compact={compact} />;

  return (
    <button onClick={() => openAuth("login")} className="btn-primary w-full text-sm">
      <LogIn size={16} />
      {compact ? "Sign in" : "Sign in to save"}
    </button>
  );
}
