import type { Dataset, Trade } from "../types";
import { daysBetween, todayISO } from "../lib/format";
import { indexByPosition, isWheelLeg, resolveStrategy } from "./strategies";

// ============================================================================
// Flywheel analytics engine.
//
// Accounting model (matches the "Options Trading.xlsx" workbook exactly):
//   realized premium P&L  = Σ all credits (CSP+CC premium)  −  Σ all buybacks
//                            (open contracts' premium counts immediately — cash basis)
//   assignment            = AAssignSTK debit, `invested` = shares × price paid
//   mark-to-market P&L    = realized  +  (sharesHeld × lastPrice − investedInHeld)
//   effective cost basis  = (investedInHeld − realized) / sharesHeld
// Verified against the workbook: realized $382.66, MTM −$399.34. Do not "fix"
// these formulas without re-checking that reconciliation.
// ============================================================================

export const isCredit = (t: Trade) => t.side === "credit";
export const isBuyback = (t: Trade) => t.action === "BB";
export const isAssign = (t: Trade) => t.action === "AAssignSTK";
// A "premium debit" = any cash-out option leg (buyback OR a spread's bought/
// closed leg), but NOT a stock assignment (that's capital deployment, tracked
// via `invested`). On wheel-only data this is exactly { BB }, so every realized
// formula below is unchanged to the penny; spreads (BTO/BTC) now flow in too.
export const isPremiumDebit = (t: Trade) => t.side === "debit" && !isAssign(t);
// The original wheel-native short contracts (CSP/CC). Win-rate / FIFO pairing
// is wheel-specific and must NOT pick up generic spread legs (STO/STC).
const isWheelShort = (t: Trade) => t.action === "CSP" || t.action === "CC";

export type Timeframe = "14d" | "30d" | "60d" | "90d" | "6M" | "1Y" | "YTD" | "ALL";

export const TIMEFRAMES: Timeframe[] = ["14d", "30d", "60d", "90d", "6M", "1Y", "YTD", "ALL"];

