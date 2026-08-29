import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Activity,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "../data/store";
import { Card, Pill, EmptyState, Delta, deltaDir } from "../components/ui";
import { Drawer } from "../components/Drawer";
import { ActionPill } from "./Dashboard";
import { NoteEditor } from "../components/NoteEditor";
import { usd, signed, fmtDate, cls } from "../lib/format";
// posneg replaced by colorblind-safe <Delta/> where gain/loss is shown.
import { parseNote } from "../lib/notes";
import {
  dailyActivity,
  upcomingByDay,
  monthGrid,
  monthSummary,
  isoOf,
  WEEKDAYS,
  MONTH_NAMES,
  type DayCell,
  type UpcomingItem,
} from "../lib/calendar";

type Mode = "heatmap" | "activity" | "upcoming";

const MODES: { key: Mode; label: string; icon: typeof Flame }[] = [
  { key: "heatmap", label: "P&L Heatmap", icon: Flame },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
];

// Pick the most recent month that actually has trades, so the calendar opens
// on something meaningful rather than an empty current month.
function defaultMonth(dates: string[]): { y: number; m: number } {
  const now = new Date();
  if (!dates.length) return { y: now.getFullYear(), m: now.getMonth() };
  const last = dates.reduce((a, b) => (a > b ? a : b));
  const [y, m] = last.split("-").map(Number);
  return { y, m: m - 1 };
}

