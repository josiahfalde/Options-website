import type { Dataset, StockEvent, Trade } from "../types";
import { isAssign, openPositions } from "./compute";
import { sectorOf, isSectorOverride, UNASSIGNED } from "./sectors";
import { todayISO } from "../lib/format";

// ============================================================================
// Allocation: where the capital actually sits right now, by ticker and by
// sector. Two sources are combined per ticker:
//
//   shares      outright buys/sells/reinvests (StockEvent) PLUS shares taken
//               on via put assignment and given up via call assignment (which
//               live on the option trades, exactly as compute.ts counts them).
//   collateral  cash reserved behind every OPEN cash-secured put
//               (strike * shares), from openPositions().
//
// Value uses the last known price when there is one, else the position's own
// average cost (flagged so the UI can say "at cost"). Nothing here touches
// premium P&L; that stays in compute.ts.
// ============================================================================

export interface TickerAllocation {
  ticker: string;
  sector: string;
  sectorIsOverride: boolean;
  shares: number;
  /** Average cost per share of what is still held (0 when flat). */
  avgCost: number;
  /** Price the share value was marked at. */
  price: number;
  priceSource: "last" | "cost" | "none";
  sharesValue: number;
  /** Cash reserved for open CSPs on this ticker. */
  collateral: number;
  openPuts: number;
  /** sharesValue + collateral */
  total: number;
  /** total / portfolio allocated total (0..1). */
  weight: number;
  /** total / capital base (0..1), or null if no base is set. */
  ofCapital: number | null;
  /** How the shares were acquired, for the drill-down. */
  sharesFromAssignment: number;
  sharesFromBuys: number;
}

export interface SectorAllocation {
  sector: string;
  total: number;
  sharesValue: number;
  collateral: number;
  weight: number;
  ofCapital: number | null;
  tickers: TickerAllocation[];
}

