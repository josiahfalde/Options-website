import { useMemo, useState } from "react";
import {
  Layers,
  Coins,
  ShieldCheck,
  Wallet,
  ChevronDown,
  ListTree,
  Upload,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  computePortfolio,
  computePositions,
  strategyBreakdown,
  type Position,
  type StrategyBreakdown,
} from "../data/compute";
import {
  strategyDef,
  strategyLabel,
  strategyTone,
  type StrategyTone,
} from "../data/strategies";
import { Card, Kpi, Pill, SectionTitle, Delta, deltaDir, EmptyState } from "../components/ui";
import { usd, pct, signed, fmtDate, cls } from "../lib/format";
import type { Trade } from "../types";

// ---------------------------------------------------------------------------
// Strategies (JF-27). Re-partitions the SAME validated trades by strategy
// bucket, so the Combined headline always reconciles to the portfolio realized.
// Three layers, top→bottom: (1) Combined headline — the total, always visible;
// (2) per-strategy breakdown — ranked best→worst so "which is winning" reads at
// a glance; (3) positions detail — the legs behind each strategy, drill-down.
// ---------------------------------------------------------------------------

// Map a strategy tone → the Tailwind background used for the comparison bar.
// Tones come ONLY from strategyTone (no new hexes); slate uses a neutral fill.
const BAR_BG: Record<StrategyTone, string> = {
  green: "bg-flux-500",
  blue: "bg-sky-500",
  gold: "bg-torque-500",
  red: "bg-loss-500",
  slate: "bg-slate-400/70",
};

