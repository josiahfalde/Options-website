import { useMemo, useState } from "react";
import { Search, Trash2, ArrowUpDown } from "lucide-react";
import { useStore } from "../data/store";
import { filterByTimeframe, TIMEFRAMES, type Timeframe, isCredit } from "../data/compute";
import { Card, Pill } from "../components/ui";
import { ActionPill } from "./Dashboard";
import { usd, fmtDate, cls } from "../lib/format";
import type { Trade } from "../types";

type SortKey = "date" | "ticker" | "amount";

export default function Trades() {
  const { dataset, deleteTrade } = useStore();
  const [tf, setTf] = useState<Timeframe>("ALL");
  const [q, setQ] = useState("");
  const [strat, setStrat] = useState<string>("ALL");
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    let t = filterByTimeframe(dataset.trades, tf);
    if (strat !== "ALL") t = t.filter((x) => x.action === strat);
    if (q.trim()) {
      const s = q.trim().toUpperCase();
      t = t.filter((x) => x.ticker.includes(s) || x.action.includes(s));
    }
    return [...t].sort((a, b) => {
      let r = 0;
      if (sort === "date") r = a.date.localeCompare(b.date);
      else if (sort === "ticker") r = a.ticker.localeCompare(b.ticker);
      else r = a.amount - b.amount;
      return r * dir;
    });
  }, [dataset.trades, tf, strat, q, sort, dir]);

  const credits = rows.filter(isCredit).reduce((a, t) => a + t.amount, 0);
  const debits = rows.filter((t) => !isCredit(t)).reduce((a, t) => a + t.amount, 0);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(-1);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Trades</h1>
        <p className="text-sm text-slate-400">
          {rows.length} trades · <span className="text-flux-400">+{usd(credits)}</span> collected ·{" "}
          <span className="text-loss-400">−{usd(debits)}</span> paid
        </p>
      </div>

      {/* Filters */}
      <Card pad={false} className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticker or action…"
              className="input pl-9"
            />
          </div>
          <select value={strat} onChange={(e) => setStrat(e.target.value)} className="input w-auto">
            <option value="ALL">All strategies</option>
            <option value="CSP">CSP (sold put)</option>
            <option value="CC">CC (covered call)</option>
            <option value="BB">Buyback</option>
            <option value="AAssignSTK">Assignment</option>
          </select>
          <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-ink-900/60 p-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={cls(
                  "rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
                  tf === t ? "bg-flux-500 text-ink-950" : "text-slate-400 hover:text-slate-100"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card pad={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/5 bg-white/[0.02]">
              <tr>
                <Th onClick={() => toggleSort("date")} active={sort === "date"}>Date</Th>
                <Th onClick={() => toggleSort("ticker")} active={sort === "ticker"}>Ticker</Th>
                <th className="th">Action</th>
                <th className="th">Status</th>
                <th className="th text-right">Shares</th>
                <Th onClick={() => toggleSort("amount")} active={sort === "amount"} right>Amount</Th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((t) => (
                <Row key={t.id} t={t} onDelete={() => deleteTrade(t.id)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    No trades match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  right,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  right?: boolean;
}) {
  return (
    <th className={cls("th cursor-pointer select-none hover:text-slate-200", right && "text-right")} onClick={onClick}>
      <span className={cls("inline-flex items-center gap-1", right && "flex-row-reverse")}>
        {children}
        <ArrowUpDown size={12} className={active ? "text-flux-400" : "text-slate-600"} />
      </span>
    </th>
  );
}

function Row({ t, onDelete }: { t: Trade; onDelete: () => void }) {
  const credit = t.side === "credit";
  const statusTone: any =
    t.status === "Assigned" ? "gold" : t.status === "Open" ? "blue" : t.status ? "slate" : "slate";
  return (
    <tr className="group hover:bg-white/[0.025]">
      <td className="td whitespace-nowrap text-slate-400">{fmtDate(t.date)}</td>
      <td className="td font-semibold text-slate-100">{t.ticker}</td>
      <td className="td"><ActionPill action={t.action} /></td>
      <td className="td">
        {t.status ? <Pill tone={statusTone}>{t.status}</Pill> : <span className="text-slate-600">—</span>}
      </td>
      <td className="td text-right num text-slate-400">{t.shares}</td>
      <td className={cls("td text-right num font-semibold", credit ? "text-flux-400" : "text-loss-400")}>
        {credit ? "+" : "−"}
        {usd(t.amount)}
      </td>
      <td className="td text-right">
        <button
          onClick={onDelete}
          className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-loss-400"
          title="Delete trade"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