export default function CalendarPage() {
  const { dataset, updateTrade } = useStore();
  const [mode, setMode] = useState<Mode>("heatmap");
  const init = useMemo(() => defaultMonth(dataset.trades.map((t) => t.date)), []); // eslint-disable-line
  const [{ y, m }, setYM] = useState(init);
  const [selected, setSelected] = useState<string | null>(null);

  const activity = useMemo(() => dailyActivity(dataset), [dataset]);
  const upcoming = useMemo(
    () => upcomingByDay(dataset, isoOf(y, m, 1)),
    [dataset, y, m]
  );
  const grid = useMemo(() => monthGrid(y, m), [y, m]);

  const monthCells = useMemo(
    () =>
      grid
        .filter((g) => g.inMonth)
        .map((g) => activity.get(g.iso))
        .filter((c): c is DayCell => !!c),
    [grid, activity]
  );
  const summary = useMemo(() => monthSummary(monthCells), [monthCells]);

  // Max absolute net in the month → heatmap intensity scale.
  const maxAbs = useMemo(
    () => Math.max(1, ...monthCells.map((c) => Math.abs(c.net))),
    [monthCells]
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthHasActivity = monthCells.length > 0;
  const hasAnyTrades = dataset.trades.length > 0;
  const upcomingCount = useMemo(
    () =>
      grid
        .filter((g) => g.inMonth)
        .reduce((n, g) => n + (upcoming.get(g.iso)?.length ?? 0), 0),
    [grid, upcoming]
  );

  const go = (delta: number) => {
    setYM(({ y, m }) => {
      const nm = m + delta;
      if (nm < 0) return { y: y - 1, m: 11 };
      if (nm > 11) return { y: y + 1, m: 0 };
      return { y, m: nm };
    });
  };
  const goToday = () => setYM({ y: new Date().getFullYear(), m: new Date().getMonth() });

  const selectedCell = selected ? activity.get(selected) : undefined;
  const selectedUpcoming = selected ? upcoming.get(selected) ?? [] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-50">
            <CalendarDays size={24} className="text-flux-400" />
            Premium Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every day your wheel turned, colored by the premium it threw off.
          </p>
        </div>

        {/* Mode toggle */}
        <div
          className="flex items-center gap-1 rounded-xl border border-white/5 bg-ink-900/60 p-1"
          role="tablist"
          aria-label="Calendar view"
        >
          {MODES.map((md) => {
            const active = mode === md.key;
            return (
              <button
                key={md.key}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(md.key)}
                className={cls(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
                  active ? "bg-flux-500 text-ink-950" : "text-slate-400 hover:text-slate-100"
                )}
              >
                <md.icon size={14} />
                <span className="hidden sm:inline">{md.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Month nav + summary */}
      <Card pad={false} className="p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-[140px] text-center text-sm font-bold text-slate-100 md:text-base">
              {MONTH_NAMES[m]} {y}
            </div>
            <button
              onClick={() => go(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={goToday}
              className="ml-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
            >
              Today
            </button>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <SummaryStat
              label="Net premium"
              value={
                <Delta
                  dir={deltaDir(summary.net)}
                  value={usd(Math.abs(summary.net))}
                  size="base"
                  weight="bold"
                />
              }
            />
            <SummaryStat label="Events" value={String(summary.events)} />
            <SummaryStat
              label="Green / red days"
              value={`${summary.greenDays} / ${summary.redDays}`}
            />
            {mode === "upcoming" && (
              <SummaryStat label="Upcoming" value={String(upcomingCount)} tone="gold" />
            )}
          </div>
        </div>
      </Card>

      {/* Grid */}
      <Card pad={false} className="overflow-hidden p-3 md:p-4">
        {/* weekday header */}
        <div className="grid grid-cols-7 gap-1.5 px-0.5 pb-2">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            >
              <span className="hidden sm:inline">{w}</span>
              <span className="sm:hidden">{w[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((g) => (
            <DayCellView
              key={g.iso}
              iso={g.iso}
              day={g.day}
              inMonth={g.inMonth}
              isToday={g.iso === todayIso}
              cell={activity.get(g.iso)}
              upcoming={upcoming.get(g.iso)}
              mode={mode}
              maxAbs={maxAbs}
              onClick={() => {
                const c = activity.get(g.iso);
                const u = upcoming.get(g.iso);
                if (c || (u && u.length)) setSelected(g.iso);
              }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pt-2 text-[11px] text-slate-500">
          {mode === "heatmap" ? (
            <div className="flex items-center gap-2">
              <span>Buyback</span>
              <span className="h-3 w-6 rounded bg-loss-500/70" />
              <span className="h-3 w-6 rounded bg-loss-500/25" />
              <span className="h-3 w-6 rounded bg-white/5" />
              <span className="h-3 w-6 rounded bg-flux-500/30" />
              <span className="h-3 w-6 rounded bg-flux-500/70" />
              <span>Premium in</span>
            </div>
          ) : mode === "activity" ? (
            <div className="flex flex-wrap items-center gap-3">
              <LegendDot tone="green" label="Sold CSP/CC" />
              <LegendDot tone="slate" label="Buyback" />
              <LegendDot tone="gold" label="Assigned" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <LegendDot tone="blue" label="Expiry" />
              <LegendDot tone="gold" label="Earnings" />
            </div>
          )}
          <span>Click a day for detail</span>
        </div>
      </Card>

      {/* Empty-month hint */}
      {!monthHasActivity && (mode !== "upcoming" || upcomingCount === 0) && (
        <EmptyState
          compact
          icon={CalendarDays}
          title={`No activity in ${MONTH_NAMES[m]} ${y}`}
          sub={
            hasAnyTrades
              ? "Nothing recorded this month. Jump to your most recent trading month, or step through with the arrows above."
              : "Once you log trades, each day they happened will light up here, colored by the premium it threw off."
          }
          action={
            hasAnyTrades
              ? { label: "Jump to recent activity", onClick: () => setYM(init), icon: CalendarClock }
              : { label: "Import your trades", to: "/import" }
          }
          secondaryAction={hasAnyTrades ? { label: "Today", onClick: goToday } : undefined}
        />
      )}

      {/* Day drill-down */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? fmtDate(selected) : ""}
        sub={
          selectedCell
            ? `${selectedCell.events} event${selectedCell.events === 1 ? "" : "s"} · net ${signed(
                selectedCell.net
              )}`
            : selectedUpcoming.length
            ? `${selectedUpcoming.length} upcoming`
            : "No activity"
        }
      >
        <DayDetail
          cell={selectedCell}
          upcoming={selectedUpcoming}
          onSaveNote={(id, note) => updateTrade(id, { note })}
        />
      </Drawer>
    </div>
  );
}

// ---- day cell --------------------------------------------------------------

function DayCellView({
  iso,
  day,
  inMonth,
  isToday,
  cell,
  upcoming,
  mode,
  maxAbs,
  onClick,
}: {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  cell?: DayCell;
  upcoming?: UpcomingItem[];
  mode: Mode;
  maxAbs: number;
  onClick: () => void;
}) {
  const hasData =
    mode === "upcoming"
      ? !!(upcoming && upcoming.length)
      : !!cell && cell.events > 0;

  // heatmap fill
  let heatStyle: React.CSSProperties | undefined;
  if (mode === "heatmap" && cell && cell.net !== 0) {
    const intensity = Math.min(1, Math.abs(cell.net) / maxAbs);
    // cap max fill alpha (~0.5) so a high-intensity tile never overpowers the
    // neutral in-cell amount in either theme.
    const alpha = 0.12 + intensity * 0.38;
    const rgb = cell.net > 0 ? "16,185,129" : "244,63,94";
    heatStyle = { backgroundColor: `rgba(${rgb},${alpha})` };
  }

  return (
    <button
      onClick={onClick}
      disabled={!hasData}
      aria-label={`${iso}${cell ? `, net ${cell.net}` : ""}`}
      style={heatStyle}
      className={cls(
        "group relative flex aspect-square min-h-[44px] flex-col rounded-lg border p-1.5 text-left transition sm:aspect-auto sm:min-h-[78px]",
        inMonth ? "border-white/5" : "border-transparent opacity-40",
        hasData
          ? "cursor-pointer hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
          : "cursor-default",
        !heatStyle && inMonth && "bg-white/[0.015]",
        isToday && "ring-1 ring-flux-500/50"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cls(
            "text-[11px] font-semibold",
            isToday ? "text-flux-300" : inMonth ? "text-slate-400" : "text-slate-600"
          )}
        >
          {day}
        </span>
        {isToday && (
          <span className="hidden text-[9px] font-bold uppercase tracking-wide text-flux-400 sm:inline">
            Today
          </span>
        )}
      </div>

      {/* body */}
      <div className="mt-auto min-w-0">
        {mode === "heatmap" && cell && cell.net !== 0 && (
          <Delta
            dir={deltaDir(cell.net)}
            value={usd(Math.abs(cell.net), 0)}
            size="xs"
            weight="bold"
            // Gain/loss is already encoded by the heat fill hue AND the
            // directional arrow, so the number itself stays a high-contrast,
            // theme-aware neutral (dark text in light theme, light in dark) —
            // this reads cleanly over the fill at every intensity. Same-hue
            // text on a strong fill (the old !text-flux-300/!text-loss-300)
            // washed out on high-premium days.
            className="truncate !text-slate-50"
          />
        )}

        {mode === "activity" && cell && (
          <>
            {/* compact chips on roomy (desktop) cells, dots on small ones */}
            <div className="hidden flex-col gap-0.5 sm:flex">
              {cell.trades.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className={cls(
                    "inline-flex items-center gap-1 truncate rounded px-1 py-px text-[10px] font-semibold leading-tight",
                    eventTone(t)
                  )}
                >
                  {t.ticker} {eventLabel(t)}
                </span>
              ))}
              {cell.trades.length > 3 && (
                <span className="text-[9px] text-slate-500">+{cell.trades.length - 3} more</span>
              )}
            </div>
            <div className="flex flex-wrap gap-0.5 sm:hidden">
              {cell.sold > 0 && <Dot tone="green" n={cell.sold} />}
              {cell.closed > 0 && <Dot tone="slate" n={cell.closed} />}
              {cell.assigned > 0 && <Dot tone="gold" n={cell.assigned} />}
            </div>
          </>
        )}

        {mode === "upcoming" && upcoming && upcoming.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {upcoming.slice(0, 3).map((u, i) => (
              <span
                key={i}
                className={cls(
                  "inline-flex items-center rounded px-1 text-[9px] font-bold sm:text-[10px]",
                  u.kind === "earnings"
                    ? "bg-torque-500/20 text-torque-300"
                    : "bg-sky-500/20 text-sky-300"
                )}
              >
                {u.trade.ticker}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function eventTone(t: { side: string; action: string; status: string }): string {
  if (t.action === "BB") return "bg-white/5 text-slate-300";
  if (t.action === "AAssignSTK" || t.status === "Assigned")
    return "bg-torque-500/15 text-torque-300";
  return "bg-flux-500/12 text-flux-300";
}

function eventLabel(t: { action: string; status: string }): string {
  if (t.action === "BB") return "BB";
  if (t.action === "AAssignSTK") return "assign";
  if (t.status === "Assigned") return `${t.action}·asgn`;
  return t.action;
}

function Dot({ tone, n }: { tone: "green" | "slate" | "gold"; n: number }) {
  const map = {
    green: "bg-flux-500/80",
    slate: "bg-slate-400/60",
    gold: "bg-torque-500/80",
  } as const;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={cls("h-1.5 w-1.5 rounded-full", map[tone])} />
      {n > 1 && <span className="text-[9px] font-semibold text-slate-400">{n}</span>}
    </span>
  );
}

function LegendDot({ tone, label }: { tone: "green" | "slate" | "gold" | "blue"; label: string }) {
  const map: Record<string, string> = {
    green: "bg-flux-500/80",
    slate: "bg-slate-400/60",
    gold: "bg-torque-500/80",
    blue: "bg-sky-500/80",
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={cls("h-2 w-2 rounded-full", map[tone])} />
      {label}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
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
    <div className="flex items-baseline gap-2 md:flex-col md:items-end md:gap-0">
      <span className="order-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:order-1">
        {label}
      </span>
      <span className={cls("order-1 num text-sm font-bold md:order-2", toneCls)}>{value}</span>
    </div>
  );
}

// ---- day drill-down body ---------------------------------------------------

function DayDetail({
  cell,
  upcoming,
  onSaveNote,
}: {
  cell?: DayCell;
  upcoming: UpcomingItem[];
  onSaveNote: (id: string, note: string | null) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  if (!cell && upcoming.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-500">Nothing recorded this day.</div>;
  }

  return (
    <div className="space-y-5">
      {cell && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <MiniBox
              label="Collected"
              value={<Delta dir="up" value={usd(cell.credits)} size="base" weight="bold" />}
            />
            <MiniBox
              label="Bought back"
              value={
                cell.buybacks ? (
                  <Delta dir="down" value={usd(cell.buybacks)} size="base" weight="bold" />
                ) : (
                  "—"
                )
              }
            />
            <MiniBox
              label="Net"
              value={<Delta dir={deltaDir(cell.net)} value={usd(Math.abs(cell.net))} size="base" weight="bold" />}
            />
          </div>

          <div className="space-y-2">
            {cell.trades.map((t) => {
              const credit = t.side === "credit";
              const journal = parseNote(t.note).text;
              const isEditing = editing === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{t.ticker}</span>
                    <ActionPill action={t.action} />
                    {t.status && <span className="text-xs text-slate-500">{t.status}</span>}
                    <Delta
                      dir={credit ? "up" : "down"}
                      value={usd(t.amount)}
                      size="base"
                      className="ml-auto"
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{t.shares} sh</span>
                    {t.strike != null && <span className="num">${t.strike} strike</span>}
                    {t.expiry && <span>exp {fmtDate(t.expiry)}</span>}
                    <button
                      onClick={() => setEditing(isEditing ? null : t.id)}
                      className="ml-auto font-semibold text-flux-300 hover:text-flux-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40 rounded"
                    >
                      {journal ? "Edit note" : "Add note"}
                    </button>
                  </div>
                  {!isEditing && journal && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/[0.03] px-2.5 py-2 text-xs text-slate-300">
                      {journal}
                    </p>
                  )}
                  {isEditing && (
                    <div className="mt-2">
                      <NoteEditor
                        trade={t}
                        onSave={(note) => onSaveNote(t.id, note)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="stat-label mb-2">Upcoming</div>
          <div className="space-y-2">
            {upcoming.map((u, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3"
              >
                {u.kind === "earnings" ? (
                  <AlertTriangle size={15} className="text-torque-400" />
                ) : (
                  <CalendarClock size={15} className="text-sky-400" />
                )}
                <span className="font-semibold text-slate-100">{u.trade.ticker}</span>
                <Pill tone={u.kind === "earnings" ? "gold" : "blue"}>
                  {u.kind === "earnings" ? "Earnings" : "Expiry"}
                </Pill>
                <Delta
                  dir={deltaDir(u.trade.amount)}
                  value={usd(u.trade.amount)}
                  size="sm"
                  className="ml-auto"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="num mt-0.5 text-sm font-bold text-slate-300">{value}</div>
    </div>
  );
}
