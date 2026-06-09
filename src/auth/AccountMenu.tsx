import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserCircle2, Settings, LogOut, Loader2, ChevronUp } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cls } from "../lib/format";

// Signed-in account control: avatar + email that opens a small popover with a
// link to account settings and a sign-out action. Used in place of the bare
// "Sign out" button once a session exists.
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const email = user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cls(
          "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5",
          open && "bg-white/5"
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-flux-500/15 text-xs font-bold text-flux-300 ring-1 ring-flux-500/25">
          {initial}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={email}>
              {email}
            </span>
            <ChevronUp
              size={14}
              className={cls("shrink-0 text-slate-500 transition-transform", !open && "rotate-180")}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cls(
            "absolute z-30 w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-850 p-1 shadow-card",
            compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2"
          )}
        >
          <div className="flex items-center gap-2 px-2.5 py-2">
            <UserCircle2 size={16} className="shrink-0 text-slate-500" />
            <span className="min-w-0 truncate text-xs text-slate-400" title={email}>
              {email}
            </span>
          </div>
          <div className="my-1 border-t border-white/5" />
          <Link
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            <Settings size={15} className="text-slate-400" />
            Account settings
          </Link>
          <button
            role="menuitem"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              setSigningOut(false);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 size={15} className="animate-spin text-slate-400" />
            ) : (
              <LogOut size={15} className="text-slate-400" />
            )}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
