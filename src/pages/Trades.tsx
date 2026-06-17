import { useMemo, useState } from "react";
import { Search, Trash2, ArrowUpDown, StickyNote, BookOpen, CircleDashed, Sparkles, MinusCircle, RotateCcw, Receipt, Upload, ChevronRight, Layers } from "lucide-react";
import { useStore } from "../data/store";
import {
  filterByTimeframe,
  TIMEFRAMES,
  type Timeframe,
  isCredit,
  computeWheels,
  computePositions,
  WHEEL_EXCLUDED,
  type Wheel,
  type Position,
} from "../data/compute";
import {
  STRATEGY_DEFS,
  strategyLabel,
  strategyTone,
} from "../data/strategies";
import { Card, Pill, Delta, deltaDir, EmptyState } from "../components/ui";
import { Drawer } from "../components/Drawer";
import { NoteEditor } from "../components/NoteEditor";
import { ActionPill } from "./Dashboard";
import { usd, fmtDate, cls } from "../lib/format";
import { hasJournalNote, parseNote } from "../lib/notes";
import type { Trade } from "../types";

type SortKey = "date" | "ticker" | "amount";

export default function Trades() {
  const { dataset, updateTrade, deleteTrade } = useStore();
  const [tf, setTf] = useState<Timeframe>("ALL");
  const [q, setQ] = useState("");
  const [strat, setStrat] = useState<string>("ALL");
  const [notesOnly, setNotesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    let t = filterByTimeframe(dataset.trades, tf);
    if (strat !== "ALL") t = t.filter((x) => x.action === strat);
    if (notesOnly) t = t.filter((x) => hasJournalNote(x.note));
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
  }, [dataset.trades, tf, strat, notesOnly, q, sort, dir]);

  const credits = rows.filter(isCredit).reduce((a, t) => a + t.amount, 0);
  const debits = rows.filter((t) => !isCredit(t)).reduce((a, t) => a + t.amount, 0);
  const notedCount = useMemo(
    () => dataset.trades.filter((t) => hasJournalNote(t.note)).length,
    [dataset.trades]
  );

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(-1);
    }
  };

  const wheels = useMemo(() => computeWheels(dataset), [dataset]);
  const positions = useMemo(() => computePositions(dataset), [dataset]);
  const openTrade = openId ? dataset.trades.find((t) => t.id === openId) : undefined;
  const openWheel = openTrade ? wheels.find((w) => w.tradeIds.includes(openTrade.id)) : undefined;
  const openPosition = openTrade
    ? positions.find((p) => p.legs.some((l) => l.id === openTrade.id))
    : undefined;

  /** Apply a strategy to every leg of a position (keeps spreads consistent). */
  function setStrategy(strategy: string | null) {
    if (!openTrade) return;
    const legs = openPosition ? openPosition.legs : [openTrade];
    legs.forEach((l) => updateTrade(l.id, { strategy }));
  }

  const net = credits - debits;
  const hasTrades = dataset.trades.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Trades</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
          <span>
            {rows.length} {rows.length === 1 ? "trade" : "trades"}
            {rows.length !== dataset.trades.length && ` of ${dataset.trades.length}`}
          </span>
          <span className="text-slate-600">·</span>
          <Delta dir="up" value={`${usd(credits)} collected`} icon={false} size="sm" />
          <span className="text-slate-600">·</span>
          <Delta dir="down" value={`${usd(debits)} paid`} icon={false} size="sm" />
          <span className="text-slate-600">·</span>
          <Delta
            dir={deltaDir(net)}
            value={`${usd(Math.abs(net))} net`}
            size="sm"
          />
        </div>
      </div>

      {!hasTrades && (
        <EmptyState
          icon={Receipt}
          title="No trades logged yet"
          sub="Every sold put, covered call, buyback, and assignment shows up here — sortable, searchable, and ready to journal. Import your broker history to populate it."
          action={{ label: "Import your trades", to: "/import", icon: Upload }}
          secondaryAction={{ label: "See the dashboard", to: "/" }}
        />
      )}

      {hasTrades && (
        <>
      {/* Filters */}
      <Card pad={false} className="p-3">
        <div className="flex flex-wrap items-center gap-2.5">
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
          <button
            onClick={() => setNotesOnly((v) => !v)}
            aria-pressed={notesOnly}
            className={cls(
              "btn h-[38px] gap-1.5 border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
              notesOnly
                ? "border-flux-500/40 bg-flux-500/10 text-flux-300"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            )}
            title="Show only trades you've journaled"
          >
            <BookOpen size={15} />
            Journal
            {notedCount > 0 && (
              <span
                className={cls(
                  "num rounded-full px-1.5 text-[11px]",
                  notesOnly ? "bg-flux-500/20" : "bg-white/10 text-slate-400"
                )}
              >
                {notedCount}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-ink-900/60 p-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                aria-pressed={tf === t}
                className={cls(
                  "rounded-lg px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
                  tf === t ? "bg-flux-500 text-ink-950" : "text-slate-400 hover:text-slate-100"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title="No trades match these filters"
          sub={
            notesOnly
              ? "No journaled trades in this view. Clear the Journal filter, or open any trade to add a note."
              : "Try a different timeframe, strategy, or search term."
          }
          action={{
            label: "Clear filters",
            onClick: () => {
              setQ("");
              setStrat("ALL");
              setNotesOnly(false);
              setTf("ALL");
            },
          }}
        />
      ) : (
        <>
          {/* Desktop / tablet: full table */}
          <Card pad={false} className="hidden overflow-hidden md:block">
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
                    <Row
                      key={t.id}
                      t={t}
                      onOpen={() => setOpenId(t.id)}
                      onDelete={() => deleteTrade(t.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: stacked cards — no horizontal scroll, full detail per row */}
          <div className="space-y-2 md:hidden">
            <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Sort</span>
              <div className="flex items-center gap-1">
                <MobileSortBtn label="Date" active={sort === "date"} dir={dir} onClick={() => toggleSort("date")} />
                <MobileSortBtn label="Ticker" active={sort === "ticker"} dir={dir} onClick={() => toggleSort("ticker")} />
                <MobileSortBtn label="Amount" active={sort === "amount"} dir={dir} onClick={() => toggleSort("amount")} />
              </div>
            </div>
            {rows.map((t) => (
              <TradeCard
                key={t.id}
                t={t}
                onOpen={() => setOpenId(t.id)}
                onDelete={() => deleteTrade(t.id)}
              />
            ))}
          </div>
        </>
      )}
        </>
      )}

      {/* Trade detail / journal drawer */}
      <Drawer
        open={!!openTrade}
        onClose={() => setOpenId(null)}
        title={openTrade ? `${openTrade.ticker} · ${fmtDate(openTrade.date)}` : ""}
        sub={openTrade ? actionLabel(openTrade.action) : ""}
      >
        {openTrade && (
          <TradeDetail
            t={openTrade}
            wheel={openWheel}
            position={openPosition}
            onSaveNote={(note) => updateTrade(openTrade.id, { note })}
            onExcludeWheel={() => updateTrade(openTrade.id, { wheelId: WHEEL_EXCLUDED })}
            onResetWheel={() => updateTrade(openTrade.id, { wheelId: null })}
            onSetStrategy={setStrategy}
          />
        )}
      </Drawer>
    </div>
  );
}

function actionLabel(a: string): string {
  return (
    {
      CSP: "Cash-secured put",
      CC: "Covered call",
      BB: "Buyback",
      AAssignSTK: "Assignment",
    } as Record<string, string>
  )[a] ?? a;
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

function Row({ t, onOpen, onDelete }: { t: Trade; onOpen: () => void; onDelete: () => void }) {
  const credit = t.side === "credit";
  const noted = hasJournalNote(t.note);
  const statusTone: any =
    t.status === "Assigned" ? "gold" : t.status === "Open" ? "blue" : t.status ? "slate" : "slate";
  return (
    <tr
      className="group cursor-pointer hover:bg-white/[0.025]"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <td className="td whitespace-nowrap text-slate-400">{fmtDate(t.date)}</td>
      <td className="td font-semibold text-slate-100">
        <span className="inline-flex items-center gap-1.5">
          {t.ticker}
          {noted && (
            <StickyNote size={13} className="text-flux-400" aria-label="Has a journal note" />
          )}
        </span>
      </td>
      <td className="td"><ActionPill action={t.action} /></td>
      <td className="td">
        {t.status ? <Pill tone={statusTone}>{t.status}</Pill> : <span className="text-slate-600">—</span>}
      </td>
      <td className="td text-right num text-slate-400">{t.shares}</td>
      <td className="td text-right">
        <Delta
          dir={credit ? "up" : "down"}
          value={usd(t.amount)}
          size="base"
          className="justify-end"
        />
      </td>
      <td className="td text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-loss-400 focus-visible:opacity-100 focus-visible:outline-none"
          title="Delete trade"
          aria-label="Delete trade"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

// ---- mobile presentation ---------------------------------------------------

function MobileSortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cls(
        "inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold normal-case tracking-normal transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
        active ? "bg-flux-500/15 text-flux-300" : "text-slate-400 hover:text-slate-200"
      )}
    >
      {label}
      <ArrowUpDown
        size={11}
        className={cls(active ? "text-flux-400" : "text-slate-600", active && dir === 1 && "rotate-180")}
      />
    </button>
  );
}

function TradeCard({ t, onOpen, onDelete }: { t: Trade; onOpen: () => void; onDelete: () => void }) {
  const credit = t.side === "credit";
  const noted = hasJournalNote(t.note);
  const statusTone: any =
    t.status === "Assigned" ? "gold" : t.status === "Open" ? "blue" : "slate";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="card group flex cursor-pointer items-center gap-3 p-3 transition-colors hover:border-flux-500/30 focus-visible:border-flux-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{t.ticker}</span>
          <ActionPill action={t.action} />
          {noted && <StickyNote size={13} className="text-flux-400" aria-label="Has a journal note" />}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
          <span>{fmtDate(t.date)}</span>
          {t.status && (
            <>
              <span className="text-slate-600">·</span>
              <span className={cls(
                statusTone === "gold" ? "text-torque-300" : statusTone === "blue" ? "text-sky-300" : "text-slate-400"
              )}>{t.status}</span>
            </>
          )}
          {t.shares > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="num">{t.shares} sh</span>
            </>
          )}
        </div>
      </div>
      <Delta dir={credit ? "up" : "down"} value={usd(t.amount)} size="base" weight="bold" className="shrink-0" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-white/5 hover:text-loss-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
        title="Delete trade"
        aria-label="Delete trade"
      >
        <Trash2 size={15} />
      </button>
      <ChevronRight size={16} className="-ml-1 shrink-0 text-slate-600 transition group-hover:text-slate-300" aria-hidden="true" />
    </div>
  );
}

