import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Trophy, TrendingDown, Flame, Brain } from "lucide-react";
import { useStore } from "../data/store";
import { strategyStats, allClosedPositions, computePortfolio } from "../data/compute";
import { Card, Pill, SectionTitle } from "../components/ui";
import { usd, signed, pct, fmtDate, cls, posneg } from "../lib/format";

export default function Insights() {
  const { dataset } = useStore();
  const strat = useMemo(() => strategyStats(dataset), [dataset]);
  const closed = useMemo(() => allClosedPositions(dataset), [dataset]);
  const p = useMemo(() => computePortfolio(dataset), [dataset]);

  const best = [...closed].sort((a, b) => b.pnl - a.pnl).slice(0, 5);
  const worst = [...closed].sort((a, b) => a.pnl - b.pnl).slice(0, 5);

  // days-held distribution
  const buckets = useMemo(() => {
    const defs = [
      { label: "0–7d", lo: 0, hi: 7 },
      { label: "8–14d", lo: 8, hi: 14 },
      { label: "15–30d", lo: 15, hi: 30 },
      { label: "31–45d", lo: 31, hi: 45 },
      { label: "45d+", lo: 46, hi: 9999 },
    ];
    return defs.map((d) => {
      const inB = closed.filter((c) => c.daysHeld >= d.lo && c.daysHeld <= d.hi);
      return {
        label: d.label,
        count: inB.length,
        pnl: inB.reduce((a, c) => a + c.pnl, 0),
        winRate: inB.length ? inB.filter((c) => c.isWin).length / inB.length : 0,
      };
    });
  }, [closed]);

  const outcomeData = [
    { name: "Expired", value: closed.filter((c) => c.outcome === "expired").length, color: "#10b981" },
    { name: "Bought back", value: closed.filter((c) => c.outcome === "bought-back").length, color: "#38bdf8" },
    { name: "Assigned", value: closed.filter((c) => c.outcome === "assigned").length, color: "#fbbf24" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Insights</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
          <Brain size={15} className="text-flux-400" />
          What's actually working — beyond the running P&L.
        </p>
      </div>

      {/* Strategy comparison */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {strat.map((s) => (
          <Card key={s.key}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill tone={s.key === "CSP" ? "green" : "blue"}>{s.key}</Pill>
                <span className="text-sm font-semibold text-slate-200">
                  {s.key === "CSP" ? "Cash-Secured Puts" : "Covered Calls"}
                </span>
              </div>
              <span className="num text-lg font-bold text-flux-400">{pct(s.winRate, 0)} win</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
              <MiniStat label="Contracts" value={String(s.contracts)} />
              <MiniStat label="Avg prem" value={usd(s.avgPremium, 0)} />
              <MiniStat label="Premium" value={usd(s.premium, 0)} tone="text-flux-400" />
              <MiniStat label="Net closed" value={signed(s.net)} tone={posneg(s.net)} />
            </div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Hold Time vs Win Rate" sub="Where your edge actually lives" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ left: -22, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "#ffffff08" }}
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl">
                        <div className="font-semibold text-slate-200">{label}</div>
                        <div className="text-slate-400">{payload[0].payload.count} trades</div>
                        <div className="text-flux-400">{pct(payload[0].payload.winRate, 0)} win</div>
                        <div className={cls(posneg(payload[0].payload.pnl))}>{signed(payload[0].payload.pnl)}</div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {buckets.map((b, i) => (
                    <Cell key={i} fill={b.winRate >= 0.5 ? "#10b981" : "#fbbf24"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Outcomes" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3}>
                  {outcomeData.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl">
                        <span className="font-semibold text-slate-200">{payload[0].name}: </span>
                        {payload[0].value}
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {outcomeData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Best / worst */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LeaderCard title="Best Closes" icon={<Trophy size={16} className="text-torque-400" />} rows={best} />
        <LeaderCard title="Worst Closes" icon={<TrendingDown size={16} className="text-loss-400" />} rows={worst} />
      </div>

      {/* Expectancy strip */}
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-flux-400" />
            <span className="text-sm font-semibold text-slate-200">Edge per resolved trade</span>
          </div>
          <Strip label="Expectancy" value={signed(p.expectancy)} tone={posneg(p.expectancy)} />
          <Strip label="Avg win" value={signed(p.avgWin)} tone="pos" />
          <Strip label="Avg loss" value={signed(p.avgLoss)} tone="neg" />
          <Strip
            label="Win/Loss ratio"
            value={p.avgLoss !== 0 ? (Math.abs(p.avgWin / p.avgLoss)).toFixed(2) + "×" : "—"}
            tone="neutral"
          />
        </div>
      </Card>
    </div>
  );
}

function LeaderCard({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: any[] }) {
  return (
    <Card>
      <SectionTitle title={title} right={<span>{icon}</span>} />
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
            <span className="w-12 font-semibold text-slate-200">{r.ticker}</span>
            <Pill tone={r.action === "CSP" ? "green" : "blue"}>{r.action}</Pill>
            <span className="text-xs text-slate-500">{fmtDate(r.closeDate)} · {r.daysHeld}d</span>
            <span className={cls("ml-auto num font-semibold", posneg(r.pnl))}>{signed(r.pnl)}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="py-6 text-center text-sm text-slate-500">No closed trades yet.</div>}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cls("num font-bold", tone ?? "text-slate-100")}>{value}</div>
    </div>
  );
}

function Strip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div
        className={cls(
          "num text-lg font-bold",
          tone === "pos" ? "text-flux-400" : tone === "neg" ? "text-loss-400" : "text-slate-100"
        )}
      >
        {value}
      </div>
    </div>
  );
}
