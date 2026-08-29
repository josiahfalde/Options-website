import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  PieChart,
  ListOrdered,
  Tag,
} from "lucide-react";
import { useStore } from "../data/store";
import { computeAllocation, type SectorAllocation, type TickerAllocation } from "../data/allocation";
import { SECTORS, UNASSIGNED } from "../data/sectors";
import { Card, Kpi, SectionTitle, EmptyState } from "../components/ui";
import { Drawer } from "../components/Drawer";
import { CapitalBaseEditor } from "../components/CapitalBaseEditor";
import { usd, usd0, pct, fmtDate, cls } from "../lib/format";
import type { StockEvent } from "../types";

type View = "sector" | "ticker";

// ---------------------------------------------------------------------------
// Allocation: where the capital sits right now. Share value = amber (capital
// deployed); put collateral = a tonal step of the same amber (reserved cash,
// not yet deployed). One visual system, no green/rose for amounts.
// ---------------------------------------------------------------------------
export default function Allocation() {
  const { dataset, setSector, deleteStockEvent, setPrice, setCapitalBase } = useStore();
  const alloc = useMemo(() => computeAllocation(dataset), [dataset]);

  const [view, setView] = useState<View>("sector");
  const [openSectors, setOpenSectors] = useState<Set<string>>(() => new Set());
  const [openTickers, setOpenTickers] = useState<Set<string>>(() => new Set());
  const [fillsOpen, setFillsOpen] = useState(false);

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  };

  // Jump from the to-do callout straight to the unassigned tickers, expanded.
  const jumpToUnassigned = () => {
    setView("sector");
    setOpenSectors((s) => new Set(s).add(UNASSIGNED));
    setOpenTickers((s) => {
      const next = new Set(s);
      alloc.unassignedTickers.forEach((t) => next.add(t));
      return next;
    });
    requestAnimationFrame(() =>
      document.getElementById("sector-unassigned")?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  const fills = useMemo(
    () => [...(dataset.stockEvents ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [dataset.stockEvents]
  );

  const unassignedCount = alloc.unassignedTickers.length;
  const hasBase = alloc.capitalBase > 0;
  const overCommitted = hasBase && alloc.totalAllocated > alloc.capitalBase;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Allocation"
        sub="Where your capital sits right now: shares held plus cash reserved behind open puts."
        right={
          <button
            type="button"
            onClick={() => setFillsOpen(true)}
            className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
          >
            <ListOrdered size={14} aria-hidden="true" />
            Share fills
            <span className="num text-slate-400">{fills.length}</span>
          </button>
        }
      />

      {alloc.tickers.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="Nothing allocated yet"
          sub="Drop a Fidelity Accounts History CSV on the Import page to bring in your share buys and sells. Shares taken on by put assignment already count from your option trades."
          action={{ label: "Import a Fidelity CSV", to: "/import", icon: Upload }}
        />
      ) : (
        <>
          {/* To-do: tickers with no sector. Sits above everything so it reads as work, not data. */}
          {unassignedCount > 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-torque-500/30 bg-torque-500/10 px-4 py-3"
            >
              <div className="flex items-center gap-2.5 text-sm">
                <Tag size={15} className="shrink-0 text-torque-300" aria-hidden="true" />
                <span className="text-slate-100">
                  <span className="font-semibold">
                    {unassignedCount} {unassignedCount === 1 ? "ticker needs" : "tickers need"} a sector
                  </span>
                  <span className="text-slate-400">
                    {" "}
                    ({alloc.unassignedTickers.join(", ")}). Until then they sit outside the sector view.
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={jumpToUnassigned}
                className="btn-ghost border-torque-500/30 px-3 py-1.5 text-xs text-torque-300 hover:bg-torque-500/10"
              >
                Assign sectors
              </button>
            </div>
          )}

          {/* Headline */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Kpi
              className="md:col-span-2"
              size="lg"
              label="Allocated"
              tone="gold"
              value={usd0(alloc.totalAllocated)}
              sub={
                <div className="space-y-2">
                  <SplitBar shares={alloc.totalShares} collateral={alloc.totalCollateral} size="md" />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Legend swatch="shares">
                      Shares <span className="num text-slate-200">{usd0(alloc.totalShares)}</span>
                    </Legend>
                    <Legend swatch="collateral">
                      Put collateral <span className="num text-slate-200">{usd0(alloc.totalCollateral)}</span>
                    </Legend>
                  </div>
                </div>
              }
              hint="Share value (last price, or average cost when no price is known) plus the cash reserved behind every open cash-secured put. Premium P&L is not included."
            />
            <Kpi
              label="Uncommitted"
              tone={overCommitted ? "gold" : "neutral"}
              value={hasBase ? (overCommitted ? "-" + usd0(alloc.totalAllocated - alloc.capitalBase) : usd0(alloc.uncommitted)) : "n/a"}
              sub={
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {hasBase ? (
                    <>
                      <span className="num font-semibold text-slate-200">
                        {pct(alloc.totalAllocated / alloc.capitalBase, 0)}
                      </span>
                      <span>of</span>
                    </>
                  ) : (
                    <span>No capital base set.</span>
                  )}
                  <CapitalBaseEditor
                    capitalBase={alloc.capitalBase}
                    estimated={!hasBase}
                    onCommit={setCapitalBase}
                  />
                  {overCommitted && <span className="text-torque-300">over your base</span>}
                </span>
              }
              hint="Capital base minus everything allocated. Set your real capital to see how much is still free to deploy."
            />
            <Kpi
              label="Concentration"
              tone={alloc.topTickerWeight >= 0.4 ? "gold" : "neutral"}
              value={pct(alloc.topTickerWeight, 0)}
              sub={
                <>
                  in <span className="font-semibold text-slate-200">{alloc.tickers[0]?.ticker}</span>
                  {alloc.topSectorWeight > 0 && (
                    <>
                      {" "}
                      <span className="text-slate-600">/</span>{" "}
                      <span className="num font-semibold text-slate-200">{pct(alloc.topSectorWeight, 0)}</span> in{" "}
                      <span className="font-semibold text-slate-200">
                        {alloc.sectors.find((s) => s.sector !== UNASSIGNED)?.sector}
                      </span>
                    </>
                  )}
                </>
              }
              hint="Largest single ticker and largest sector as a share of everything allocated. Amber past 40% in one name."
            />
          </div>

          {/* Breakdown */}
          <Card pad={false} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-ink-900/60 p-1">
                {(
                  [
                    ["sector", "By sector"],
                    ["ticker", "By ticker"],
                  ] as [View, string][]
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={cls(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
                      view === v ? "bg-flux-500 text-ink-950" : "text-slate-400 hover:text-slate-100"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <Legend swatch="shares">Shares</Legend>
                <Legend swatch="collateral">Collateral</Legend>
                {alloc.atCostTickers.length > 0 && (
                  <span className="hidden sm:inline">
                    <span className="text-torque-300">{alloc.atCostTickers.length} at cost</span>: no last price
                  </span>
                )}
              </div>
            </div>

            {/* Column heads (desktop only; mobile rows carry their own labels) */}
            <div className="hidden md:grid-cols-[minmax(0,1fr)_160px_96px_72px_72px] items-center gap-3 px-4 pt-3 md:grid">
              <span className="th px-0 py-0">{view === "sector" ? "Sector" : "Ticker"}</span>
              <span aria-hidden="true" />
              <span className="th px-0 py-0 text-right">Total</span>
              <span className="th px-0 py-0 text-right">Weight</span>
              <span className="th px-0 py-0 text-right" title="Share of capital base">
                Capital
              </span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {view === "sector"
                ? alloc.sectors.map((s) => (
                    <SectorRow
                      key={s.sector}
                      s={s}
                      max={alloc.sectors[0]?.total ?? 0}
                      open={openSectors.has(s.sector)}
                      onToggle={() => setOpenSectors((set) => toggle(set, s.sector))}
                    >
                      {s.tickers.map((t) => (
                        <TickerRow
                          key={t.ticker}
                          t={t}
                          max={s.tickers[0]?.total ?? 0}
                          nested
                          open={openTickers.has(t.ticker)}
                          onToggle={() => setOpenTickers((set) => toggle(set, t.ticker))}
                          onSector={setSector}
                          onPrice={setPrice}
                        />
                      ))}
                    </SectorRow>
                  ))
                : alloc.tickers.map((t) => (
                    <TickerRow
                      key={t.ticker}
                      t={t}
                      max={alloc.tickers[0]?.total ?? 0}
                      open={openTickers.has(t.ticker)}
                      onToggle={() => setOpenTickers((set) => toggle(set, t.ticker))}
                      onSector={setSector}
                      onPrice={setPrice}
                    />
                  ))}
            </div>
          </Card>
        </>
      )}

      <Drawer
        open={fillsOpen}
        onClose={() => setFillsOpen(false)}
        title="Share fills"
        sub="Outright buys, sells and reinvestments from your broker history. Assignments are not listed here; they come from your option trades."
      >
        {fills.length === 0 ? (
          <EmptyState
            compact
            title="No share fills"
            sub="Import a Fidelity Accounts History CSV to bring in share buys and sells."
            action={{ label: "Go to Import", to: "/import", onClick: () => setFillsOpen(false) }}
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {fills.map((e) => (
              <FillRow key={e.id} e={e} onDelete={() => deleteStockEvent(e.id)} />
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Pieces                                                                  */
/* ---------------------------------------------------------------------- */

/** Stacked bar: shares (amber) then collateral (tonal amber), scaled to `max`. */
function SplitBar({
  shares,
  collateral,
  max,
  size = "sm",
}: {
  shares: number;
  collateral: number;
  /** Row max for relative scaling; omit to fill the track. */
  max?: number;
  size?: "sm" | "md";
}) {
  const total = shares + collateral;
  const scale = max && max > 0 ? Math.min(1, total / max) : 1;
  const sharesPct = total > 0 ? (shares / total) * scale * 100 : 0;
  const collPct = total > 0 ? (collateral / total) * scale * 100 : 0;
  return (
    <div
      className={cls("flex w-full overflow-hidden rounded-full bg-white/5", size === "md" ? "h-2.5" : "h-1.5")}
      role="img"
      aria-label={`Shares ${usd0(shares)}, collateral ${usd0(collateral)}`}
    >
      <div className="h-full bg-torque-500" style={{ width: `${sharesPct}%` }} />
      <div className="h-full bg-torque-500/35" style={{ width: `${collPct}%` }} />
    </div>
  );
}

function Legend({ swatch, children }: { swatch: "shares" | "collateral"; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
      <span
        aria-hidden="true"
        className={cls(
          "inline-block h-2 w-2 rounded-full",
          swatch === "shares" ? "bg-torque-500" : "bg-torque-500/35"
        )}
      />
      {children}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={15}
      aria-hidden="true"
      className={cls(
        "shrink-0 text-slate-500 transition-transform motion-reduce:transition-none",
        open && "rotate-90"
      )}
    />
  );
}

/** Amount / weight / capital, right-aligned. Shared by sector and ticker rows. */
function Figures({ total, weight, ofCapital }: { total: number; weight: number; ofCapital: number | null }) {
  return (
    <>
      <span className="num text-right text-sm font-semibold text-slate-100">{usd0(total)}</span>
      <span className="num text-right text-sm text-slate-300">{pct(weight, 1)}</span>
      <span className="num text-right text-sm text-slate-400">{ofCapital == null ? "n/a" : pct(ofCapital, 1)}</span>
    </>
  );
}

function SectorRow({
  s,
  max,
  open,
  onToggle,
  children,
}: {
  s: SectorAllocation;
  max: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const isTodo = s.sector === UNASSIGNED;
  const id = `sector-${s.sector.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div id={id}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cls(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
          "md:grid-cols-[minmax(0,1fr)_160px_96px_72px_72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-flux-500/40",
          isTodo && "bg-torque-500/[0.04]"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Chevron open={open} />
          <span className={cls("truncate text-sm font-semibold", isTodo ? "text-torque-300" : "text-slate-100")}>
            {s.sector}
          </span>
          <span className="num hidden shrink-0 text-xs text-slate-500 md:inline">
            {s.tickers.length} {s.tickers.length === 1 ? "ticker" : "tickers"}
          </span>
        </span>
        {/* Mobile: total + weight in one cell */}
        <span className="flex items-baseline gap-2 md:hidden">
          <span className="num text-sm font-semibold text-slate-100">{usd0(s.total)}</span>
          <span className="num text-xs text-slate-400">{pct(s.weight, 0)}</span>
        </span>
        <span className="col-span-2 pl-[23px] md:col-span-1 md:pl-0">
          <SplitBar shares={s.sharesValue} collateral={s.collateral} max={max} />
        </span>
        <span className="hidden md:contents">
          <Figures total={s.total} weight={s.weight} ofCapital={s.ofCapital} />
        </span>
      </button>
      {open && <div className="border-t border-white/[0.04] bg-ink-900/40">{children}</div>}
    </div>
  );
}

function TickerRow({
  t,
  max,
  nested,
  open,
  onToggle,
  onSector,
  onPrice,
}: {
  t: TickerAllocation;
  max: number;
  nested?: boolean;
  open: boolean;
  onToggle: () => void;
  onSector: (ticker: string, sector: string | null) => void;
  onPrice: (ticker: string, price: number) => void;
}) {
  const isTodo = t.sector === UNASSIGNED;
  return (
    <div className={cls(nested && "border-b border-white/[0.04] last:border-b-0")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cls(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 pr-4 text-left transition-colors hover:bg-white/[0.03]",
          "md:grid-cols-[minmax(0,1fr)_160px_96px_72px_72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-flux-500/40",
          nested ? "pl-9" : "pl-4"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Chevron open={open} />
          <span className="text-sm font-semibold text-slate-100">{t.ticker}</span>
          {!nested && (
            <span className={cls("truncate text-xs", isTodo ? "text-torque-300" : "text-slate-500")}>
              {t.sector}
            </span>
          )}
          {t.priceSource === "cost" && (
            <span className="shrink-0 text-[11px] text-torque-300" title="No last price known; valued at average cost">
              at cost
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-2 md:hidden">
          <span className="num text-sm font-semibold text-slate-100">{usd0(t.total)}</span>
          <span className="num text-xs text-slate-400">{pct(t.weight, 0)}</span>
        </span>
        <span className="col-span-2 pl-[23px] md:col-span-1 md:pl-0">
          <SplitBar shares={t.sharesValue} collateral={t.collateral} max={max} />
        </span>
        <span className="hidden md:contents">
          <Figures total={t.total} weight={t.weight} ofCapital={t.ofCapital} />
        </span>
      </button>

      {open && (
        <div className={cls("pb-4 pr-4", nested ? "pl-9 md:pl-[59px]" : "pl-4 md:pl-[39px]")}>
          <TickerDetail t={t} onSector={onSector} onPrice={onPrice} />
        </div>
      )}
    </div>
  );
}

function TickerDetail({
  t,
  onSector,
  onPrice,
}: {
  t: TickerAllocation;
  onSector: (ticker: string, sector: string | null) => void;
  onPrice: (ticker: string, price: number) => void;
}) {
  const isTodo = t.sector === UNASSIGNED;
  const acquired =
    t.shares > 0
      ? [
          t.sharesFromAssignment > 0 && `${fmtShares(t.sharesFromAssignment)} assigned`,
          t.sharesFromBuys > 0 && `${fmtShares(t.sharesFromBuys)} bought`,
        ]
          .filter(Boolean)
          .join(", ")
      : "none held";

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(15rem,1.3fr)]">
      <Field label="Shares">
        <span className="num text-slate-100">{fmtShares(t.shares)}</span>
        <div className="mt-0.5 text-[11px] text-slate-500">{acquired}</div>
      </Field>
      <Field label="Avg cost">
        <span className="num text-slate-100">{t.avgCost > 0 ? usd(t.avgCost) : "n/a"}</span>
      </Field>
      <Field label="Price">
        <PriceCell t={t} onPrice={onPrice} />
      </Field>
      <Field label="Collateral">
        <span className="num text-slate-100">{usd0(t.collateral)}</span>
        <div className="mt-0.5 text-[11px] text-slate-500">
          {t.openPuts === 0 ? "no open puts" : `${t.openPuts} open ${t.openPuts === 1 ? "put" : "puts"}`}
        </div>
      </Field>
      <Field label="Sector" className="col-span-2 sm:col-span-3 lg:col-span-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <select
            value={isTodo ? "" : t.sector}
            onChange={(e) => onSector(t.ticker, e.target.value || null)}
            aria-label={`Sector for ${t.ticker}`}
            className={cls("input max-w-[15rem] py-1.5 text-xs", isTodo && "border-torque-500/40")}
          >
            <option value="" disabled>
              Choose a sector
            </option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {t.sectorIsOverride && (
            <button
              type="button"
              onClick={() => onSector(t.ticker, null)}
              title="Clear your override and use the built-in sector"
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
            >
              <RotateCcw size={11} aria-hidden="true" />
              Use default
            </button>
          )}
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="stat-label mb-1">{label}</div>
      {children}
    </div>
  );
}

/** Price with an inline editor whenever the value is not a real last price. */
function PriceCell({ t, onPrice }: { t: TickerAllocation; onPrice: (ticker: string, price: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (editing) setDraft(t.price > 0 ? String(t.price) : "");
  }, [editing, t.price]);

  const save = () => {
    const n = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (n > 0) onPrice(t.ticker, n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="relative w-28">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            inputMode="decimal"
            aria-label={`Last price for ${t.ticker}`}
            className="input num py-1 pl-5 pr-2 text-xs"
          />
        </div>
        <button type="button" onClick={save} className="btn-primary px-2.5 py-1 text-xs">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost px-2 py-1 text-xs">
          Cancel
        </button>
      </div>
    );
  }

  if (t.priceSource === "last") {
    return <span className="num text-slate-100">{usd(t.price)}</span>;
  }
  return (
    <div>
      <span className="num text-slate-100">{t.price > 0 ? usd(t.price) : "n/a"}</span>
      <div className="mt-0.5 text-[11px] text-torque-300">
        {t.priceSource === "cost" ? "at cost, no last price" : "no price known"}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
      >
        <Pencil size={11} aria-hidden="true" />
        Set price
      </button>
    </div>
  );
}

/** One share fill. Delete is two-step so a stray tap cannot drop a fill. */
function FillRow({ e, onDelete }: { e: StockEvent; onDelete: () => void }) {
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const id = window.setTimeout(() => setArm(false), 4000);
    return () => window.clearTimeout(id);
  }, [arm]);
  const kindLabel = e.kind === "buy" ? "Buy" : e.kind === "sell" ? "Sell" : "Reinvest";
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-100">{e.ticker}</span>
          <span className={cls("text-xs", e.kind === "sell" ? "text-slate-400" : "text-torque-300")}>{kindLabel}</span>
        </div>
        <div className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
          <span>{fmtDate(e.date)}</span>
          <span className="text-slate-600">/</span>
          <span>{fmtShares(e.shares)} sh</span>
          {e.price > 0 && (
            <>
              <span className="text-slate-600">/</span>
              <span>{usd(e.price)}</span>
            </>
          )}
        </div>
      </div>
      <span className="num text-sm text-slate-100">{e.kind === "sell" ? "+" : "-"}{usd(e.amount)}</span>
      {arm ? (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-md bg-loss-500 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-loss-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss-500/40"
        >
          Confirm
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setArm(true)}
          aria-label={`Delete ${kindLabel.toLowerCase()} of ${fmtShares(e.shares)} ${e.ticker} on ${fmtDate(e.date)}`}
          className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-loss-500/10 hover:text-loss-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss-500/40"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

const fmtShares = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString("en-US", { maximumFractionDigits: 3 });