export default function Strategies() {
  const { dataset } = useStore();
  const portfolio = useMemo(() => computePortfolio(dataset), [dataset]);
  const breakdown = useMemo(() => strategyBreakdown(dataset), [dataset]);
  const positions = useMemo(() => computePositions(dataset), [dataset]);

  const [filter, setFilter] = useState<string>("ALL");

  const hasTrades = dataset.trades.length > 0;

  // Largest absolute realized across strategies — the scale for the bars.
  const maxAbsRealized = useMemo(
    () => Math.max(1, ...breakdown.map((b) => Math.abs(b.realized))),
    [breakdown]
  );

  const totalPremium = breakdown.reduce((a, b) => a + b.premium, 0);
  const totalCapital = breakdown.reduce((a, b) => a + b.capitalAtRisk, 0);
  const totalPositions = breakdown.reduce((a, b) => a + b.positions, 0);
  const openPositions = breakdown.reduce((a, b) => a + b.openPositions, 0);

  const filteredPositions = useMemo(
    () => (filter === "ALL" ? positions : positions.filter((p) => p.strategy === filter)),
    [positions, filter]
  );

  if (!hasTrades) {
    return (
      <div className="space-y-5">
        <Header strategyCount={0} />
        <EmptyState
          icon={Layers}
          title="No strategies to break down yet"
          sub="Flywheel sorts every trade into a strategy bucket (wheels, credit spreads, iron condors, or a custom bucket you name) and shows you which one is actually working. Import your trades to see the breakdown."
          action={{ label: "Import your trades", to: "/import", icon: Upload }}
          secondaryAction={{ label: "View all trades", to: "/trades" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <Header strategyCount={breakdown.length} />

      {/* ---- Combined headline — the total, always visible ---- */}
      <section>
        <SectionTitle
          title="Combined"
          sub="Every strategy together: this is your whole-portfolio realized P&L."
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            size="lg"
            label="Realized P&L"
            tone={portfolio.realized >= 0 ? "pos" : "neg"}
            icon={Coins}
            value={signed(portfolio.realized)}
            delta={<Delta dir={deltaDir(portfolio.realized)} value={pct(portfolio.returnPct)} size="sm" />}
            sub={`Across ${breakdown.length} ${breakdown.length === 1 ? "strategy" : "strategies"} · return on capital`}
          />
          <Kpi
            label="Premium collected"
            tone="pos"
            icon={Coins}
            value={usd(totalPremium)}
            sub="Credits taken in across all buckets"
          />
          <Kpi
            label="Capital at risk"
            tone="gold"
            icon={ShieldCheck}
            value={usd(totalCapital)}
            sub="Collateral + defined-risk on open positions"
          />
          <Kpi
            label="Positions"
            icon={Wallet}
            value={String(totalPositions)}
            sub={`${openPositions} open · ${totalPositions - openPositions} closed`}
          />
        </div>
      </section>

      {/* ---- Per-strategy breakdown — ranked best→worst ---- */}
      <section>
        <SectionTitle
          title="By strategy"
          sub="Ranked by realized P&L, best performer first. The bar shows each bucket's share of the total."
        />

        {/* Desktop: comparison table with inline bars */}
        <Card pad={false} className="hidden overflow-hidden md:block">
          <table className="w-full">
            <thead className="border-b border-white/5 bg-white/[0.02]">
              <tr>
                <th className="th">Strategy</th>
                <th className="th">Realized P&L</th>
                <th className="th text-right">Premium</th>
                <th className="th text-right">Capital</th>
                <th className="th text-right">ROI</th>
                <th className="th text-right">Positions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {breakdown.map((b) => (
                <StrategyRow key={b.key} b={b} maxAbs={maxAbsRealized} />
              ))}
            </tbody>
          </table>
        </Card>

        {/* Mobile: stacked cards — no horizontal scroll */}
        <div className="space-y-3 md:hidden">
          {breakdown.map((b) => (
            <StrategyCard key={b.key} b={b} maxAbs={maxAbsRealized} />
          ))}
        </div>
      </section>

      {/* ---- Positions detail — the legs behind each strategy ---- */}
      <section>
        <SectionTitle
          title="Positions"
          sub="Each entry is one position: multi-leg spreads grouped into a single unit. Expand to see the legs."
          right={
            <label className="relative inline-flex">
              <span className="sr-only">Filter positions by strategy</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input w-auto py-1.5 text-xs"
              >
                <option value="ALL">All strategies</option>
                {breakdown.map((b) => (
                  <option key={b.key} value={b.key}>
                    {strategyLabel(b.key)} ({b.positions})
                  </option>
                ))}
              </select>
            </label>
          }
        />

        {filteredPositions.length === 0 ? (
          <EmptyState
            compact
            icon={Layers}
            title="No positions in this strategy"
            sub="Switch the filter back to All strategies to see every position."
            action={{ label: "Show all", onClick: () => setFilter("ALL") }}
          />
        ) : (
          <div className="space-y-2.5">
            {filteredPositions.map((p) => (
              <PositionRow key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Header({ strategyCount }: { strategyCount: number }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Strategies</h1>
        {strategyCount > 0 && (
          <span className="chip bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10">
            <Layers size={12} />
            {strategyCount} {strategyCount === 1 ? "bucket" : "buckets"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        See your P&L for each strategy and all of them combined, so you know both the total and{" "}
        <strong className="font-semibold text-slate-300">which strategy is actually working</strong>.
        Tag any trade's strategy from its detail drawer on the{" "}
        <a href="#/trades" className="text-flux-400 hover:underline">
          Trades
        </a>{" "}
        page.
      </p>
    </div>
  );
}

// ---- per-strategy comparison bar (shared by table + cards) -----------------

function CompareBar({ b, maxAbs }: { b: StrategyBreakdown; maxAbs: number }) {
  const tone = strategyTone(b.key);
  const pctWidth = Math.min(100, (Math.abs(b.realized) / maxAbs) * 100);
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/5"
      role="img"
      aria-label={`${strategyLabel(b.key)} realized ${usd(b.realized)}`}
    >
      <div
        className={cls("h-full rounded-full", BAR_BG[tone])}
        style={{ width: `${pctWidth}%` }}
      />
    </div>
  );
}

function StrategyRow({ b, maxAbs }: { b: StrategyBreakdown; maxAbs: number }) {
  const def = strategyDef(b.key);
  return (
    <tr className="hover:bg-white/[0.025]">
      <td className="td">
        <div className="flex items-center gap-2">
          <Pill tone={def.tone === "slate" ? "slate" : def.tone}>{def.label}</Pill>
        </div>
        <div className="mt-1.5 max-w-[220px]">
          <CompareBar b={b} maxAbs={maxAbs} />
          <div className="mt-1 num text-[11px] text-slate-500">
            {pct(Math.abs(b.shareOfRealized))} of total
          </div>
        </div>
      </td>
      <td className="td">
        <Delta dir={deltaDir(b.realized)} value={usd(Math.abs(b.realized))} size="base" weight="bold" />
      </td>
      <td className="td text-right num text-flux-400">{usd(b.premium)}</td>
      <td className="td text-right num text-slate-300">
        {b.capitalAtRisk > 0 ? usd(b.capitalAtRisk) : <span className="text-slate-600">—</span>}
      </td>
      <td className="td text-right">
        {b.capitalAtRisk > 0 ? (
          <Delta dir={deltaDir(b.roi)} value={pct(Math.abs(b.roi))} size="sm" />
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="td text-right num text-slate-300">
        {b.positions}
        {b.openPositions > 0 && (
          <span className="ml-1 text-[11px] text-sky-300">· {b.openPositions} open</span>
        )}
      </td>
    </tr>
  );
}

function StrategyCard({ b, maxAbs }: { b: StrategyBreakdown; maxAbs: number }) {
  const def = strategyDef(b.key);
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Pill tone={def.tone === "slate" ? "slate" : def.tone}>{def.label}</Pill>
          <div className="mt-1.5 num text-[11px] text-slate-500">
            {b.positions} {b.positions === 1 ? "position" : "positions"}
            {b.openPositions > 0 && ` · ${b.openPositions} open`}
            {" · "}
            {pct(Math.abs(b.shareOfRealized))} of total
          </div>
        </div>
        <Delta dir={deltaDir(b.realized)} value={usd(Math.abs(b.realized))} size="base" weight="bold" className="shrink-0" />
      </div>
      <div className="mt-2.5">
        <CompareBar b={b} maxAbs={maxAbs} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="Premium" value={usd(b.premium)} tone="pos" />
        <MiniStat
          label="Capital"
          value={b.capitalAtRisk > 0 ? usd(b.capitalAtRisk) : "—"}
        />
        <MiniStat
          label="ROI"
          value={b.capitalAtRisk > 0 ? pct(b.roi) : "—"}
        />
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "pos" }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cls("num mt-0.5 font-semibold", tone === "pos" ? "text-flux-400" : "text-slate-200")}>
        {value}
      </div>
    </div>
  );
}

// ---- position detail (drill-down) ------------------------------------------

function PositionRow({ p }: { p: Position }) {
  const [open, setOpen] = useState(false);
  const def = strategyDef(p.strategy);
  const credit = p.netCredit >= 0;

  return (
    <Card pad={false} className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-flux-500/40"
      >
        <ChevronDown
          size={16}
          className={cls(
            "shrink-0 text-slate-500 transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-100">{p.ticker}</span>
            <Pill tone={def.tone === "slate" ? "slate" : def.tone}>{def.label}</Pill>
            {p.open ? (
              <Pill tone="blue">Open</Pill>
            ) : (
              <span className="text-[11px] text-slate-500">Closed</span>
            )}
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-500">
            <span className="num">{legSummary(p.legs)}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            {fmtDate(p.openDate)}
            {p.closeDate && (
              <>
                <span className="mx-1 text-slate-600">→</span>
                {fmtDate(p.closeDate)}
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="stat-label">Realized</div>
          <Delta dir={deltaDir(p.realized)} value={usd(Math.abs(p.realized))} size="base" weight="bold" className="justify-end" />
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 px-3.5 pb-3.5 pt-3">
          {/* defined-risk + entry facts */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DetailFact
              label={credit ? "Net credit" : "Net debit"}
              value={usd(Math.abs(p.netCredit))}
              tone={credit ? "pos" : "neg"}
            />
            {p.maxProfit != null && (
              <DetailFact label="Max profit" value={usd(p.maxProfit)} tone="pos" />
            )}
            {p.maxLoss != null && (
              <DetailFact label="Max loss" value={usd(p.maxLoss)} tone="neg" />
            )}
            {p.width != null && <DetailFact label="Width" value={usd(p.width)} />}
            {p.breakevens.length > 0 && (
              <DetailFact
                label={p.breakevens.length > 1 ? "Breakevens" : "Breakeven"}
                value={p.breakevens.map((b) => "$" + b).join(" / ")}
              />
            )}
            {p.capitalAtRisk > 0 && (
              <DetailFact label="Capital at risk" value={usd(p.capitalAtRisk)} tone="gold" />
            )}
          </div>

          {/* legs */}
          <div className="mt-3">
            <div className="stat-label mb-1.5 flex items-center gap-1.5">
              <ListTree size={13} className="text-slate-500" />
              {p.legs.length} {p.legs.length === 1 ? "leg" : "legs"}
            </div>
            <ul className="space-y-1.5">
              {p.legs.map((l) => (
                <LegRow key={l.id} l={l} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function LegRow({ l }: { l: Trade }) {
  const credit = l.side === "credit";
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs">
      <span className="w-[68px] shrink-0 text-[11px] text-slate-500">{fmtDate(l.date)}</span>
      <span className="shrink-0 font-semibold text-slate-200">{legVerb(l)}</span>
      <span className="num shrink-0 text-slate-400">{legContract(l)}</span>
      {l.status && <span className="text-[11px] text-slate-500">{l.status}</span>}
      <span className="flex flex-1 justify-end">
        <Delta dir={credit ? "up" : "down"} value={usd(l.amount)} size="xs" />
      </span>
    </li>
  );
}

// ---- leg label helpers -----------------------------------------------------

/** Human verb for a leg's action: SELL / BUY (open) and the close direction. */
function legVerb(l: Trade): string {
  switch (l.action) {
    case "CSP":
    case "CC":
    case "STO":
      return "SELL";
    case "BTO":
      return "BUY";
    case "BB":
    case "BTC":
      return "BUY back";
    case "STC":
      return "SELL close";
    case "AAssignSTK":
      return "ASSIGN";
    default:
      return l.side === "credit" ? "SELL" : "BUY";
  }
}

/** Strike + type for a leg, e.g. "44P", "53C", or shares for assignment. */
function legContract(l: Trade): string {
  if (l.action === "AAssignSTK") return `${l.shares} sh`;
  const k = l.strike != null ? l.strike : null;
  const t =
    l.optionType === "put" ? "P" : l.optionType === "call" ? "C" : "";
  if (k == null && !t) return l.action;
  return `${k != null ? "$" + k : ""}${t}`;
}

/** One-line spread summary for the collapsed row, e.g. "SELL $44P / BUY $41P". */
function legSummary(legs: Trade[]): string {
  const opens = legs.filter(
    (l) => l.action === "STO" || l.action === "BTO" || l.action === "CSP" || l.action === "CC"
  );
  const shown = opens.length ? opens : legs;
  return shown.map((l) => `${legVerb(l)} ${legContract(l)}`).join(" / ");
}

function DetailFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "gold";
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
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cls("num mt-0.5 text-sm font-bold", toneCls)}>{value}</div>
    </div>
  );
}