export function timeframeStart(tf: Timeframe, asOf = todayISO()): string {
  if (tf === "ALL") return "0000-01-01";
  if (tf === "YTD") return asOf.slice(0, 4) + "-01-01";
  const d = new Date(asOf);
  const map: Record<string, number> = { "14d": 14, "30d": 30, "60d": 60, "90d": 90 };
  if (tf in map) d.setDate(d.getDate() - map[tf]);
  else if (tf === "6M") d.setMonth(d.getMonth() - 6);
  else if (tf === "1Y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function filterByTimeframe(trades: Trade[], tf: Timeframe, asOf = todayISO()): Trade[] {
  const start = timeframeStart(tf, asOf);
  return trades.filter((t) => t.date >= start && t.date <= asOf);
}

// ---- net shares currently held per ticker ----------------------------------
export function sharesHeld(trades: Trade[], ticker: string): number {
  let s = 0;
  for (const t of trades) {
    if (t.ticker !== ticker) continue;
    if (isAssign(t)) s += t.shares; // put assigned → bought shares
    if (t.action === "CC" && t.status === "Assigned") s -= t.shares; // called away
  }
  return s;
}

export function investedInHeld(trades: Trade[], ticker: string): number {
  // capital still tied up in shares we currently hold (FIFO-ish: assignments net of call-aways)
  let held = sharesHeld(trades, ticker);
  if (held <= 0) return 0;
  let invested = 0;
  for (const t of trades) {
    if (t.ticker === ticker && isAssign(t) && t.invested) {
      const take = Math.min(t.shares, held);
      invested += (t.invested / t.shares) * take;
      held -= take;
      if (held <= 0) break;
    }
  }
  return invested;
}

export interface TickerStat {
  ticker: string;
  credits: number;
  buybacks: number;
  realized: number;
  contracts: number; // sold contracts
  resolved: number;
  wins: number;
  winRate: number;
  sharesHeld: number;
  invested: number;
  lastPrice: number;
  unrealized: number; // sharesHeld*(price-costBasis); 0 if flat
  costBasis: number; // per share effective
  mtm: number; // realized + unrealized
  capitalAtRisk: number; // invested in shares + open CSP collateral estimate
  openContracts: number;
}

export function tickerStats(ds: Dataset): TickerStat[] {
  const tickers = Array.from(new Set(ds.trades.map((t) => t.ticker)));
  const out: TickerStat[] = [];
  for (const ticker of tickers) {
    const tt = ds.trades.filter((t) => t.ticker === ticker);
    const credits = sum(tt.filter(isCredit).map((t) => t.amount));
    const buybacks = sum(tt.filter(isPremiumDebit).map((t) => t.amount));
    const realized = credits - buybacks;
    const soldContracts = tt.filter(isCredit);
    const resolvedSet = soldContracts.filter((t) =>
      ["Expired", "Closed", "Assigned"].includes(t.status)
    );
    const { wins } = pairTickerPositions(tt);
    const held = sharesHeld(tt, ticker);
    const invested = investedInHeld(tt, ticker);
    const lastPrice = ds.lastPrices[ticker] ?? 0;
    const costBasis = held > 0 ? (invested - realized) / held : 0;
    const unrealized = held > 0 ? held * (lastPrice - costBasis) : 0;
    const openContracts = soldContracts.filter((t) => t.status === "Open").length;
    const openCspCollateral = soldContracts
      .filter((t) => t.status === "Open" && t.action === "CSP")
      .reduce((a, t) => a + (t.strike ? t.strike * t.shares : lastPrice * t.shares), 0);
    out.push({
      ticker,
      credits,
      buybacks,
      realized,
      contracts: soldContracts.length,
      resolved: resolvedSet.length,
      wins,
      winRate: resolvedSet.length ? wins / resolvedSet.length : 0,
      sharesHeld: held,
      invested,
      lastPrice,
      unrealized,
      costBasis,
      mtm: realized + unrealized,
      capitalAtRisk: invested + openCspCollateral,
      openContracts,
    });
  }
  return out.sort((a, b) => b.realized - a.realized);
}

// ---- FIFO position pairing for win-rate / avg win-loss ----------------------
export interface ClosedPosition {
  ticker: string;
  action: "CSP" | "CC";
  openDate: string;
  closeDate: string;
  premium: number;
  cost: number; // buyback cost (0 if expired)
  pnl: number;
  outcome: "expired" | "bought-back" | "assigned";
  isWin: boolean;
  daysHeld: number;
}

function pairTickerPositions(tt: Trade[]): {
  closed: ClosedPosition[];
  wins: number;
} {
  const credits = tt
    .filter((t) => isWheelShort(t) && ["Expired", "Closed", "Assigned"].includes(t.status))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const buybacks = tt
    .filter(isBuyback)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const assigns = tt
    .filter(isAssign)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  let bi = 0;
  let ai = 0;
  const closed: ClosedPosition[] = [];
  for (const c of credits) {
    const action = c.action === "CC" ? "CC" : "CSP";
    if (c.status === "Expired") {
      closed.push(mkPos(c, action, c.date, c.amount, 0, "expired"));
    } else if (c.status === "Closed") {
      const bb = buybacks[bi++];
      const closeDate = bb ? bb.date : c.date;
      const cost = bb ? bb.amount : 0;
      closed.push(mkPos(c, action, closeDate, c.amount, cost, "bought-back"));
    } else if (c.status === "Assigned") {
      const as = assigns[ai++];
      const closeDate = as ? as.date : c.date;
      // option premium is kept; stock leg tracked separately as unrealized
      closed.push(mkPos(c, action, closeDate, c.amount, 0, "assigned"));
    }
  }
  const wins = closed.filter((p) => p.isWin).length;
  return { closed, wins };
}

function mkPos(
  c: Trade,
  action: "CSP" | "CC",
  closeDate: string,
  premium: number,
  cost: number,
  outcome: ClosedPosition["outcome"]
): ClosedPosition {
  const pnl = premium - cost;
  return {
    ticker: c.ticker,
    action,
    openDate: c.date,
    closeDate,
    premium,
    cost,
    pnl,
    outcome,
    // a "win" = you kept net premium (expired full, bought back for less, or
    // assigned but still pocketed the premium). A loss = bought back for more
    // than collected.
    isWin: pnl > 0 || outcome === "assigned",
    daysHeld: Math.max(0, daysBetween(c.date, closeDate)),
  };
}

export function allClosedPositions(ds: Dataset): ClosedPosition[] {
  const tickers = Array.from(new Set(ds.trades.map((t) => t.ticker)));
  return tickers
    .flatMap((tk) => pairTickerPositions(ds.trades.filter((t) => t.ticker === tk)).closed)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate));
}

