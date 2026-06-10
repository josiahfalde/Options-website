import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, TrendingUp, Sparkles } from "lucide-react";
import { useStore } from "../data/store";
import {
  computePortfolio,
  cumulativeCurve,
  monthlySeries,
  realizedInTimeframe,
  TIMEFRAMES,
  type Timeframe,
} from "../data/compute";
import { Card, Kpi, Pill, SectionTitle, Bar as MiniBar } from "../components/ui";
import { CapitalBaseEditor } from "../components/CapitalBaseEditor";
import { BRAND } from "../brand";
import { usd, usd0, pct, signed, fmtMonth, fmtDate, posneg, cls } from "../lib/format";
import { useChartTheme } from "../lib/theme";

export default function Dashboard() {
  const { dataset, setCapitalBase } = useStore();
  const [tf, setTf] = useState<Timeframe>("ALL");
  const ct = useChartTheme();

  const p = useMemo(() => computePortfolio(dataset), [dataset]);
  const curve = useMemo(() => cumulativeCurve(dataset), [dataset]);
  const months = useMemo(() => monthlySeries(dataset), [dataset]);
  const tfRealized = useMemo(() => realizedInTimeframe(dataset, tf), [dataset, tf]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 md:text-3xl">
            Premium Dashboard
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <Sparkles size={14} className="text-flux-400" />
            {BRAND.tagline}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/5 bg-ink-900/60 p-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={cls(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                tf === t ? "bg-flux-500 text-ink-950" : "text-slate-400 hover:text-slate-100"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`Realized P&L · ${tf}`}
          value={signed(tfRealized)}
          tone={tfRealized >= 0 ? "pos" : "neg"}
          sub={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>{pct(p.returnPct)} on</span>
              <CapitalBaseEditor
                capitalBase={p.capitalBase}
                estimated={p.capitalEstimated}
                onCommit={setCapitalBase}
              />
              <span>· all-time</span>
            </span>
          }
          hint="Premium collected minus buybacks (cash basis). Matches your workbook's realized number."
        />
        <Kpi
          label="Win Rate"
          value={pct(p.winRate, 0)}
          tone="pos"
          sub={`${p.wins}W · ${p.losses}L · ${p.assignedCount} assigned of ${p.resolvedCount}`}
          hint="Share of resolved contracts where you kept net premium (expired, closed for profit, or assigned but premium kept)."
        />
        <Kpi
          label="Annualized Yield"
          value={pct(p.annualizedReturn, 1)}
          tone="gold"
          sub={`${pct(p.monthlyYield, 2)}/mo on capital · ${p.daysActive}d active`}
          hint="Realized return on capital base, annualized from your first trade date — the real yield on deployed cash."
        />
        <Kpi
          label="Alpha vs SPY"
          value={p.hasSpy ? (p.alpha >= 0 ? "+" : "") + pct(p.alpha, 1).replace("+", "") : "—"}
          tone={p.hasSpy ? (p.alpha >= 0 ? "pos" : "neg") : "neutral"}
          sub={
            p.hasSpy
              ? `You ${pct(p.returnPct, 1)} · SPY ${pct(p.spyReturn, 1)} YoY`
              : "Set the SPY benchmark on the Data page to compare"
          }
          hint="Your realized return minus SPY's trailing-12-month total return."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Cumulative Realized Premium"
            sub="Every credit lifts the line; every buyback dips it."
            right={
              <Pill tone={p.realized >= 0 ? "green" : "red"}>
                <TrendingUp size={13} /> {signed(p.realized)}
              </Pill>
            }
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-prem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: ct.axis, fontSize: 11 }}
                  tickFormatter={(d) => fmtMonth(String(d).slice(0, 7))}
                  minTickGap={36}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: ct.axis, fontSize: 11 }}
                  tickFormatter={(v) => "$" + v}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<ChartTip kind="money" labelFmt={fmtDate} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#g-prem)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Monthly P&L" sub="Realized premium per month" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ left: -20, right: 4, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: ct.axis, fontSize: 11 }}
                  tickFormatter={(m) => fmtMonth(String(m))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: ct.axis, fontSize: 11 }}
                  tickFormatter={(v) => "$" + v}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                />
                <Tooltip content={<ChartTip kind="money" labelFmt={(m: string) => fmtMonth(String(m))} />} cursor={{ fill: ct.cursor }} />
                <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                  {months.map((m, i) => (
                    <Cell key={i} fill={m.pl >= 0 ? "#10b981" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Premium Collected" value={usd(p.premiumCollected)} tone="text-flux-400" />
        <MiniStat label="Paid to Buy Back" value={usd(p.buybacks)} tone="text-loss-400" />
        <MiniStat
          label="Mark-to-Market"
          value={signed(p.mtm)}
          tone={p.mtm >= 0 ? "text-flux-400" : "text-loss-400"}
          sub={`incl. ${usd(p.unrealized)} open shares`}
        />
        <MiniStat
          label="Capital Deployed"
          value={pct(p.deployedPct, 0)}
          tone="text-torque-400"
          sub={`${usd0(p.capitalDeployed)} at work`}
        />
      </div>

      {/* Ticker leaderboard + recent */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="By Ticker"
            right={
              <Link to="/campaigns" className="flex items-center gap-1 text-xs text-flux-300 hover:text-flux-200">
                Campaigns <ArrowRight size={13} />
              </Link>
            }
          />
          <div className="space-y-3">
            {p.tickers.map((t) => {
              const max = Math.max(...p.tickers.map((x) => Math.abs(x.realized)), 1);
              return (
                <div key={t.ticker} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 font-semibold text-slate-200">{t.ticker}</div>
                  <div className="flex-1">
                    <MiniBar value={t.realized} max={max} tone={t.realized >= 0 ? "green" : "red"} />
                  </div>
                  <div className={cls("w-20 shrink-0 text-right num text-sm font-semibold", posneg(t.realized))}>
                    {signed(t.realized)}
                  </div>
                  {t.sharesHeld > 0 && <Pill tone="gold">{t.sharesHeld} sh</Pill>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Recent Activity"
            right={
              <Link to="/trades" className="flex items-center gap-1 text-xs text-flux-300 hover:text-flux-200">
                All trades <ArrowRight size={13} />
              </Link>
            }
          />
          <div className="space-y-1">
            {[...dataset.trades]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 8)
              .map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <span className="w-12 shrink-0 text-xs text-slate-500">{t.date.slice(5)}</span>
                  <span className="w-12 shrink-0 font-semibold text-slate-200">{t.ticker}</span>
                  <ActionPill action={t.action} />
                  <span className="ml-auto num text-sm font-medium text-slate-300">
                    {t.side === "credit" ? "+" : "−"}
                    {usd(t.amount)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: string;
  sub?: string;
}) {
  return (
    <Card>
      <div className="stat-label">{label}</div>
      <div className={cls("mt-1.5 num text-xl font-bold", tone)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </Card>
  );
}

export function ActionPill({ action }: { action: string }) {
  const map: Record<string, { tone: any; label: string }> = {
    CSP: { tone: "green", label: "CSP" },
    CC: { tone: "blue", label: "CC" },
    BB: { tone: "slate", label: "Buyback" },
    AAssignSTK: { tone: "gold", label: "Assigned" },
  };
  const m = map[action] ?? { tone: "slate", label: action };
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

export function ChartTip({
  active,
  payload,
  label,
  kind,
  labelFmt,
}: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="rounded-lg border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400">{labelFmt ? labelFmt(label) : label}</div>
      <div className={cls("num font-semibold", v >= 0 ? "text-flux-400" : "text-loss-400")}>
        {kind === "money" ? signed(v) : v}
      </div>
    </div>
  );
}