function TradeDetail({
  t,
  wheel,
  position,
  onSaveNote,
  onExcludeWheel,
  onResetWheel,
  onSetStrategy,
}: {
  t: Trade;
  wheel: Wheel | undefined;
  position: Position | undefined;
  onSaveNote: (note: string | null) => void;
  onExcludeWheel: () => void;
  onResetWheel: () => void;
  onSetStrategy: (strategy: string | null) => void;
}) {
  const credit = t.side === "credit";
  const earn = parseNote(t.note).earn;
  return (
    <div className="space-y-5">
      {/* facts grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {credit ? "Premium in" : "Cash out"}
          </div>
          <Delta dir={credit ? "up" : "down"} value={usd(t.amount)} size="base" weight="bold" className="mt-0.5" />
        </div>
        <Fact label="Shares" value={String(t.shares)} />
        {t.strike != null && <Fact label="Strike" value={"$" + t.strike} />}
        {t.expiry && <Fact label="Expiry" value={fmtDate(t.expiry)} />}
        {t.invested != null && <Fact label="Invested" value={usd(t.invested)} tone="gold" />}
        {t.status && <Fact label="Status" value={t.status} />}
      </div>

      {/* strategy bucket */}
      <StrategySection trade={t} position={position} onSetStrategy={onSetStrategy} />

      {/* wheel membership */}
      <WheelSection trade={t} wheel={wheel} onExclude={onExcludeWheel} onReset={onResetWheel} />

      {earn && (
        <div className="rounded-xl border border-torque-500/20 bg-torque-500/5 px-3 py-2 text-xs text-torque-300">
          Earnings flagged for <span className="num font-semibold">{fmtDate(earn)}</span> (set on the
          Earnings Radar). Editing the note below keeps this flag intact.
        </div>
      )}

      {/* journal note */}
      <div>
        <div className="stat-label mb-2 flex items-center gap-1.5">
          <StickyNote size={13} className="text-flux-400" />
          Journal note
        </div>
        <NoteEditor trade={t} onSave={onSaveNote} />
      </div>
    </div>
  );
}

