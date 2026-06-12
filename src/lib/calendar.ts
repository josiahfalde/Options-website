import type { Dataset, Trade } from "../types";
import { isCredit, isBuyback, isAssign } from "../data/compute";

// ---------------------------------------------------------------------------
// Calendar aggregation — pure view-layer helpers that bucket the dataset's
// trades by calendar day for the month-grid heatmap, activity and upcoming
// views. Read-only: consumes trades + lastPrices through the public Dataset
// shape only. No analytics-engine changes.
// ---------------------------------------------------------------------------

export interface DayCell {
  iso: string; // YYYY-MM-DD
  trades: Trade[];
  /** realized premium that day = credits − buybacks (cash basis, matches engine) */
  net: number;
  credits: number;
  buybacks: number;
  events: number; // count of trades touching the day
  sold: number; // CSP + CC opened
  closed: number; // BB
  expired: number;
  assigned: number;
}

export interface UpcomingItem {
  iso: string;
  trade: Trade;
  kind: "expiry" | "earnings";
}

const EARN_RE = /earn:(\d{4}-\d{2}-\d{2})/;

/** Bucket realized-premium activity by trade date for a month grid. */
export function dailyActivity(ds: Dataset): Map<string, DayCell> {
  const map = new Map<string, DayCell>();
  const get = (iso: string): DayCell => {
    let c = map.get(iso);
    if (!c) {
      c = {
        iso,
        trades: [],
        net: 0,
        credits: 0,
        buybacks: 0,
        events: 0,
        sold: 0,
        closed: 0,
        expired: 0,
        assigned: 0,
      };
      map.set(iso, c);
    }
    return c;
  };

  for (const t of ds.trades) {
    const c = get(t.date);
    c.trades.push(t);
    c.events += 1;
    if (isCredit(t)) {
      c.credits += t.amount;
      c.net += t.amount;
      c.sold += 1;
      if (t.status === "Expired") c.expired += 1;
      if (t.status === "Assigned") c.assigned += 1;
    } else if (isBuyback(t)) {
      c.buybacks += t.amount;
      c.net -= t.amount;
      c.closed += 1;
    } else if (isAssign(t)) {
      c.assigned += 1;
    }
  }
  return map;
}

/** Forward-looking expiries (open positions) + earnings tokens, keyed by date. */
export function upcomingByDay(ds: Dataset, fromISO: string): Map<string, UpcomingItem[]> {
  const map = new Map<string, UpcomingItem[]>();
  const push = (iso: string, item: UpcomingItem) => {
    const arr = map.get(iso) ?? [];
    arr.push(item);
    map.set(iso, arr);
  };
  for (const t of ds.trades) {
    if (t.side === "credit" && t.status === "Open" && t.expiry && t.expiry >= fromISO) {
      push(t.expiry, { iso: t.expiry, trade: t, kind: "expiry" });
    }
    const m = t.note?.match(EARN_RE);
    if (m && m[1] >= fromISO) {
      push(m[1], { iso: m[1], trade: t, kind: "earnings" });
    }
  }
  return map;
}

export interface MonthSummary {
  net: number;
  credits: number;
  buybacks: number;
  events: number;
  greenDays: number;
  redDays: number;
  activeDays: number;
}

export function monthSummary(cells: DayCell[]): MonthSummary {
  let net = 0,
    credits = 0,
    buybacks = 0,
    events = 0,
    greenDays = 0,
    redDays = 0,
    activeDays = 0;
  for (const c of cells) {
    net += c.net;
    credits += c.credits;
    buybacks += c.buybacks;
    events += c.events;
    if (c.events > 0) activeDays += 1;
    if (c.net > 0) greenDays += 1;
    else if (c.net < 0) redDays += 1;
  }
  return { net, credits, buybacks, events, greenDays, redDays, activeDays };
}

// ---- month grid scaffolding ------------------------------------------------

export interface GridDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** YYYY-MM for a given year/monthIndex(0-11). */
export function ymKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export function isoOf(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A 6-row × 7-col grid (weeks start Sunday) covering the given month. */
export function monthGrid(year: number, month0: number): GridDay[] {
  const first = new Date(year, month0, 1);
  const startDow = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const prevDays = new Date(year, month0, 0).getDate();
  const cells: GridDay[] = [];

  // leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevDays - i;
    const pm = month0 === 0 ? 11 : month0 - 1;
    const py = month0 === 0 ? year - 1 : year;
    cells.push({ iso: isoOf(py, pm, d), day: d, inMonth: false });
  }
  // this month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: isoOf(year, month0, d), day: d, inMonth: true });
  }
  // trailing days to fill to a multiple of 7 (always render 6 rows = 42 cells
  // for a stable height)
  let nd = 1;
  while (cells.length < 42) {
    const nm = month0 === 11 ? 0 : month0 + 1;
    const ny = month0 === 11 ? year + 1 : year;
    cells.push({ iso: isoOf(ny, nm, nd), day: nd, inMonth: false });
    nd++;
  }
  return cells;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
