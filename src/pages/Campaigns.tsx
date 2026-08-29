import { useMemo, useState } from "react";
import {
  CircleDashed,
  Coins,
  Layers,
  ShieldCheck,
  Sparkles,
  Check,
  ChevronDown,
  ListTree,
  Scissors,
  MinusCircle,
  RotateCcw,
  ArrowRightLeft,
  Upload,
} from "lucide-react";
import { useStore } from "../data/store";
import { computeWheels, WHEEL_EXCLUDED, type Wheel } from "../data/compute";
import { Card, Pill, Bar, EmptyState, Delta, deltaDir } from "../components/ui";
import { ActionPill } from "./Dashboard";
import { usd, fmtDate, cls } from "../lib/format";
import type { Trade } from "../types";

// ---------------------------------------------------------------------------
// Per-cycle Wheels. The compute engine auto-detects one wheel per Wheel cycle
// (sell puts → assigned → sell calls → called away → flat) and the user
// confirms or adjusts which trades belong. All four operations (confirm,
// exclude, reset-to-auto, move/split) map to setting `trade.wheelId` via the
// store's updateTrade — computeWheels reflows on the next render.
// ---------------------------------------------------------------------------

export default function Campaigns() {
  const { dataset, updateTrade } = useStore();
  const wheels = useMemo(() => computeWheels(dataset), [dataset]);

  const totalPremium = wheels.reduce((a, w) => a + w.premiumCollected, 0);
  const suggestedCount = wheels.filter((w) => w.auto).length;

  // Trades the user has explicitly pulled out of any wheel — surfaced at the
  // bottom so an exclude is never a dead end; each can be reset to auto.
  const excluded = useMemo(
    () => dataset.trades.filter((t) => t.wheelId === WHEEL_EXCLUDED),
    [dataset.trades]
  );

  // Confirmed wheels the user can MERGE / MOVE a trade into. Only real
  // (non-auto) wheels of the same ticker are valid move targets.
  const confirmedByTicker = useMemo(() => {
    const m = new Map<string, Wheel[]>();
    for (const w of wheels) {
      if (w.auto) continue;
      (m.get(w.ticker) ?? m.set(w.ticker, []).get(w.ticker)!).push(w);
    }
    return m;
  }, [wheels]);

  // Group wheels under their ticker, ordered by ticker then start date.
  const groups = useMemo(() => {
    const m = new Map<string, Wheel[]>();
    for (const w of wheels) (m.get(w.ticker) ?? m.set(w.ticker, []).get(w.ticker)!).push(w);
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ticker, ws]) => [ticker, ws.sort((a, b) => a.startDate.localeCompare(b.startDate))] as const);
  }, [wheels]);

  // --- the four operations -------------------------------------------------

  /** Confirm an auto suggestion: stamp every trade in it with one fresh id. */
  function confirmWheel(w: Wheel): string {
    const id = "w-" + crypto.randomUUID();
    for (const tid of w.tradeIds) updateTrade(tid, { wheelId: id });
    return id;
  }

  /** Drop one trade out of every wheel. */
  function excludeTrade(tid: string) {
    updateTrade(tid, { wheelId: WHEEL_EXCLUDED });
  }

  /** Return a trade to auto-detection. */
  function resetTrade(tid: string) {
    updateTrade(tid, { wheelId: null });
  }

  /** Split one trade into a brand-new wheel of its own. */
  function splitTrade(tid: string) {
    updateTrade(tid, { wheelId: "w-" + crypto.randomUUID() });
  }

  /** Move a trade into another (confirmed) wheel. If the source wheel is still
   *  an auto suggestion, confirm the rest of it first so the remaining trades
   *  don't silently re-shuffle. */
  function moveTrade(tid: string, from: Wheel, targetId: string) {
    if (from.auto) {
      const id = "w-" + crypto.randomUUID();
      for (const other of from.tradeIds) if (other !== tid) updateTrade(other, { wheelId: id });
    }
    updateTrade(tid, { wheelId: targetId });
  }

  if (wheels.length === 0 && excluded.length === 0) {
    return (
      <div className="space-y-5">
        <Header suggestedCount={0} />
        <EmptyState
          icon={CircleDashed}
          title="No wheels turning yet"
          sub="Once you log a sold put, Flywheel auto-detects the wheel cycle it kicks off (sell puts, get assigned, sell calls, get called away) and shows it here for you to confirm."
          action={{ label: "Import your trades", to: "/import", icon: Upload }}
          secondaryAction={{ label: "View all trades", to: "/trades" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header suggestedCount={suggestedCount} />

      {groups.map(([ticker, ws]) => (
        <section key={ticker} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{ticker}</h2>
            <span className="text-xs text-slate-500">
              {ws.length} {ws.length === 1 ? "wheel" : "wheels"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ws.map((w) => (
              <WheelCard
                key={w.id}
                w={w}
                dataset={dataset}
                totalPremium={totalPremium}
                moveTargets={(confirmedByTicker.get(ticker) ?? []).filter((t) => t.id !== w.id)}
                onConfirm={() => confirmWheel(w)}
                onExclude={excludeTrade}
                onReset={resetTrade}
                onSplit={splitTrade}
                onMove={(tid, targetId) => moveTrade(tid, w, targetId)}
              />
            ))}
          </div>
        </section>
      ))}

      {excluded.length > 0 && (
        <ExcludedTrades trades={excluded} onReset={resetTrade} />
      )}
    </div>
  );
}

function Header({ suggestedCount }: { suggestedCount: number }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Wheels</h1>
        {suggestedCount > 0 && (
          <span className="chip ring-1 ring-inset bg-flux-500/10 text-flux-300 ring-flux-500/25">
            <Sparkles size={12} />
            {suggestedCount} suggested
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Each <strong className="font-semibold text-slate-300">wheel</strong> is one cycle: sell
        puts, maybe get assigned, sell calls, get called away. Flywheel detects them automatically;
        confirm the ones that look right, and adjust any trade that landed in the wrong cycle.
      </p>
    </div>
  );
}

function WheelCard({
  w,
  dataset,
  totalPremium,
  moveTargets,
  onConfirm,
  onExclude,
  onReset,
  onSplit,
  onMove,
}: {
  w: Wheel;
  dataset: { trades: Trade[] };
  totalPremium: number;
  moveTargets: Wheel[];
  onConfirm: () => void;
  onExclude: (tid: string) => void;
  onReset: (tid: string) => void;
  onSplit: (tid: string) => void;
  onMove: (tid: string, targetId: string) => void;
}) {
  const [showTrades, setShowTrades] = useState(false);
  const holding = w.sharesHeld > 0;
  const statusTone =
    w.status === "Holding shares" ? "gold" : w.status === "Selling puts" ? "green" : "slate";

  const trades = useMemo(() => {
    const byId = new Map(dataset.trades.map((t) => [t.id, t] as const));
    return w.tradeIds
      .map((id) => byId.get(id))
      .filter((t): t is Trade => !!t)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dataset.trades, w.tradeIds]);

  return (
    <Card
      className={cls(
        "relative flex flex-col overflow-hidden transition-colors",
        w.auto && "border-dashed border-white/15 bg-ink-850/40"
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 opacity-[0.06]">
        <CircleDashed
          size={120}
          className={cls("text-flux-400", !w.auto && "animate-spinslow")}
        />
      </div>

      {/* Suggested banner — the headline "is this a wheel?" affordance */}
      {w.auto && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-flux-500/20 bg-flux-500/[0.07] px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-flux-300">
            <Sparkles size={13} className="shrink-0" />
            Auto-detected cycle. Confirm this is one wheel?
          </span>
          <button
            onClick={onConfirm}
            className="btn-primary h-7 gap-1.5 px-3 py-0 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
          >
            <Check size={14} />
            Confirm wheel
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-extrabold tracking-tight text-slate-50">{w.ticker}</h3>
            <Pill tone={statusTone as any}>{w.status}</Pill>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {fmtDate(w.startDate)} → {fmtDate(w.endDate)} · {w.contracts}{" "}
            {w.contracts === 1 ? "contract" : "contracts"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="stat-label">Premium</div>
          <div className="num text-lg font-bold text-flux-400">{usd(w.premiumCollected)}</div>
        </div>
      </div>

      {/* Share of total premium across all wheels */}
      <div className="mt-3">
        <Bar value={w.premiumCollected} max={totalPremium} tone="green" />
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Stat
          icon={<Coins size={14} />}
          label="Realized"
          value={
            <Delta
              dir={deltaDir(w.realized)}
              value={usd(Math.abs(w.realized))}
              size="base"
              weight="bold"
            />
          }
        />
        <Stat
          icon={<Layers size={14} />}
          label="Assigned"
          value={String(w.putsAssigned)}
          sub={w.calledAway > 0 ? `${w.calledAway} called away` : "puts assigned"}
        />
        <Stat
          icon={<ShieldCheck size={14} />}
          label={holding ? "Cost basis" : "Capital risk"}
          value={holding ? usd(w.costBasis) : usd(w.capitalAtRisk)}
          sub={holding ? `${w.sharesHeld} sh held` : w.capitalAtRisk > 0 ? "deployed" : "flat"}
        />
      </div>

      {/* Holding detail */}
      {holding && (
        <div className="mt-4 rounded-xl border border-torque-500/15 bg-torque-500/[0.06] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Holding {w.sharesHeld} sh · last {usd(w.lastPrice)} · basis {usd(w.costBasis)}
            </span>
            <Delta
              dir={deltaDir(w.unrealized)}
              value={`${usd(Math.abs(w.unrealized))} unreal.`}
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Adjust — progressive disclosure of this wheel's trades */}
      <div className="mt-4 border-t border-white/5 pt-3">
        <button
          onClick={() => setShowTrades((v) => !v)}
          aria-expanded={showTrades}
          className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-medium text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
        >
          <span className="flex items-center gap-1.5">
            <ListTree size={13} />
            {trades.length} {trades.length === 1 ? "trade" : "trades"} in this wheel
          </span>
          <ChevronDown
            size={15}
            className={cls("transition-transform motion-reduce:transition-none", showTrades && "rotate-180")}
          />
        </button>

        {showTrades && (
          <ul className="mt-2 space-y-1.5">
            {trades.map((t) => (
              <TradeRow
                key={t.id}
                t={t}
                canExclude={trades.length > 1}
                moveTargets={moveTargets}
                onExclude={() => onExclude(t.id)}
                onReset={() => onReset(t.id)}
                onSplit={() => onSplit(t.id)}
                onMove={(targetId) => onMove(t.id, targetId)}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TradeRow({
  t,
  canExclude,
  moveTargets,
  onExclude,
  onReset,
  onSplit,
  onMove,
}: {
  t: Trade;
  canExclude: boolean;
  moveTargets: Wheel[];
  onExclude: () => void;
  onReset: () => void;
  onSplit: () => void;
  onMove: (targetId: string) => void;
}) {
  const credit = t.side === "credit";
  // A trade is "pinned" (manually placed) when it carries a real wheel id.
  const pinned = !!t.wheelId && t.wheelId !== "__none__";
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <span className="w-[68px] shrink-0 text-[11px] text-slate-500">{fmtDate(t.date)}</span>
      <ActionPill action={t.action} />
      <span className="min-w-0 flex-1 justify-end">
        <Delta dir={credit ? "up" : "down"} value={usd(t.amount)} size="xs" className="float-right" />
      </span>

      {/* Move into another confirmed wheel of this ticker */}
      {moveTargets.length > 0 && (
        <label className="relative inline-flex">
          <span className="sr-only">Move trade to another wheel</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value);
            }}
            title="Move to another wheel"
            className="h-7 cursor-pointer rounded-lg border border-white/10 bg-ink-900/80 pl-1.5 pr-6 text-[11px] text-slate-300 outline-none transition hover:border-white/20 focus-visible:ring-2 focus-visible:ring-flux-500/30"
          >
            <option value="" disabled>
              Move…
            </option>
            {moveTargets.map((m, i) => (
              <option key={m.id} value={m.id}>
                Wheel #{i + 1} ({fmtDate(m.startDate)})
              </option>
            ))}
          </select>
          <ArrowRightLeft
            size={11}
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </label>
      )}

      <IconBtn label="Split into its own wheel" onClick={onSplit}>
        <Scissors size={13} />
      </IconBtn>

      {pinned && (
        <IconBtn label="Reset to auto-detect" onClick={onReset}>
          <RotateCcw size={13} />
        </IconBtn>
      )}

      {canExclude && (
        <IconBtn label="Exclude from this wheel" tone="loss" onClick={onExclude}>
          <MinusCircle size={13} />
        </IconBtn>
      )}
    </li>
  );
}

function IconBtn({
  children,
  label,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  tone?: "loss";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cls(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
        tone === "loss" ? "hover:text-loss-400" : "hover:text-slate-100"
      )}
    >
      {children}
    </button>
  );
}

function ExcludedTrades({ trades, onReset }: { trades: Trade[]; onReset: (tid: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Excluded</h2>
        <span className="text-xs text-slate-500">
          {trades.length} {trades.length === 1 ? "trade" : "trades"} held out of any wheel
        </span>
      </div>
      <Card>
        <ul className="space-y-1.5">
          {trades
            .slice()
            .sort((a, b) => a.ticker.localeCompare(b.ticker) || b.date.localeCompare(a.date))
            .map((t) => {
              const credit = t.side === "credit";
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5"
                >
                  <span className="w-12 shrink-0 text-xs font-semibold text-slate-300">
                    {t.ticker}
                  </span>
                  <span className="w-[68px] shrink-0 text-[11px] text-slate-500">
                    {fmtDate(t.date)}
                  </span>
                  <ActionPill action={t.action} />
                  <span className="flex flex-1 justify-end">
                    <Delta dir={credit ? "up" : "down"} value={usd(t.amount)} size="xs" />
                  </span>
                  <button
                    onClick={() => onReset(t.id)}
                    className="btn h-7 gap-1.5 border border-white/10 px-2.5 py-0 text-[11px] text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
                    title="Return this trade to auto-detection"
                  >
                    <RotateCcw size={12} />
                    Reset to auto
                  </button>
                </li>
              );
            })}
        </ul>
      </Card>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div
        className={cls(
          "mt-1 num font-bold",
          tone === "pos" ? "text-flux-400" : tone === "neg" ? "text-loss-400" : "text-slate-100"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}
