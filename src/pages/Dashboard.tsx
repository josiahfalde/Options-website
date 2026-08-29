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
import {
  ArrowRight,
  Sparkles,
  ChevronRight,
  Wallet,
  Trophy,
  Gauge,
  LineChart as LineChartIcon,
  Upload,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  computePortfolio,
  cumulativeCurve,
  monthlySeries,
  filterByTimeframe,
  TIMEFRAMES,
  type Timeframe,
  type TickerStat,
} from "../data/compute";
import { Card, Kpi, Pill, SectionTitle, Bar as MiniBar, Delta, deltaDir, EmptyState } from "../components/ui";
import { Drawer } from "../components/Drawer";
import type { Trade } from "../types";
import { CapitalBaseEditor } from "../components/CapitalBaseEditor";
import { BRAND } from "../brand";
import { usd, usd0, pct, signed, fmtMonth, fmtDate, posneg, cls } from "../lib/format";
import { useChartTheme } from "../lib/theme";

export default function Dashboard() {
  const { dataset, setCapitalBase } = useStore();
  const [tf, setTf] = useState<Timeframe>("ALL");
  const [drillTicker, setDrillTicker] = useState<string | null>(null);
  const ct = useChartTheme();

  const windowed = tf !== "ALL";

  // Current / all-time portfolio — drives the snapshot cards (Mark-to-Market,
  // Capital Deployed, holdings) and SPY alpha, which describe what you hold
  // NOW and have no windowed version.
  const pCur = useMemo(() => computePortfolio(dataset), [dataset]);

  // Window-scoped dataset: trades filtered to the selected timeframe, with the
  // capital base pinned to the full base so returns use the right denominator.
  // Drives every flow/performance card + the charts.
  const windowDs = useMemo(
    () =>
      windowed
        ? { ...dataset, capitalBase: pCur.capitalBase, trades: filterByTimeframe(dataset.trades, tf) }
        : dataset,
    [dataset, tf, windowed, pCur.capitalBase]
  );
  const p = useMemo(() => (windowed ? computePortfolio(windowDs) : pCur), [windowed, windowDs, pCur]);
  const curve = useMemo(() => cumulativeCurve(windowDs), [windowDs]);
  const months = useMemo(() => monthlySeries(windowDs), [windowDs]);
  const windowCount = windowDs.trades.length;

  // MoM momentum for the hero — only on the all-time view (where `months` spans
  // full history); a month-over-month delta on a short window is just noise.
  const lastMonth = months.length ? months[months.length - 1] : null;
  const prevMonth = months.length > 1 ? months[months.length - 2] : null;
  const momChange = lastMonth && prevMonth ? lastMonth.pl - prevMonth.pl : null;

  const hasTrades = dataset.trades.length > 0;

  return (
    <div className="space-y-6">
      {/* Hero header */}
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
        <div
          role="group"
          aria-label="Timeframe"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/5 bg-ink-900/60 p-1"
        >
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              aria-pressed={tf === t}
              className={cls(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
                tf === t ? "bg-flux-500 text-ink-950" : "text-slate-400 hover:text-slate-100"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!hasTrades ? (
        <EmptyState
          icon={LineChartIcon}
          title="No trades yet. Let's build your flywheel"
          sub="Flywheel turns your sold puts and calls into momentum and yield analytics. Import your broker history or log your first trade to see your realized P&L, win rate, and yield come to life."
          action={{ label: "Import your trades", to: "/import", icon: Upload }}
          secondaryAction={{ label: "Browse the demo", to: "/trades" }}
        />
      ) : (
        <>
      {windowed && windowCount === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
          No trades in the last {tf}. Flow metrics show zero for this window; your current holdings below are unaffected.
        </div>
      )}
      {/* KPI grid — inverted pyramid: hero P&L top-left, then context metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Hero: the single most important answer — all-time realized P&L */}
        <Kpi
          size="lg"
          className="col-span-2"
          icon={Wallet}
          label={windowed ? `Realized P&L · last ${tf}` : "Realized P&L · all-time"}
          value={signed(p.realized)}
          tone={p.realized >= 0 ? "pos" : "neg"}
          delta={
            !windowed && momChange != null ? (
              <Delta
                dir={deltaDir(momChange)}
                value={`${signed(momChange, 0)} MoM`}
                size="sm"
              />
            ) : undefined
          }
          sub={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className={cls("num font-semibold", posneg(p.realized))}>
                {pct(p.returnPct)}
              </span>
              <span>return on</span>
              <CapitalBaseEditor
                capitalBase={pCur.capitalBase}
                estimated={pCur.capitalEstimated}
                onCommit={setCapitalBase}
              />
              <span>· {windowed ? `last ${tf}` : "all-time"}</span>
            </span>
          }
          hint="Premium collected minus buybacks (cash basis). Matches your workbook's realized number. Scoped to the selected timeframe."
        />
        <Kpi
          icon={Trophy}
          label="Win Rate"
          value={p.resolvedCount ? pct(p.winRate, 0) : "—"}
          tone="pos"
          to="/insights"
          sub={
            p.resolvedCount
              ? `${p.wins}W · ${p.losses}L · ${p.assignedCount} assigned of ${p.resolvedCount} resolved`
              : `No resolved contracts${windowed ? ` in last ${tf}` : ""}`
          }
          hint="Share of resolved contracts where you kept net premium (expired, closed for profit, or assigned but premium kept). Scoped to the selected timeframe."
        />
        <Kpi
          icon={Gauge}
          label="Annualized Yield"
          value={windowCount ? pct(p.annualizedReturn, 1) : "—"}
          tone="gold"
          sub={`${pct(p.monthlyYield, 2)}/mo on capital · ${p.daysActive}d active`}
          hint="Realized return on capital base, annualized: the real yield on deployed cash. Scoped to the selected timeframe."
        />
      </div>

      {/* Secondary metric row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Alpha vs SPY"
          value={pCur.hasSpy ? (pCur.alpha >= 0 ? "+" : "−") + pct(pCur.alpha, 1).replace(/[+-]/, "") : "—"}
          tone={pCur.hasSpy ? (pCur.alpha >= 0 ? "pos" : "neg") : "neutral"}
          delta={
            pCur.hasSpy ? (
              <Delta dir={deltaDir(pCur.alpha)} value={pct(pCur.alpha, 1)} size="xs" />
            ) : undefined
          }
          sub={
            pCur.hasSpy ? (
              <>You {pct(pCur.returnPct, 1)} vs SPY {pct(pCur.spyReturn, 1)} · trailing 12mo</>
            ) : (
              <Link to="/import" className="text-flux-300 hover:text-flux-200">
                Set the SPY benchmark to compare →
              </Link>
            )
          }
          hint="Your all-time realized return minus SPY's trailing-12-month total return. Benchmark is fixed at trailing 12 months, so this card does not follow the timeframe selector."
        />
        <Kpi
          label="Premium Collected"
          value={usd(p.premiumCollected)}
          tone="pos"
          sub={`${usd(p.buybacks)} paid to buy back · ${p.contracts} contracts sold`}
          hint="Total credits received from selling puts and calls, before buybacks. Scoped to the selected timeframe."
        />
        <Kpi
          label="Mark-to-Market · current"
          value={signed(pCur.mtm)}
          tone={pCur.mtm >= 0 ? "pos" : "neg"}
          delta={<Delta dir={deltaDir(pCur.unrealized)} value={`${signed(pCur.unrealized, 0)} open`} size="xs" />}
          sub={`Realized ${signed(pCur.realized, 0)} + unrealized on open shares`}
          hint="Realized premium plus the live gain/loss on shares you still hold (sharesHeld × lastPrice − cost). A live snapshot of your whole book; it always reflects now, not the selected timeframe."
        />
        <Kpi
          label="Capital Deployed · current"
          value={pct(pCur.deployedPct, 0)}
          tone="gold"
          to="/radar"
          sub={`${usd0(pCur.capitalDeployed)} at work · ${pCur.openContracts} open contracts`}
          hint="Capital tied up in held shares plus open cash-secured-put collateral, as a share of your capital base. A current snapshot; it always reflects now, not the selected timeframe."
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
                <Delta dir={deltaDir(p.realized)} value={signed(p.realized, 0)} size="xs" />
              </Pill>
            }
          />
          <div className="h-64">
            {windowCount === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No activity in the last {tf}
              </div>
            ) : (
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
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Monthly P&L" sub="Realized premium per month" />
          <div className="h-64">
            {windowCount === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No activity in the last {tf}
              </div>
            ) : (
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
            )}
          </div>
        </Card>
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
          <div className="space-y-1">
            {p.tickers.map((t) => {
              const max = Math.max(...p.tickers.map((x) => Math.abs(x.realized)), 1);
              return (
                <button
                  key={t.ticker}
                  onClick={() => setDrillTicker(t.ticker)}
                  className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
                >
                  <div className="w-14 shrink-0 font-semibold text-slate-200">{t.ticker}</div>
                  <div className="flex-1">
                    <MiniBar value={t.realized} max={max} tone={t.realized >= 0 ? "green" : "red"} />
                  </div>
                  <div className={cls("w-20 shrink-0 text-right num text-sm font-semibold", posneg(t.realized))}>
                    {signed(t.realized)}
                  </div>
                  {t.sharesHeld > 0 && <Pill tone="gold">{t.sharesHeld} sh</Pill>}
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-slate-600 transition group-hover:text-slate-300"
                  />
                </button>
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
        </>
      )}

      {/* Per-ticker drill-down */}
      <Drawer
        open={!!drillTicker}
        onClose={() => setDrillTicker(null)}
        title={drillTicker ?? ""}
        sub="Ticker breakdown"
      >
        {drillTicker && (
          <TickerDrill
            stat={p.tickers.find((t) => t.ticker === drillTicker)!}
            trades={dataset.trades.filter((t) => t.ticker === drillTicker)}
            onClose={() => setDrillTicker(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function TickerDrill({
  stat,
  trades,
  onClose,
}: {
  stat: TickerStat;
  trades: Trade[];
  onClose: () => void;
}) {
  const recent = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <DrillStat label="Realized P&L" value={signed(stat.realized)} tone={posneg(stat.realized)} />
        <DrillStat label="Win rate" value={pct(stat.winRate, 0)} tone="pos" />
        <DrillStat label="Premium collected" value={usd(stat.credits)} tone="pos" />
        <DrillStat label="Paid to buy back" value={usd(stat.buybacks)} tone="neg" />
        <DrillStat label="Contracts" value={String(stat.contracts)} />
        <DrillStat label="Open" value={String(stat.openContracts)} />
        {stat.sharesHeld > 0 && (
          <>
            <DrillStat label="Shares held" value={String(stat.sharesHeld)} tone="gold" />
            <DrillStat label="Cost basis" value={usd(stat.costBasis)} />
            <DrillStat label="Last price" value={usd(stat.lastPrice)} />
            <DrillStat label="Unrealized" value={signed(stat.unrealized)} tone={posneg(stat.unrealized)} />
          </>
        )}
      </div>

      <div>
        <div className="stat-label mb-2 flex items-center justify-between">
          <span>Recent trades</span>
          <Link
            to="/trades"
            onClick={onClose}
            className="flex items-center gap-1 text-[11px] normal-case text-flux-300 hover:text-flux-200"
          >
            Open in Trades <ArrowRight size={12} />
          </Link>
        </div>
        <div className="space-y-1">
          {recent.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-2.5 py-1.5"
            >
              <span className="w-14 shrink-0 text-xs text-slate-500">{t.date.slice(5)}</span>
              <ActionPill action={t.action} />
              {t.status && <span className="text-[11px] text-slate-500">{t.status}</span>}
              <span
                className={cls(
                  "ml-auto num text-sm font-semibold",
                  t.side === "credit" ? "text-flux-400" : "text-loss-400"
                )}
              >
                {t.side === "credit" ? "+" : "−"}
                {usd(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrillStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const toneCls =
    tone === "pos"
      ? "text-flux-400"
      : tone === "neg"
      ? "text-loss-400"
      : tone === "gold"
      ? "text-torque-400"
      : "text-slate-100";
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cls("num mt-0.5 text-base font-bold", toneCls)}>{value}</div>
    </div>
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
