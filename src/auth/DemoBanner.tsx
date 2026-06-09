import { Eye } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useAuthUI } from "./AuthUI";

// Persistent "you're looking at the demo" strip shown only to logged-out
// visitors (when a backend is configured). The conversion path to CLOUD mode.
export function DemoBanner() {
  const { user, loading, configured } = useAuth();
  const { openAuth } = useAuthUI();

  if (!configured || loading || user) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-torque-500/20 bg-torque-500/[0.07] px-4 py-2.5 text-sm md:px-8">
      <Eye size={16} className="shrink-0 text-torque-400" />
      <span className="text-torque-200">
        You're viewing the <span className="font-semibold">demo</span> — sample data, nothing you
        change is saved.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => openAuth("login")}
          className="text-xs font-medium text-slate-300 hover:text-slate-100"
        >
          Sign in
        </button>
        <button onClick={() => openAuth("signup")} className="btn-primary px-3 py-1.5 text-xs">
          Sign in to save
        </button>
      </div>
    </div>
  );
}