const CUSTOM_OPTION = "__custom__";

function StrategySection({
  trade,
  position,
  onSetStrategy,
}: {
  trade: Trade;
  position: Position | undefined;
  onSetStrategy: (strategy: string | null) => void;
}) {
  // Effective strategy = the position's resolved strategy (auto-detected when
  // the user hasn't set one). `trade.strategy` truthy = user-confirmed override.
  const effective = position?.strategy ?? trade.strategy ?? "other";
  const isAuto = !trade.strategy;
  const tone = strategyTone(effective);
  const isMultiLeg = !!position?.isMultiLeg;

  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");

  function applyCustom() {
    const name = customName.trim();
    if (!name) return;
    onSetStrategy(name);
    setCustomMode(false);
    setCustomName("");
  }

  // The select reflects an explicit predefined choice; custom buckets sit in the
  // free-text field instead, so the dropdown shows "Custom…" when one is active.
  const selectValue = isAuto
    ? ""
    : STRATEGY_DEFS.some((d) => d.key === trade.strategy)
    ? (trade.strategy as string)
    : CUSTOM_OPTION;

  return (
    <div>
      <div className="stat-label mb-2 flex items-center gap-1.5">
        <Layers size={13} className="text-flux-400" />
        Strategy
      </div>

      <div
        className={cls(
          "rounded-xl border p-3",
          isAuto ? "border-dashed border-flux-500/25 bg-flux-500/[0.05]" : "border-white/10 bg-white/[0.03]"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Pill tone={tone === "slate" ? "slate" : tone}>{strategyLabel(effective)}</Pill>
          {isAuto ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-flux-300">
              <Sparkles size={12} />
              Auto-detected
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">Confirmed</span>
          )}
        </div>

        {isMultiLeg && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Part of a {position!.legs.length}-leg position — changing the strategy applies to all
            legs so the spread stays consistent.
          </p>
        )}

        {/* Override control */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {customMode ? (
            <>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                placeholder="Custom bucket name…"
                autoFocus
                className="input h-8 flex-1 py-0 text-xs"
                aria-label="Custom strategy bucket name"
              />
              <button
                onClick={applyCustom}
                disabled={!customName.trim()}
                className="btn-primary h-8 px-3 py-0 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setCustomMode(false);
                  setCustomName("");
                }}
                className="btn h-8 border border-white/10 px-3 py-0 text-xs text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
              >
                Cancel
              </button>
            </>
          ) : (
            <label className="relative inline-flex flex-1">
              <span className="sr-only">Set strategy</span>
              <select
                value={selectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") onSetStrategy(null);
                  else if (v === CUSTOM_OPTION) {
                    setCustomName(isPredefined(trade.strategy) ? "" : trade.strategy ?? "");
                    setCustomMode(true);
                  } else onSetStrategy(v);
                }}
                className="input h-8 w-full py-0 text-xs"
              >
                <option value="">Auto-detect</option>
                {STRATEGY_DEFS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
                <option value={CUSTOM_OPTION}>Custom bucket…</option>
              </select>
            </label>
          )}
        </div>

        {!isAuto && !customMode && (
          <button
            onClick={() => onSetStrategy(null)}
            className="btn mt-2.5 h-8 gap-1.5 border border-white/10 px-3 py-0 text-xs text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
            title="Return this trade to auto-detection"
          >
            <RotateCcw size={13} />
            Reset to auto
          </button>
        )}

        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
          Compare every strategy's P&L on the{" "}
          <a href="#/strategies" className="text-flux-400 hover:underline">
            Strategies
          </a>{" "}
          page.
        </p>
      </div>
    </div>
  );
}

