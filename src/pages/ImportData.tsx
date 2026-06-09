import { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Plus,
  Download,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useStore } from "../data/store";
import { parseWorkbook, parseFidelityCsv } from "../data/importXlsx";
import { Card, Pill, SectionTitle } from "../components/ui";
import { todayISO, cls, usd0 } from "../lib/format";
import type { Trade, TradeAction } from "../types";

export default function ImportData() {
  const { dataset, replaceDataset, addTrade, setCapitalBase, setPrice, setSpy, resetToSeed, clearAll } =
    useStore();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  };

  async function handleFile(file: File) {
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const ds = await parseWorkbook(file);
        if (!ds.trades.length) return flash(false, "No Wheel sheets found in that workbook.");
        replaceDataset(ds);
        flash(true, `Imported ${ds.trades.length} trades across ${Object.keys(ds.lastPrices).length} tickers.`);
      } else if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const { trades, suggestedCapitalBase } = parseFidelityCsv(text);
        if (!trades.length) return flash(false, "Couldn't parse option trades from that CSV.");
        // The CSV has no cash balance; if no capital base is set yet, seed it
        // with the estimated peak collateral so yields aren't divided by ~$0.
        const setBase = !dataset.capitalBase && suggestedCapitalBase > 0;
        replaceDataset(
          {
            ...dataset,
            trades: [...dataset.trades, ...trades],
            capitalBase: dataset.capitalBase || suggestedCapitalBase,
          },
          { merge: true }
        );
        flash(
          true,
          setBase
            ? `Added ${trades.length} trades. Set capital base to ${usd0(suggestedCapitalBase)} (≈ peak put collateral) — adjust below if needed.`
            : `Added ${trades.length} trades from CSV.`
        );
      } else if (/\.json$/i.test(file.name)) {
        const ds = JSON.parse(await file.text());
        if (!ds.trades?.length) return flash(false, "That JSON has no trades.");
        replaceDataset(ds);
        flash(true, `Loaded ${ds.trades.length} trades from JSON.`);
      } else {
        flash(false, "Drop a .xlsx workbook, a broker .csv, or a Flywheel .json export.");
      }
    } catch (e: any) {
      flash(false, "Import failed: " + (e?.message ?? "unknown error"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Import &amp; Data</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything lives in your browser. Import your Wheel workbook, drop a broker CSV, or add a
          trade by hand.
        </p>
      </div>

      {msg && (
        <div
          className={cls(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            msg.ok
              ? "border-flux-500/25 bg-flux-500/[0.08] text-flux-300"
              : "border-loss-500/25 bg-loss-500/[0.08] text-loss-400"
          )}
        >
          {msg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Dropzone */}
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
            if (f) handleFile(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={cls(
            "grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
            drag ? "border-flux-500 bg-flux-500/[0.06]" : "border-white/10 hover:border-white/20"
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-flux-500/10 ring-1 ring-flux-500/25">
            <Upload className="text-flux-400" />
          </div>
          <div className="mt-3 font-semibold text-slate-200">Drop your workbook or CSV here</div>
          <div className="mt-1 text-sm text-slate-500">
            <span className="text-slate-300">Options Trading.xlsx</span> · Fidelity CSV export
          </div>
          <div className="mt-3 flex gap-2">
            <Pill tone="green"><FileSpreadsheet size={13} /> .xlsx</Pill>
            <Pill tone="blue">Fidelity .csv</Pill>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Importing replaces the demo data. Re-export anytime with{" "}
          <code className="rounded bg-white/5 px-1 py-0.5 text-slate-400">npm run export-workbook</code>.
        </p>
      </Card>

      <ManualEntry onAdd={addTrade} tickers={Object.keys(dataset.lastPrices)} />

      {/* Settings */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle title="Account & Benchmark" />
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
              <div className="space-y-2">
                {Object.entries(dataset.lastPrices).map(([tk, px]) => (
                  <div key={tk} className="flex items-center gap-3">
                    <span className="w-14 font-semibold text-slate-200">{tk}</span>
                    <Field label="" value={px} onCommit={(v) => setPrice(tk, v)} compact />
                  </div>
                ))}
              </div>
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
              onClick={() => {
                if (confirm("Delete all trades? This can't be undone.")) clearAll();
              }}
              className="btn w-full border border-loss-500/30 text-loss-400 hover:bg-loss-500/10"
            >
              <Trash2 size={16} /> Clear all trades
            </button>
            <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Roadmap</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>User accounts &amp; cloud sync (Supabase)</li>
                <li>Live prices &amp; auto SPY benchmark</li>
                <li>More broker CSV formats (Schwab, IBKR, Robinhood)</li>
                <li>Pre-trade thesis &amp; execution grading</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
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

  const submit = () => {
    if (!ticker.trim() || !amount) return;
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
      <SectionTitle title="Quick Add Trade" sub="Like your optionstrade skill, in the browser" />
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
          <button onClick={submit} className="btn-primary w-full">
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
      />
    </div>
  );
}
