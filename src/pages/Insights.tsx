import { useMemo, useState } from "react";
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
import { Trophy, TrendingDown, Flame, Brain, Lightbulb, Upload } from "lucide-react";
import { useStore } from "../data/store";
import {
  strategyStats,
  allClosedPositions,
  computePortfolio,
  type ClosedPosition,
} from "../data/compute";
import { Card, Pill, SectionTitle, Kpi, Delta, deltaDir, EmptyState } from "../components/ui";
import { Drawer } from "../components/Drawer";
import { ActionPill } from "./Dashboard";
import { usd, signed, pct, fmtDate, cls } from "../lib/format";
import { useChartTheme } from "../lib/theme";

export default function Insights() {
  const { dataset } = useStore();
  const ct = useChartTheme();
  const strat = useMemo(() => strategyStats(dataset), [dataset]);
  const closed = useMemo(() => allClosedPositions(dataset), [dataset]);
  const p = useMemo(() => computePortfolio(dataset), [dataset]);
  const [drill, setDrill] = useState<ClosedPosition[] | null>(null);
  const [drillTitle, setDrillTitle] = useState("");

  const best = useMemo(() => [...closed].sort((a, b) => b.pnl - a.pnl).slice(0, 5), [closed]);
  const worst = useMemo(() => [...closed].sort((a, b) => a.pnl - b.pnl).slice(0, 5), [closed]);

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

  const openDrill = (title: string, rows: ClosedPosition[]) => {
    setDrillTitle(title);
    setDrill(rows);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Insights</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
          <Brain size={15} className="text-flux-400" />
          What's actually working — beyond the running P&amp;L.
        </p>
      </div>

      {closed.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No closed trades to analyze yet"
          sub="Insights compares your strategies, hold times, and best/worst closes once you have resolved positions. Import your history or log trades, then close a few to see where your edge lives."
          action={{ label: "Import your trades", to: "/import", icon: Upload }}
          secondaryAction={{ label: "See the dashboard", to: "/" }}
        />
      ) : (
        <>
      {/* Edge-per-trade KPIs — the inverted-pyramid headline for this page */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          size="lg"
          className="col-span-2"
          icon={Flame}
          label="Expectancy · per resolved trade"
          value={signed(p.expectancy)}
          tone={p.expectancy >= 0 ? "pos" : "neg"}
          delta={
            <Delta
              dir={deltaDir(p.expectancy)}
              value={p.expectancy >= 0 ? "edge" : "bleed"}
              icon={false}
              size="sm"
            />
          }
          sub={
            <>
              Average P&amp;L you bank each time a contract resolves, across{" "}
              <span className="num text-slate-300">{closed.length}</span> closes.
            </>
          }
          hint="Expectancy = win rate × average win − loss rate × average loss. Positive means each resolved trade adds to your bottom line on average."
        />
        <Kpi
          label="Avg Win"
          value={signed(p.avgWin)}
          tone="pos"
          delta={<Delta dir="up" value={signed(p.avgWin, 0)} size="xs" />}
          sub={`Across ${p.wins} winning closes`}
          hint="Mean P&L of the resolved trades you kept net premium on."
        />
        <Kpi
          label="Avg Loss"
          value={signed(p.avgLoss)}
          tone={p.avgLoss < 0 ? "neg" : "neutral"}
          delta={p.avgLoss < 0 ? <Delta dir="down" value={signed(p.avgLoss, 0)} size="xs" /> : undefined}
          sub={`Across ${p.losses} losing closes`}
          hint="Mean P&L of the resolved trades that ended in a net loss."
        />
        <Kpi
          label="Win / Loss Ratio"
          value={p.avgLoss !== 0 ? (Math.abs(p.avgWin / p.avgLoss)).toFixed(2) + "×" : "—"}
          tone="gold"
          sub="Average win size vs average loss size"
          hint="How many dollars you make on a typical win for every dollar a typical loss costs. Above 1× means your winners outweigh your losers."
        />
      </div>

      {/* Strategy comparison */}
      <div>
        <SectionTitle title="Strategy Scorecard" sub="Cash-secured puts vs covered calls" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {strat.map((s) => (
            <Card key={s.key}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill tone={s.key === "CSP" ? "green" : "blue"}>{s.key}</Pill>
                  <span className="text-sm font-semibold text-slate-200">
                    {s.key === "CSP" ? "Cash-Secured Puts" : "Covered Calls"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="num text-lg font-bold text-slate-50">{pct(s.winRate, 0)}</span>
                  <span className="stat-label">win</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
                <MiniStat label="Contracts" value={String(s.contracts)} />
                <MiniStat label="Avg prem" value={usd(s.avgPremium, 0)} tone="text-flux-400" />
                <MiniStat label="Premium" value={usd(s.premium, 0)} tone="text-flux-400" />
                <MiniStat
                  label="Net closed"
                  value={
                    <Delta
                      dir={deltaDir(s.net)}
                      value={usd(Math.abs(s.net), 0)}
                      size="sm"
                      weight="bold"
                      className="justify-center"
                    />
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Hold Time vs Win Rate" sub="Where your edge actually lives" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ left: -22, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: ct.cursor }}
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl">
                        <div className="font-semibold text-slate-200">{label}</div>
                        <div className="text-slate-400">{payload[0].payload.count} trades</div>
                        <div className="text-slate-300">{pct(payload[0].payload.winRate, 0)} win</div>
                        <Delta
                          dir={deltaDir(payload[0].payload.pnl)}
                          value={signed(payload[0].payload.pnl)}
                          size="xs"
                        />
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
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-flux-500" /> Win rate ≥ 50%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-torque-500" /> Win rate &lt; 50%
            </span>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Outcomes" sub={`${closed.length} resolved`} />
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
                        <span className="num">{payload[0].value}</span>
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
                <span className="num text-slate-500">{d.value}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Best / worst — clickable into a drawer with the full list */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LeaderCard
          title="Best Closes"
          icon={<Trophy size={16} className="text-torque-400" />}
          rows={best}
          onSeeAll={() => openDrill("Closes — best first", [...closed].sort((a, b) => b.pnl - a.pnl))}
        />
        <LeaderCard
          title="Worst Closes"
          icon={<TrendingDown size={16} className="text-loss-400" />}
          rows={worst}
          onSeeAll={() => openDrill("Closes — worst first", [...closed].sort((a, b) => a.pnl - b.pnl))}
        />
      </div>
        </>
      )}

      {/* Full closed-trade list */}
      <Drawer
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drillTitle}
        sub={drill ? `${drill.length} resolved positions` : ""}
      >
        {drill && (
          <div className="space-y-1.5">
            {drill.map((r, i) => (
              <ClosedRow key={i} r={r} />
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function LeaderCard({
  title,
  icon,
  rows,
  onSeeAll,
}: {
  title: string;
  icon: React.ReactNode;
  rows: ClosedPosition[];
  onSeeAll: () => void;
}) {
  return (
    <Card>
      <SectionTitle
        title={title}
        right={
          rows.length > 0 ? (
            <button
              onClick={onSeeAll}
              className="flex items-center gap-1.5 text-xs text-flux-300 transition-colors hover:text-flux-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40 rounded"
            >
              <span>{icon}</span>
              See all
            </button>
          ) : (
            <span>{icon}</span>
          )
        }
      />
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
            <span className="w-12 shrink-0 font-semibold text-slate-200">{r.ticker}</span>
            <Pill tone={r.action === "CSP" ? "green" : "blue"}>{r.action}</Pill>
            <span className="hidden text-xs text-slate-500 sm:inline">
              {fmtDate(r.closeDate)} · {r.daysHeld}d
            </span>
            <span className="text-xs text-slate-500 sm:hidden">{r.daysHeld}d</span>
            <Delta
              dir={deltaDir(r.pnl)}
              value={usd(Math.abs(r.pnl))}
              size="sm"
              weight="semibold"
              className="ml-auto justify-end"
            />
          </div>
        ))}
        {rows.length === 0 && <div className="py-6 text-center text-sm text-slate-500">No closed trades yet.</div>}
      </div>
    </Card>
  );
}

function ClosedRow({ r }: { r: ClosedPosition }) {
  const outcomeLabel: Record<ClosedPosition["outcome"], string> = {
    expired: "Expired",
    "bought-back": "Bought back",
    assigned: "Assigned",
  };
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-2.5 py-2">
      <span className="w-12 shrink-0 font-semibold text-slate-200">{r.ticker}</span>
      <ActionPill action={r.action} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-500">{fmtDate(r.closeDate)}</div>
        <div className="text-[11px] text-slate-500">{outcomeLabel[r.outcome]} · {r.daysHeld}d held</div>
      </div>
      <Delta dir={deltaDir(r.pnl)} value={usd(Math.abs(r.pnl))} size="sm" weight="bold" className="shrink-0" />
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cls("num font-bold", tone ?? "text-slate-100")}>{value}</div>
    </div>
  );
}
