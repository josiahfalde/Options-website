import { useState } from "react";
import { LogIn, Download, Loader2, ShieldAlert } from "lucide-react";
import { Card, SectionTitle, Pill } from "../components/ui";
import { useAuth } from "../auth/AuthProvider";
import { useAuthUI } from "../auth/AuthUI";
import { useStore } from "../data/store";
import { BRAND } from "../brand";

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const { openAuth } = useAuthUI();
  const { dataset, clearAll } = useStore();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // --- route protection: logged-out users get a gate, not the settings -------
  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-slate-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <Card className="mx-auto mt-8 max-w-md text-center">
        <div className="grid place-items-center py-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-flux-500/10 ring-1 ring-flux-500/25">
            <LogIn className="text-flux-400" size={22} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-100">Sign in required</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            Account settings are only available once you're signed in to {BRAND.name}.
          </p>
          <button onClick={() => openAuth("login")} className="btn-primary mt-5">
            <LogIn size={16} />
            Sign in
          </button>
        </div>
      </Card>
    );
  }

  // --- export: download the user's dataset as JSON ---------------------------
  function exportData() {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flywheel-export-${dataset.exportedAt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- danger zone: wipe all of this user's trades ---------------------------
  async function wipeData() {
    setBusy(true);
    clearAll();
    setBusy(false);
    setConfirm("");
  }

  const tradeCount = dataset.trades.length;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle title="Account settings" sub="Manage your sign-in, your data, and this account." />

      {/* Profile */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="stat-label">Signed in as</div>
            <div className="mt-1 text-sm font-medium text-slate-100">{user.email}</div>
          </div>
          <Pill tone="green">Cloud sync on</Pill>
        </div>
        <div className="mt-4 border-t border-white/5 pt-4">
          <button onClick={() => signOut()} className="btn-ghost text-sm">
            Sign out
          </button>
        </div>
      </Card>

      {/* Your data */}
      <Card className="mb-5">
        <SectionTitle
          title="Your data"
          sub={`${tradeCount} trade${tradeCount === 1 ? "" : "s"} stored in your account.`}
        />
        <button onClick={exportData} className="btn-ghost text-sm">
          <Download size={16} />
          Export my data (JSON)
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Downloads everything {BRAND.name} holds for you — trades, prices, and settings — as a
          single JSON file.
        </p>
      </Card>

      {/* Danger zone */}
      <Card className="border-loss-500/25">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-loss-400" />
          <h3 className="text-base font-bold text-slate-100">Danger zone</h3>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Permanently delete all {tradeCount} trade{tradeCount === 1 ? "" : "s"} and reset your
          stored settings. This cannot be undone.
        </p>
        <label className="mt-3 block text-xs text-slate-400">
          Type <span className="font-mono font-semibold text-loss-400">DELETE</span> to confirm
          <input
            className="input mt-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
          />
        </label>
        <button
          onClick={wipeData}
          disabled={confirm !== "DELETE" || busy || tradeCount === 0}
          className="btn mt-3 bg-loss-500 text-white hover:bg-loss-400 disabled:opacity-40"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Delete all my data
        </button>
        <p className="mt-3 text-xs text-slate-500">
          Note: this clears your data but keeps your login. Fully deleting the account itself
          requires a server-side step that ships with hosting (JF-11) — until then, email support
          to have the login removed.
        </p>
      </Card>
    </div>
  );
}