// ---- capital base estimate -------------------------------------------------
// When the user hasn't set a capital base (e.g. a broker CSV carries no cash
// balance), estimate one from the trades: the peak cash-secured-put collateral
// committed at any one time (Σ strike×shares of puts open simultaneously). A
// sound denominator for yield-on-capital — far better than the $1 fallback.
//
// A put's collateral is freed when the put is *actually closed* — bought back or
// assigned — which for an active roller is usually weeks before expiry. Releasing
// only at expiry double-counts cash that was already redeployed and badly
// overstates the peak (e.g. a put bought back early still "holding" collateral
// alongside its replacement). So we release each put on its real close date,
// falling back to expiry only when no close is recorded (expired / still open).
export function estimateCapitalBase(trades: Trade[]): number {
  // FIFO queue of close dates per contract, from buybacks + assignments.
  const keyOf = (t: Trade) => `${t.ticker}|${t.expiry ?? ""}|${t.strike ?? ""}`;
  const closesByKey = new Map<string, string[]>();
  for (const t of trades) {
    if (t.action !== "BB" && t.action !== "AAssignSTK") continue;
    const k = keyOf(t);
    (closesByKey.get(k) ?? closesByKey.set(k, []).get(k)!).push(t.date);
  }
  for (const arr of closesByKey.values()) arr.sort();

  // Latest activity in the set — open puts stay collateralized through "now".
  let asOf = "";
  for (const t of trades) if (t.date > asOf) asOf = t.date;

  const expiryEnd = (t: Trade) => (t.expiry && t.expiry > t.date ? t.expiry : t.date);

  const pts: { d: string; a: number }[] = [];
  for (const t of trades) {
    if (t.action !== "CSP" || !t.strike) continue;
    const collateral = t.strike * t.shares;
    let end: string;
    if (t.status === "Closed" || t.status === "Assigned") {
      // Match the next recorded close for this contract; fall back to expiry.
      end = closesByKey.get(keyOf(t))?.shift() ?? expiryEnd(t);
    } else if (t.status === "Open") {
      end = asOf > t.date ? asOf : t.date; // never released — held to present
    } else {
      end = expiryEnd(t); // Expired (or unknown) — collateral held to expiry
    }
    if (end < t.date) end = t.date;
    pts.push({ d: t.date, a: collateral }); // collateral committed
    pts.push({ d: end, a: -collateral }); // released when actually closed
  }
  if (!pts.length) return 0;
  // Release (−) before open (+) on the same day so a same-day roll isn't double-counted.
  pts.sort((x, y) => x.d.localeCompare(y.d) || x.a - y.a);
  let cur = 0;
  let peak = 0;
  for (const p of pts) {
    cur += p.a;
    if (cur > peak) peak = cur;
  }
  return Math.round(peak);
}

// ---- portfolio headline ----------------------------------------------------
export interface Portfolio {
  realized: number;
  premiumCollected: number;
  buybacks: number;
  mtm: number;
  unrealized: number;
  capitalBase: number;
  capitalEstimated: boolean; // true when capitalBase was derived, not user-set
  hasSpy: boolean; // false when no SPY benchmark is configured
  returnPct: number; // realized / capital
  mtmReturnPct: number;
  annualizedReturn: number;
  daysActive: number;
  firstTrade: string;
  monthlyYield: number; // realized / capital / months
  winRate: number;
  resolvedCount: number;
  wins: number;
  losses: number;
  assignedCount: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  spyReturn: number;
  alpha: number;
  contracts: number;
  openContracts: number;
  capitalDeployed: number;
  deployedPct: number;
  tickers: TickerStat[];
}