export interface Allocation {
  tickers: TickerAllocation[];
  sectors: SectorAllocation[];
  totalAllocated: number;
  totalShares: number;
  totalCollateral: number;
  capitalBase: number;
  /** capitalBase - totalAllocated when a base is set and positive, else 0. */
  uncommitted: number;
  /** Largest single-ticker weight (concentration signal). */
  topTickerWeight: number;
  topSectorWeight: number;
  unassignedTickers: string[];
  /** Tickers whose value is marked at cost because no last price is known. */
  atCostTickers: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Lot {
  shares: number;
  cost: number; // total dollars
}

/**
 * Walk a ticker's share flow chronologically (assignments + buys add lots at
 * their cost; sells and call-aways consume lots FIFO) and return what is left.
 */
function heldLots(ticker: string, trades: Trade[], events: StockEvent[]): {
  shares: number;
  cost: number;
  fromAssignment: number;
  fromBuys: number;
} {
  type Flow = { date: string; delta: number; cost: number; src: "assign" | "buy" };
  const flows: Flow[] = [];
  for (const t of trades) {
    if (t.ticker !== ticker) continue;
    if (isAssign(t)) flows.push({ date: t.date, delta: t.shares, cost: t.invested ?? 0, src: "assign" });
    else if (t.action === "CC" && t.status === "Assigned")
      flows.push({ date: t.date, delta: -t.shares, cost: 0, src: "assign" });
  }
  for (const e of events) {
    if (e.ticker !== ticker) continue;
    const sign = e.kind === "sell" ? -1 : 1;
    flows.push({ date: e.date, delta: sign * e.shares, cost: e.amount || e.shares * e.price, src: "buy" });
  }
  flows.sort((a, b) => a.date.localeCompare(b.date));

  const lots: (Lot & { src: "assign" | "buy" })[] = [];
  for (const f of flows) {
    if (f.delta > 0) {
      lots.push({ shares: f.delta, cost: f.cost, src: f.src });
    } else {
      let toSell = -f.delta;
      while (toSell > 0 && lots.length) {
        const lot = lots[0];
        const take = Math.min(lot.shares, toSell);
        lot.cost -= (lot.cost / lot.shares) * take;
        lot.shares -= take;
        toSell -= take;
        if (lot.shares <= 1e-9) lots.shift();
      }
    }
  }
  let shares = 0,
    cost = 0,
    fromAssignment = 0,
    fromBuys = 0;
  for (const l of lots) {
    shares += l.shares;
    cost += l.cost;
    if (l.src === "assign") fromAssignment += l.shares;
    else fromBuys += l.shares;
  }
  return { shares, cost, fromAssignment, fromBuys };
}

export function computeAllocation(ds: Dataset, asOf = todayISO()): Allocation {
  const events = ds.stockEvents ?? [];
  const overrides = ds.sectors ?? {};

  const tickers = new Set<string>();
  for (const t of ds.trades) tickers.add(t.ticker);
  for (const e of events) tickers.add(e.ticker);

  const open = openPositions(ds, asOf).filter((p) => p.trade.action === "CSP");

  const rows: TickerAllocation[] = [];
  for (const ticker of tickers) {
    const held = heldLots(ticker, ds.trades, events);
    const puts = open.filter((p) => p.trade.ticker === ticker);
    const collateral = puts.reduce((s, p) => s + p.collateral, 0);
    if (held.shares <= 1e-9 && collateral <= 0) continue; // nothing allocated here

    const avgCost = held.shares > 0 ? held.cost / held.shares : 0;
    const last = ds.lastPrices[ticker];
    let price = 0;
    let priceSource: TickerAllocation["priceSource"] = "none";
    if (last && last > 0) {
      price = last;
      priceSource = "last";
    } else if (avgCost > 0) {
      price = round2(avgCost);
      priceSource = "cost";
    }
    const sharesValue = round2(held.shares * price);
    rows.push({
      ticker,
      sector: sectorOf(ticker, overrides),
      sectorIsOverride: isSectorOverride(ticker, overrides),
      shares: Math.round(held.shares * 1e4) / 1e4,
      avgCost: round2(avgCost),
      price,
      priceSource,
      sharesValue,
      collateral: round2(collateral),
      openPuts: puts.length,
      total: round2(sharesValue + collateral),
      weight: 0,
      ofCapital: null,
      sharesFromAssignment: held.fromAssignment,
      sharesFromBuys: held.fromBuys,
    });
  }

  const totalAllocated = round2(rows.reduce((s, r) => s + r.total, 0));
  const capitalBase = ds.capitalBase || 0;
  for (const r of rows) {
    r.weight = totalAllocated > 0 ? r.total / totalAllocated : 0;
    r.ofCapital = capitalBase > 0 ? r.total / capitalBase : null;
  }
  rows.sort((a, b) => b.total - a.total || a.ticker.localeCompare(b.ticker));

  const bySector = new Map<string, TickerAllocation[]>();
  for (const r of rows) (bySector.get(r.sector) ?? bySector.set(r.sector, []).get(r.sector)!).push(r);
  const sectors: SectorAllocation[] = [...bySector.entries()].map(([sector, ts]) => {
    const total = round2(ts.reduce((s, r) => s + r.total, 0));
    return {
      sector,
      total,
      sharesValue: round2(ts.reduce((s, r) => s + r.sharesValue, 0)),
      collateral: round2(ts.reduce((s, r) => s + r.collateral, 0)),
      weight: totalAllocated > 0 ? total / totalAllocated : 0,
      ofCapital: capitalBase > 0 ? total / capitalBase : null,
      tickers: ts,
    };
  });
  // Unassigned always sinks to the bottom so it reads as a to-do, not a sector.
  sectors.sort((a, b) => {
    if (a.sector === UNASSIGNED) return 1;
    if (b.sector === UNASSIGNED) return -1;
    return b.total - a.total || a.sector.localeCompare(b.sector);
  });

  return {
    tickers: rows,
    sectors,
    totalAllocated,
    totalShares: round2(rows.reduce((s, r) => s + r.sharesValue, 0)),
    totalCollateral: round2(rows.reduce((s, r) => s + r.collateral, 0)),
    capitalBase,
    uncommitted: capitalBase > totalAllocated ? round2(capitalBase - totalAllocated) : 0,
    topTickerWeight: rows[0]?.weight ?? 0,
    topSectorWeight: sectors.find((s) => s.sector !== UNASSIGNED)?.weight ?? 0,
    unassignedTickers: rows.filter((r) => r.sector === UNASSIGNED).map((r) => r.ticker),
    atCostTickers: rows.filter((r) => r.priceSource === "cost").map((r) => r.ticker),
  };
}

// ---- merge helpers for re-imports -----------------------------------------
// A re-exported Fidelity history overlaps the last one; identical rows are
// the same fill, not a new one. Count-aware, like planMerge for trades.
export const stockEventKey = (e: StockEvent) =>
  `${e.ticker}|${e.date}|${e.kind}|${e.shares}|${e.amount}`;

export function planStockMerge(
  existing: StockEvent[],
  incoming: StockEvent[]
): { toInsert: StockEvent[]; skipped: number } {
  const seen = new Map<string, number>();
  for (const e of existing) seen.set(stockEventKey(e), (seen.get(stockEventKey(e)) ?? 0) + 1);
  const toInsert: StockEvent[] = [];
  let skipped = 0;
  for (const e of incoming) {
    const k = stockEventKey(e);
    const n = seen.get(k) ?? 0;
    if (n > 0) {
      seen.set(k, n - 1);
      skipped++;
    } else toInsert.push(e);
  }
  return { toInsert, skipped };
}