function isPredefined(key: string | null | undefined): boolean {
  return !!key && STRATEGY_DEFS.some((d) => d.key === key);
}

function WheelSection({
  trade,
  wheel,
  onExclude,
  onReset,
}: {
  trade: Trade;
  wheel: Wheel | undefined;
  onExclude: () => void;
  onReset: () => void;
}) {
  const excluded = trade.wheelId === WHEEL_EXCLUDED;
  const pinned = !!trade.wheelId && !excluded; // confirmed / manually placed

  return (
    <div>
      <div className="stat-label mb-2 flex items-center gap-1.5">
        <CircleDashed size={13} className="text-flux-400" />
        Wheel
      </div>

      {excluded ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-slate-400">
            Held out of any wheel. It won't count toward a wheel's premium or cost basis.
          </p>
          <button
            onClick={onReset}
            className="btn mt-2.5 h-8 gap-1.5 border border-white/10 px-3 py-0 text-xs text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
          >
            <RotateCcw size={13} />
            Reset to auto
          </button>
        </div>
      ) : wheel ? (
        <div
          className={cls(
            "rounded-xl border p-3",
            wheel.auto
              ? "border-dashed border-flux-500/25 bg-flux-500/[0.05]"
              : "border-white/10 bg-white/[0.03]"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{wheel.ticker}</span>
              <Pill tone={wheel.status === "Holding shares" ? "gold" : wheel.status === "Selling puts" ? "green" : "slate"}>
                {wheel.status}
              </Pill>
            </div>
            {wheel.auto && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-flux-300">
                <Sparkles size={12} />
                Suggested
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {fmtDate(wheel.startDate)} → {fmtDate(wheel.endDate)} · {wheel.tradeIds.length} trades ·{" "}
            <span className="num">{usd(wheel.premiumCollected)}</span> premium
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onExclude}
              className="btn h-8 gap-1.5 border border-white/10 px-3 py-0 text-xs text-slate-200 hover:bg-white/5 hover:text-loss-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
              title="Remove this trade from its wheel"
            >
              <MinusCircle size={13} />
              Exclude from wheel
            </button>
            {pinned && (
              <button
                onClick={onReset}
                className="btn h-8 gap-1.5 border border-white/10 px-3 py-0 text-xs text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
                title="Return this trade to auto-detection"
              >
                <RotateCcw size={13} />
                Reset to auto
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Manage and confirm wheels on the{" "}
            <a href="#/campaigns" className="text-flux-400 hover:underline">
              Wheels
            </a>{" "}
            page.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
          Not part of a detected wheel cycle.
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "gold" }) {
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
      <div className={cls("num mt-0.5 text-sm font-bold", toneCls)}>{value}</div>
    </div>
  );
}