export function computePortfolio(ds: Dataset, asOf = todayISO()): Portfolio {
  const tickers = tickerStats(ds);
  const realized = sum(tickers.map((t) => t.realized));
  const premiumCollected = sum(tickers.map((t) => t.credits));
  const buybacks = sum(tickers.map((t) => t.buybacks));
  const unrealized = sum(tickers.map((t) => t.unrealized));
  const mtm = realized + unrealized;
  const capitalEstimated = !ds.capitalBase;
  const capitalBase = ds.capitalBase || estimateCapitalBase(ds.trades) || 1;

  const closed = allClosedPositions(ds);
  const wins = closed.filter((p) => p.isWin && p.outcome !== "assigned").length;
  const losses = closed.filter((p) => !p.isWin).length;
  const assignedCount = closed.filter((p) => p.outcome === "assigned").length;
  const resolvedCount = closed.length;
  const winRate = resolvedCount ? closed.filter((p) => p.isWin).length / resolvedCount : 0;
  const winPnls = closed.filter((p) => p.pnl > 0).map((p) => p.pnl);
  const lossPnls = closed.filter((p) => p.pnl < 0).map((p) => p.pnl);
  const avgWin = winPnls.length ? sum(winPnls) / winPnls.length : 0;
  const avgLoss = lossPnls.length ? sum(lossPnls) / lossPnls.length : 0;
  const expectancy = resolvedCount ? sum(closed.map((p) => p.pnl)) / resolvedCount : 0;

  const dates = ds.trades.map((t) => t.date).sort();
  const firstTrade = dates[0] ?? asOf;
  const daysActive = Math.max(1, daysBetween(firstTrade, asOf));
  const returnPct = realized / capitalBase;
  const annualizedReturn = returnPct * (365 / daysActive);
  const monthlyYield = returnPct / (daysActive / 30.4);

  const hasSpy = ds.spy.year_ago > 0;
  const spyReturn = hasSpy ? ds.spy.now / ds.spy.year_ago - 1 : 0;
  const alpha = returnPct - spyReturn;

  const contracts = sum(tickers.map((t) => t.contracts));
  const openContracts = sum(tickers.map((t) => t.openContracts));
  const capitalDeployed = sum(tickers.map((t) => t.capitalAtRisk));

  return {
    realized,
    premiumCollected,
    buybacks,
    mtm,
    unrealized,
    capitalBase,
    capitalEstimated,
    hasSpy,
    returnPct,
    mtmReturnPct: mtm / capitalBase,
    annualizedReturn,
    daysActive,
    firstTrade,
    monthlyYield,
    winRate,
    resolvedCount,
    wins,
    losses,
    assignedCount,
    avgWin,
    avgLoss,
    expectancy,
    spyReturn,
    alpha,
    contracts,
    openContracts,
    capitalDeployed,
    deployedPct: capitalDeployed / capitalBase,
    tickers,
  };
}

// ---- monthly series + cumulative premium curve -----------------------------
export interface MonthPoint {
  month: string; // YYYY-MM
  pl: number;
  premium: number;
  buybacks: number;
  cumulative: number;
}

export function monthlySeries(ds: Dataset): MonthPoint[] {
  const byMonth = new Map<string, { premium: number; buybacks: number }>();
  for (const t of ds.trades) {
    const m = t.date.slice(0, 7);
    const e = byMonth.get(m) ?? { premium: 0, buybacks: 0 };
    if (isCredit(t)) e.premium += t.amount;
    else if (isPremiumDebit(t)) e.buybacks += t.amount;
    byMonth.set(m, e);
  }
  const months = Array.from(byMonth.keys()).sort();
  let cum = 0;
  return months.map((m) => {
    const e = byMonth.get(m)!;
    const pl = e.premium - e.buybacks;
    cum += pl;
    return { month: m, pl, premium: e.premium, buybacks: e.buybacks, cumulative: cum };
  });
}

