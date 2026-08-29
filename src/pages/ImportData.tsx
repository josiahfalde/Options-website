import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Plus,
  Download,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  PencilLine,
  FolderOpen,
  CopyMinus,
} from "lucide-react";
import { findDuplicateTradeIds, useStore } from "../data/store";
import { subscribePendingImport } from "../lib/pendingImport";
import { parseWorkbook, parseFidelityCsv, parseTastytradeCsv, isTastytradeCsv } from "../data/importXlsx";
import { Card, Pill, SectionTitle } from "../components/ui";
import { todayISO, cls, usd0 } from "../lib/format";
import type { Trade, TradeAction } from "../types";

export default function ImportData() {
  const {
    dataset,
    replaceDataset,
    removeDuplicates,
    addTrade,
    setCapitalBase,
    setPrice,
    setSpy,
    resetToSeed,
    clearAll,
  } = useStore();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ref, not state: handleFile can fire again before React re-renders, and a
  // second import racing the first is exactly how trades get double-inserted.
  const busyRef = useRef(false);

  const dupCount = useMemo(() => findDuplicateTradeIds(dataset.trades).length, [dataset.trades]);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  };

  async function handleFile(file: File) {
    if (busyRef.current) return;
    busyRef.current = true;
    setImporting(true);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const ds = await parseWorkbook(file);
        if (!ds.trades.length) return flash(false, "No Wheel sheets found in that workbook.");
        await replaceDataset(ds);
        flash(true, `Imported ${ds.trades.length} trades across ${Object.keys(ds.lastPrices).length} tickers.`);
      } else if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const tasty = isTastytradeCsv(text);
        const { trades, suggestedCapitalBase } = tasty
          ? parseTastytradeCsv(text, file.name)
          : parseFidelityCsv(text);
        if (!trades.length) return flash(false, "Couldn't parse option trades from that CSV.");
        // The CSV has no cash balance; if no capital base is set yet, seed it
        // with the estimated peak collateral so yields aren't divided by ~$0.
        const setBase = !dataset.capitalBase && suggestedCapitalBase > 0;
        const res = await replaceDataset(
          {
            ...dataset,
            trades,
            capitalBase: dataset.capitalBase || suggestedCapitalBase,
          },
          { merge: true }
        );
        const broker = tasty ? "tastytrade" : "Fidelity";
        const baseHint = tasty ? "≈ total defined-risk" : "≈ peak put collateral";
        const parts = [];
        if (res.inserted) parts.push(`added ${res.inserted} new trade${res.inserted === 1 ? "" : "s"}`);
        if (res.updated) parts.push(`updated ${res.updated} status${res.updated === 1 ? "" : "es"}`);
        if (res.skipped) parts.push(`skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`);
        flash(
          true,
          `${broker} CSV: ${parts.join(", ") || "nothing new; all trades were already imported"}.` +
            (setBase
              ? ` Set capital base to ${usd0(suggestedCapitalBase)} (${baseHint}), adjust below if needed.`
              : "")
        );
      } else if (/\.json$/i.test(file.name)) {
        const ds = JSON.parse(await file.text());
        if (!ds.trades?.length) return flash(false, "That JSON has no trades.");
        await replaceDataset(ds);
        flash(true, `Loaded ${ds.trades.length} trades from JSON.`);
      } else {
        flash(false, "Drop a .xlsx workbook, a broker .csv, or a Flywheel .json export.");
      }
    } catch (e: any) {
      flash(false, "Import failed: " + (e?.message ?? "unknown error"));
    } finally {
      busyRef.current = false;
      setImporting(false);
    }
  }

  // A file dropped on the "Import / Data" nav link (see Layout) lands here.
  // Ref so the subscription always calls the latest handleFile closure.
  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;
  useEffect(() => subscribePendingImport((f) => handleFileRef.current(f)), []);

  const hasOwnData = dataset.trades.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Import &amp; Data</h1>
        <p className="mt-1 text-sm text-slate-400">
          Make Flywheel yours. Bring in your real trades three ways; everything stays in your
          browser until you sign in to sync.
        </p>
      </div>

      {msg && (
        <div
          role="status"
          className={cls(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm animate-fade-up",
            msg.ok
              ? "border-flux-500/25 bg-flux-500/[0.08] text-flux-300"
              : "border-loss-500/25 bg-loss-500/[0.08] text-loss-400"
          )}
        >
          {msg.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Dropzone — the primary onboarding action */}
      <Card>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f && !importing) handleFile(f);
          }}
          onClick={() => !importing && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload a workbook, CSV, or JSON file"
          aria-busy={importing}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !importing) {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          className={cls(
            "grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
            drag
              ? "border-flux-500 bg-flux-500/[0.06]"
              : "border-white/15 hover:border-flux-500/40 hover:bg-white/[0.02]"
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-flux-500/10 ring-1 ring-inset ring-flux-500/25">
            <Upload className="text-flux-400" size={28} />
          </div>
          <div className="mt-4 text-base font-semibold text-slate-100">
            {importing ? "Importing…" : drag ? "Drop to import" : "Drag a file here, or browse"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {importing
              ? "Saving your trades. Hang tight; re-importing the same file never duplicates."
              : "We'll detect the format automatically and show you what came in."}
          </div>
          <span className="btn-primary pointer-events-none mt-4">
            <FolderOpen size={16} />
            Choose a file
          </span>
        </div>

        {/* What's accepted — three clear paths */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <FormatCard
            icon={<FileSpreadsheet size={15} className="text-flux-400" />}
            tag={<Pill tone="green">.xlsx</Pill>}
            title="Wheel workbook"
            desc="Your Options Trading.xlsx: replaces the demo with your full history."
          />
          <FormatCard
            icon={<FileSpreadsheet size={15} className="text-sky-300" />}
            tag={<Pill tone="blue">.csv</Pill>}
            title="Broker export"
            desc="A tastytrade or Fidelity CSV: spreads grouped into positions, added to what's loaded."
          />
          <FormatCard
            icon={<FileJson size={15} className="text-slate-300" />}
            tag={<Pill tone="slate">.json</Pill>}
            title="Flywheel backup"
            desc="A JSON file you exported below: restores trades, prices, and settings."
          />
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          A <span className="text-slate-400">.xlsx</span> or <span className="text-slate-400">.json</span>{" "}
          replaces the demo data; a broker <span className="text-slate-400">.csv</span> adds to it. Re-export
          your workbook anytime with{" "}
          <code className="rounded bg-white/5 px-1 py-0.5 text-slate-400">npm run export-workbook</code>.
        </p>
      </Card>

      <ManualEntry onAdd={addTrade} tickers={Object.keys(dataset.lastPrices)} />

      {/* Settings */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle title="Account & Benchmark" sub="Drives yield-on-capital and the SPY comparison" />
          <div className="space-y-3">
            <Field
              label="Capital base ($)"
              value={dataset.capitalBase}
              onCommit={(v) => setCapitalBase(v)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="SPY now" value={dataset.spy.now} onCommit={(v) => setSpy(v, dataset.spy.year_ago, dataset.spy.year_ago_date)} />
              <Field label="SPY 1y ago" value={dataset.spy.year_ago} onCommit={(v) => setSpy(dataset.spy.now, v, dataset.spy.year_ago_date)} />
            </div>
            <div>
              <div className="stat-label mb-1.5">Last share prices</div>
              {Object.keys(dataset.lastPrices).length === 0 ? (
                <p className="rounded-xl bg-white/[0.03] p-3 text-xs text-slate-500">
                  No tickers yet. Import trades or add one below and its last price shows up here.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(dataset.lastPrices).map(([tk, px]) => (
                    <div key={tk} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 font-semibold text-slate-200">{tk}</span>
                      <Field label="" value={px} onCommit={(v) => setPrice(tk, v)} compact />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Manage Data" sub="Local browser storage" />
          <div className="space-y-3">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `flywheel-export-${todayISO()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-ghost w-full"
            >
              <Download size={16} /> Export all data (JSON)
            </button>
            <button onClick={resetToSeed} className="btn-ghost w-full">
              <RotateCcw size={16} /> Reset to demo data
            </button>
            <button
              onClick={async () => {
                if (!dupCount) return;
                if (
                  !confirm(
                    `Remove ${dupCount} duplicate trade${dupCount === 1 ? "" : "s"}? One copy of each is kept; notes, grades, and wheel tags are preserved.`
                  )
                )
                  return;
                try {
                  const n = await removeDuplicates();
                  flash(true, `Removed ${n} duplicate trade${n === 1 ? "" : "s"}.`);
                } catch {
                  flash(false, "Couldn't remove duplicates; nothing was changed.");
                }
              }}
              disabled={dupCount === 0}
              className="btn-ghost w-full"
            >
              <CopyMinus size={16} />
              {dupCount ? `Remove ${dupCount} duplicate trade${dupCount === 1 ? "" : "s"}` : "No duplicate trades found"}
            </button>
            <button
              onClick={() => {
                if (confirm("Delete all trades? This can't be undone.")) clearAll();
              }}
              disabled={!hasOwnData}
              className="btn w-full border border-loss-500/30 text-loss-400 transition-colors hover:bg-loss-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss-500/40"
            >
              <Trash2 size={16} /> Clear all trades
            </button>
            <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Roadmap</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>User accounts &amp; cloud sync (Supabase)</li>
                <li>Live prices &amp; auto SPY benchmark</li>
                <li>More broker CSV formats (Robinhood next, then Schwab, IBKR)</li>
                <li>Pre-trade thesis &amp; execution grading</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FormatCard({
  icon,
  tag,
  title,
  desc,
}: {
  icon: React.ReactNode;
  tag: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          {icon}
          {title}
        </span>
        {tag}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function ManualEntry({
  onAdd,
  tickers,
}: {
  onAdd: (t: Omit<Trade, "id">) => void;
  tickers: string[];
}) {
  const [ticker, setTicker] = useState("");
  const [action, setAction] = useState<TradeAction>("CSP");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [strike, setStrike] = useState("");
  const [expiry, setExpiry] = useState("");

  const canSubmit = !!ticker.trim() && !!amount;

  const submit = () => {
    if (!canSubmit) return;
    const credit = action === "CSP" || action === "CC";
    onAdd({
      ticker: ticker.trim().toUpperCase(),
      side: credit ? "credit" : "debit",
      action,
      date,
      shares: 100,
      amount: parseFloat(amount) || 0,
      invested: action === "AAssignSTK" ? parseFloat(amount) || 0 : null,
      status: credit ? "Open" : "",
      strike: strike ? parseFloat(strike) : null,
      expiry: expiry || null,
    });
    setAmount("");
    setStrike("");
  };

  return (
    <Card>
      <SectionTitle
        title="Quick Add Trade"
        sub="No file? Log one by hand, like your optionstrade skill, in the browser"
        right={<PencilLine size={16} className="text-slate-500" />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        <div className="col-span-1">
          <label className="stat-label">Ticker</label>
          <input
            list="tickers"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="SOFI"
            className="input mt-1.5"
          />
          <datalist id="tickers">
            {tickers.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="stat-label">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value as TradeAction)} className="input mt-1.5">
            <option value="CSP">CSP</option>
            <option value="CC">CC</option>
            <option value="BB">Buyback</option>
            <option value="AAssignSTK">Assign</option>
          </select>
        </div>
        <div>
          <label className="stat-label">{action === "AAssignSTK" ? "Invested $" : "Premium $"}</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="40.00" className="input mt-1.5 num" />
        </div>
        <div>
          <label className="stat-label">Strike</label>
          <input value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="opt." className="input mt-1.5 num" />
        </div>
        <div>
          <label className="stat-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1.5" />
        </div>
        <div>
          <label className="stat-label">Expiry</label>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="input mt-1.5" />
        </div>
        <div className="flex items-end">
          <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onCommit,
  compact,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  compact?: boolean;
}) {
  const [v, setV] = useState(String(value));
  return (
    <div className={compact ? "flex-1" : ""}>
      {label && <label className="stat-label">{label}</label>}
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onCommit(parseFloat(v) || 0)}
        className={cls("input num", !compact && "mt-1.5")}
        inputMode="decimal"
        aria-label={label || "Value"}
      />
    </div>
  );
}