// Daily cumulative realized premium (smooth equity-style curve).
export function cumulativeCurve(ds: Dataset): { date: string; value: number }[] {
  const evts = ds.trades
    .filter((t) => isCredit(t) || isPremiumDebit(t))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  const map = new Map<string, number>();
  for (const t of evts) {
    cum += isCredit(t) ? t.amount : -t.amount;
    map.set(t.date, cum);
  }
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

// ---- strategy breakdown ----------------------------------------------------
export interface StrategyStat {
  key: "CSP" | "CC";
  contracts: number;
  resolved: number;
  wins: number;
  winRate: number;
  premium: number;
  avgPremium: number;
  net: number; // premium - paired buybacks
}

export function strategyStats(ds: Dataset): StrategyStat[] {
  const closed = allClosedPositions(ds);
  return (["CSP", "CC"] as const).map((key) => {
    const sold = ds.trades.filter((t) => isCredit(t) && t.action === key);
    const cl = closed.filter((p) => p.action === key);
    const wins = cl.filter((p) => p.isWin).length;
    const premium = sum(sold.map((t) => t.amount));
    return {
      key,
      contracts: sold.length,
      resolved: cl.length,
      wins,
      winRate: cl.length ? wins / cl.length : 0,
      premium,
      avgPremium: sold.length ? premium / sold.length : 0,
      net: sum(cl.map((p) => p.pnl)),
    };
  });
}

// ---- wheel campaigns -------------------------------------------------------
export type WheelState = "Selling puts" | "Holding shares" | "Idle";

export interface WheelCampaign {
  ticker: string;
  state: WheelState;
  cyclesCompleted: number; // shares acquired then fully called/sold away
  putsAssigned: number;
  realized: number;
  premiumCollected: number;
  sharesHeld: number;
  costBasis: number;
  lastPrice: number;
  unrealized: number;
  capitalAtRisk: number;
  firstDate: string;
  lastDate: string;
  contracts: number;
  cushionPct: number; // how far premium has pushed cost basis below assignment price
}

export function computeCampaigns(ds: Dataset): WheelCampaign[] {
  const stats = tickerStats(ds);
  return stats
    .map((s): WheelCampaign => {
      const tt = ds.trades.filter((t) => t.ticker === s.ticker);
      const dates = tt.map((t) => t.date).sort();
      const putsAssigned = tt.filter((t) => isAssign(t)).length;
      const calledAway = tt.filter((t) => t.action === "CC" && t.status === "Assigned").length;
      const state: WheelState =
        s.sharesHeld > 0 ? "Holding shares" : s.openContracts > 0 ? "Selling puts" : "Idle";
      const assignPrice = s.sharesHeld > 0 && s.invested ? s.invested / s.sharesHeld : 0;
      return {
        ticker: s.ticker,
        state,
        cyclesCompleted: calledAway,
        putsAssigned,
        realized: s.realized,
        premiumCollected: s.credits,
        sharesHeld: s.sharesHeld,
        costBasis: s.costBasis,
        lastPrice: s.lastPrice,
        unrealized: s.unrealized,
        capitalAtRisk: s.capitalAtRisk,
        firstDate: dates[0] ?? "",
        lastDate: dates[dates.length - 1] ?? "",
        contracts: s.contracts,
        cushionPct: assignPrice > 0 ? (assignPrice - s.costBasis) / assignPrice : 0,
      };
    })
    .sort((a, b) => b.premiumCollected - a.premiumCollected);
}

// ---- wheels (per-cycle, with user override) --------------------------------
// A "wheel" is one cycle of the strategy: sell put(s) → (maybe) get assigned →
// sell calls → get called away, back to flat. The next put after a cycle
// completes starts a NEW wheel. This is finer-grained than computeCampaigns
// (which lumps a whole ticker together) and is what the Trades/Campaigns UI
// uses for the "is this part of a wheel?" tagging.
//
// Grouping precedence per trade:
//   • wheelId === WHEEL_EXCLUDED  → not part of any wheel (hidden from wheels)
//   • wheelId set (any other)     → pinned to that explicit wheel (confirm/merge/split)
//   • wheelId null/undefined      → falls into its auto-detected cycle
// Auto cycle ids start with "auto:"; an explicit (user-confirmed) id never does,
// so `auto` on the result distinguishes "suggested" from "confirmed".

export const WHEEL_EXCLUDED = "__none__";

export type WheelStatus = "Selling puts" | "Holding shares" | "Complete";

export interface Wheel {
  id: string;
  ticker: string;
  /** true = auto-detected suggestion (not yet user-confirmed). */
  auto: boolean;
  status: WheelStatus;
  startDate: string;
  endDate: string;
  tradeIds: string[];
  contracts: number; // sold contracts
  putsAssigned: number;
  calledAway: number;
  premiumCollected: number;
  buybacks: number;
  realized: number;
  sharesHeld: number;
  costBasis: number;
  lastPrice: number;
  unrealized: number;
  capitalAtRisk: number;
}

/** Auto-detected cycle id for every trade, keyed by trade id. Pure + deterministic. */
function autoCycleIds(ds: Dataset): Map<string, string> {
  const ids = new Map<string, string>();
  // Only wheel-native legs (CSP/CC/BB/assignment) form wheel cycles — generic
  // spread legs on the same ticker must never be absorbed into a wheel.
  const wheelTrades = ds.trades.filter(isWheelLeg);
  const tickers = Array.from(new Set(wheelTrades.map((t) => t.ticker)));
  for (const ticker of tickers) {
    const sorted = wheelTrades
      .filter((t) => t.ticker === ticker)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    let active = false;
    let idx = 0;
    let shares = 0;
    let everHeld = false;
    let openCredits = 0;
    let startDate = "";

    for (const t of sorted) {
      if (!active) {
        active = true;
        idx++;
        shares = 0;
        everHeld = false;
        openCredits = 0;
        startDate = t.date;
      }
      ids.set(t.id, `auto:${ticker}:${startDate}:${idx}`);

      if (isAssign(t)) {
        shares += t.shares;
        everHeld = true;
      }
      if (t.action === "CC" && t.status === "Assigned") shares -= t.shares;
      if (isCredit(t) && t.status === "Open") openCredits++;

      // A cycle completes only once it has held shares and returned to flat with
      // nothing still open — so a streak of expiring puts stays ONE wheel.
      if (everHeld && shares <= 0 && openCredits === 0) active = false;
    }
  }
  return ids;
}

export function computeWheels(ds: Dataset): Wheel[] {
  const auto = autoCycleIds(ds);

  // Resolve each trade's final wheel key (or null when excluded).
  const groups = new Map<string, Trade[]>();
  for (const t of ds.trades) {
    if (!isWheelLeg(t)) continue; // spreads / generic legs are not wheels
    if (t.wheelId === WHEEL_EXCLUDED) continue;
    const key = t.wheelId ?? auto.get(t.id);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const wheels: Wheel[] = [];
  for (const [id, tt] of groups) {
    const ticker = tt[0].ticker;
    const dates = tt.map((t) => t.date).sort();
    const sold = tt.filter(isCredit);
    const credits = sum(sold.map((t) => t.amount));
    const buybacks = sum(tt.filter(isBuyback).map((t) => t.amount));
    const realized = credits - buybacks;
    const held = sharesHeld(tt, ticker);
    const invested = investedInHeld(tt, ticker);
    const lastPrice = ds.lastPrices[ticker] ?? 0;
    const costBasis = held > 0 ? (invested - realized) / held : 0;
    const unrealized = held > 0 ? held * (lastPrice - costBasis) : 0;
    const openContracts = sold.filter((t) => t.status === "Open").length;
    const openCspCollateral = sold
      .filter((t) => t.status === "Open" && t.action === "CSP")
      .reduce((a, t) => a + (t.strike ? t.strike * t.shares : lastPrice * t.shares), 0);
    const status: WheelStatus =
      held > 0 ? "Holding shares" : openContracts > 0 ? "Selling puts" : "Complete";

    wheels.push({
      id,
      ticker,
      auto: id.startsWith("auto:"),
      status,
      startDate: dates[0] ?? "",
      endDate: dates[dates.length - 1] ?? "",
      tradeIds: tt.map((t) => t.id),
      contracts: sold.length,
      putsAssigned: tt.filter(isAssign).length,
      calledAway: tt.filter((t) => t.action === "CC" && t.status === "Assigned").length,
      premiumCollected: credits,
      buybacks,
      realized,
      sharesHeld: held,
      costBasis,
      lastPrice,
      unrealized,
      capitalAtRisk: invested + openCspCollateral,
    });
  }

  // Active wheels first (holding > selling > complete), then most recent.
  const rank: Record<WheelStatus, number> = { "Holding shares": 0, "Selling puts": 1, Complete: 2 };
  return wheels.sort(
    (a, b) => rank[a.status] - rank[b.status] || b.startDate.localeCompare(a.startDate)
  );
}

// ---- open positions (for the radar) ----------------------------------------
export interface OpenPosition {
  trade: Trade;
  daysOpen: number;
  dte: number | null;
  earningsRisk: boolean;
  collateral: number;
}

export function openPositions(ds: Dataset, asOf = todayISO()): OpenPosition[] {
  return ds.trades
    .filter((t) => isCredit(t) && t.status === "Open")
    .map((trade) => {
      const lastPrice = ds.lastPrices[trade.ticker] ?? 0;
      const dte = trade.expiry ? daysBetween(asOf, trade.expiry) : null;
      const collateral =
        trade.action === "CSP"
          ? (trade.strike ? trade.strike : lastPrice) * trade.shares
          : lastPrice * trade.shares;
      return {
        trade,
        daysOpen: Math.max(0, daysBetween(trade.date, asOf)),
        dte,
        earningsRisk: false,
        collateral,
      };
    })
    .sort((a, b) => (a.dte ?? 9999) - (b.dte ?? 9999));
}

// ---- timeframe-scoped P&L for the dashboard filter -------------------------
export function realizedInTimeframe(ds: Dataset, tf: Timeframe, asOf = todayISO()): number {
  const trades = filterByTimeframe(ds.trades, tf, asOf);
  const credits = sum(trades.filter(isCredit).map((t) => t.amount));
  const bb = sum(trades.filter(isPremiumDebit).map((t) => t.amount));
  return credits - bb;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// ============================================================================
// Multi-strategy layer (JF-27). Sits ON TOP of the validated wheel engine —
// it re-partitions the SAME trades by strategy, so combined realized always
// reconciles to computePortfolio().realized to the penny.
// ============================================================================

// ---- positions (legs grouped into one unit) --------------------------------
export interface Position {
  id: string;
  ticker: string;
  strategy: string;
  legs: Trade[];
  isMultiLeg: boolean;
  openDate: string;
  closeDate: string | null;
  open: boolean;
  /** Entry net cash: + = net credit received, − = net debit paid (dollars). */
  netCredit: number;
  /** Cash-basis realized P&L (dollars) — same accounting as the wheel engine. */
  realized: number;
  maxProfit: number | null;
  maxLoss: number | null;
  /** Strike width in dollars (per-share width × shares), for verticals. */
  width: number | null;
  breakevens: number[];
  /** Capital at risk while open (collateral / max loss / debit paid). */
  capitalAtRisk: number;
}

const OPENING = new Set<Trade["action"]>(["CSP", "CC", "STO", "BTO"]);
const isOpening = (t: Trade) => OPENING.has(t.action);

/** Defined-risk metrics for a recognized vertical / condor; nulls otherwise. */
function spreadMetrics(
  legs: Trade[],
  strategy: string,
  netCredit: number
): Pick<Position, "maxProfit" | "maxLoss" | "width" | "breakevens"> {
  const none = { maxProfit: null, maxLoss: null, width: null, breakevens: [] as number[] };
  const opens = legs.filter(isOpening);
  const shares = opens[0]?.shares || 100;
  const strikeOf = (t: Trade | undefined) => (t && t.strike ? t.strike : null);

  const isVertical = [
    "put-credit-spread",
    "call-credit-spread",
    "put-debit-spread",
    "call-debit-spread",
  ].includes(strategy);

  if (isVertical && opens.length === 2) {
    const shortLeg = opens.find((t) => t.side === "credit");
    const longLeg = opens.find((t) => t.side === "debit");
    const ks = strikeOf(shortLeg);
    const kl = strikeOf(longLeg);
    if (ks == null || kl == null) return none;
    const widthPerShare = Math.abs(ks - kl);
    const width = widthPerShare * shares;
    const credit = netCredit >= 0;
    const maxProfit = credit ? netCredit : width - Math.abs(netCredit);
    const maxLoss = credit ? width - netCredit : Math.abs(netCredit);
    // BE = anchor strike ± net premium per share. Puts lose to the downside (−),
    // calls to the upside (+). Anchor = short strike (credit) or long strike (debit).
    const isPut = strategy.startsWith("put");
    const anchor = credit ? ks : kl;
    const be = anchor + (isPut ? -1 : 1) * (Math.abs(netCredit) / shares);
    return { maxProfit, maxLoss, width, breakevens: [round2(be)] };
  }

  if (strategy === "iron-condor") {
    const puts = opens.filter((t) => t.optionType === "put").map((t) => t.strike || 0);
    const calls = opens.filter((t) => t.optionType === "call").map((t) => t.strike || 0);
    const putW = puts.length === 2 ? Math.abs(puts[0] - puts[1]) : 0;
    const callW = calls.length === 2 ? Math.abs(calls[0] - calls[1]) : 0;
    const width = Math.max(putW, callW) * shares;
    if (!width) return none;
    return { maxProfit: netCredit, maxLoss: width - netCredit, width, breakevens: [] };
  }
  return none;
}

function buildPosition(id: string, legs: Trade[], inWheel: Set<string>, byPos: Map<string, Trade[]>): Position {
  const sorted = legs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const strategy = resolveStrategy(sorted[0], { byPosition: byPos, inWheel });
  const credits = sum(legs.filter(isCredit).map((t) => t.amount));
  const debits = sum(legs.filter(isPremiumDebit).map((t) => t.amount));
  const realized = credits - debits;
  // Entry net uses opening legs only (closes don't change the structure's net).
  const opens = legs.filter(isOpening);
  const netCredit =
    sum(opens.filter((t) => t.side === "credit").map((t) => t.amount)) -
    sum(opens.filter((t) => t.side === "debit").map((t) => t.amount));

  // A position is open while any leg is still Open.
  const open = legs.some((t) => t.status === "Open");
  const closeDate = open ? null : sorted[sorted.length - 1].date;

  const m = spreadMetrics(legs, strategy, netCredit);
  // Capital at risk while open: defined-risk → maxLoss; short put → collateral;
  // long option / covered call → debit paid / 0.
  let capitalAtRisk = 0;
  if (open) {
    if (m.maxLoss != null) capitalAtRisk = m.maxLoss;
    else if (strategy === "csp" || strategy === "wheel") {
      const p = opens.find((t) => t.action === "CSP" || (t.action === "STO" && t.optionType === "put"));
      capitalAtRisk = p?.strike ? p.strike * p.shares : 0;
    } else if (strategy === "long-call" || strategy === "long-put") {
      capitalAtRisk = Math.abs(netCredit);
    }
  }

  return {
    id,
    ticker: sorted[0].ticker,
    strategy,
    legs: sorted,
    isMultiLeg: legs.length > 1,
    openDate: sorted[0].date,
    closeDate,
    open,
    netCredit: round2(netCredit),
    realized: round2(realized),
    maxProfit: m.maxProfit != null ? round2(m.maxProfit) : null,
    maxLoss: m.maxLoss != null ? round2(m.maxLoss) : null,
    width: m.width,
    breakevens: m.breakevens,
    capitalAtRisk: round2(capitalAtRisk),
  };
}

/**
 * Partition every trade into positions: legs sharing a positionId form one
 * multi-leg position; every other trade is its own single-leg position. The
 * sum of position.realized over all positions == computePortfolio().realized.
 */
export function computePositions(ds: Dataset): Position[] {
  const byPos = indexByPosition(ds.trades);
  const inWheel = new Set(computeWheels(ds).flatMap((w) => w.tradeIds));
  const positions: Position[] = [];
  const consumed = new Set<string>();

  for (const [pid, legs] of byPos) {
    if (legs.length < 2) continue; // a lone positionId is effectively single-leg
    legs.forEach((l) => consumed.add(l.id));
    positions.push(buildPosition(pid, legs, inWheel, byPos));
  }
  for (const t of ds.trades) {
    if (consumed.has(t.id)) continue;
    positions.push(buildPosition(t.id, [t], inWheel, byPos));
  }
  return positions.sort((a, b) => b.openDate.localeCompare(a.openDate));
}

// ---- per-strategy breakdown (the headline of the Strategies page) ----------
export interface StrategyBreakdown {
  key: string;
  realized: number;
  premium: number; // credits collected
  debits: number; // premium paid out
  positions: number;
  openPositions: number;
  capitalAtRisk: number;
  /** realized / total realized across all strategies (sign-aware share). */
  shareOfRealized: number;
  /** realized / capitalAtRisk — the "is this working?" return-on-risk signal. */
  roi: number;
  firstDate: string;
  lastDate: string;
}

export function strategyBreakdown(ds: Dataset): StrategyBreakdown[] {
  const positions = computePositions(ds);
  const byStrat = new Map<string, Position[]>();
  for (const p of positions) (byStrat.get(p.strategy) ?? byStrat.set(p.strategy, []).get(p.strategy)!).push(p);

  const totalRealizedAbs = sum(positions.map((p) => Math.abs(p.realized))) || 1;
  const out: StrategyBreakdown[] = [];
  for (const [key, ps] of byStrat) {
    const realized = sum(ps.map((p) => p.realized));
    const premium = sum(ps.flatMap((p) => p.legs.filter(isCredit).map((t) => t.amount)));
    const debits = sum(ps.flatMap((p) => p.legs.filter(isPremiumDebit).map((t) => t.amount)));
    const capitalAtRisk = sum(ps.map((p) => p.capitalAtRisk));
    const dates = ps.flatMap((p) => p.legs.map((t) => t.date)).sort();
    out.push({
      key,
      realized: round2(realized),
      premium: round2(premium),
      debits: round2(debits),
      positions: ps.length,
      openPositions: ps.filter((p) => p.open).length,
      capitalAtRisk: round2(capitalAtRisk),
      shareOfRealized: realized / totalRealizedAbs,
      roi: capitalAtRisk > 0 ? realized / capitalAtRisk : 0,
      firstDate: dates[0] ?? "",
      lastDate: dates[dates.length - 1] ?? "",
    });
  }
  // Best performers first (by realized).
  return out.sort((a, b) => b.realized - a.realized);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
