// ---- Core domain types -----------------------------------------------------
// A Trade is one leg / one transaction row — from the Wheel workbook, a manual
// entry, or a broker CSV. Credits = premium collected; debits = premium paid /
// assignments.
//
// Action vocabulary:
//   Wheel-native (single-leg, the original model — accounting validated to the
//   penny, do not disturb):
//     CSP        sell a cash-secured put (credit)
//     CC         sell a covered call (credit)
//     BB         buy back a short option (debit)
//     AAssignSTK put assigned → bought shares (debit; `invested` = capital)
//   Generic option legs (added JF-27 for spreads / multi-leg strategies). These
//   carry `optionType` and are grouped into one position via `positionId`:
//     STO        sell-to-open  (credit)
//     BTO        buy-to-open   (debit)
//     STC        sell-to-close (credit)
//     BTC        buy-to-close  (debit)
export type TradeAction =
  | "CSP"
  | "CC"
  | "BB"
  | "AAssignSTK"
  | "STO"
  | "BTO"
  | "STC"
  | "BTC";
export type TradeSide = "credit" | "debit";

export type OptionType = "put" | "call";

// Outcome status of a sold contract.
export type TradeStatus =
  | "Open"
  | "Expired"
  | "Closed"
  | "Assigned"
  | ""; // debits carry no status

export interface Trade {
  id: string;
  ticker: string;
  side: TradeSide;
  action: TradeAction;
  date: string; // YYYY-MM-DD
  shares: number;
  /** Dollar total for the contract: premium collected (credit) or cost paid (debit). */
  amount: number;
  /** Capital deployed on an assignment (shares * price). Only on AAssignSTK. */
  invested?: number | null;
  status: TradeStatus;
  /** Optional metadata for manual entries / future broker imports. */
  strike?: number | null;
  expiry?: string | null;
  note?: string | null;
  thesis?: string | null;
  grade?: number | null; // 1-5 self-graded execution
  /**
   * Wheel-grouping override (see computeWheels). null = auto-detected cycle;
   * an explicit id pins this trade to a specific wheel (used to confirm /
   * merge / split); the WHEEL_EXCLUDED sentinel marks "not part of any wheel".
   */
  wheelId?: string | null;
  // ---- Multi-strategy fields (JF-27) ----------------------------------------
  /**
   * Strategy bucket this trade belongs to (see strategies.ts). A predefined
   * StrategyKey ("wheel", "put-credit-spread", …) OR an arbitrary custom-bucket
   * label. null/undefined = auto-detected from structure (see resolveStrategy).
   */
  strategy?: string | null;
  /**
   * Groups legs of one multi-leg position (e.g. the two legs of a vertical
   * spread). null/undefined = a standalone single-leg position. Mirrors the
   * wheelId precedence pattern: legs sharing a positionId are one unit.
   */
  positionId?: string | null;
  /** Put or call — set on generic option legs (STO/BTO/STC/BTC) for spreads. */
  optionType?: OptionType | null;
}

export interface SpyBenchmark {
  now: number;
  year_ago: number;
  year_ago_date: string;
}

// ---- Stock (share) events — the allocation layer -------------------------
// Outright share buys / sells / dividend reinvestments, imported from a broker
// history CSV or entered by hand. Kept SEPARATE from Trade so the validated
// premium accounting in compute.ts never sees them. Shares acquired via put
// assignment (and called away via CC assignment) are NOT stored here: they
// already live on the option trades and are combined at read time by
// computeAllocation().
export type StockEventKind = "buy" | "sell" | "reinvest";

export interface StockEvent {
  id: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  kind: StockEventKind;
  /** Share count, always positive; `kind` carries the direction. */
  shares: number;
  /** Fill price per share (0 if the source didn't carry one). */
  price: number;
  /** Absolute dollar total of the fill (shares * price when price is known). */
  amount: number;
}

export interface Dataset {
  exportedAt: string;
  capitalBase: number;
  lastPrices: Record<string, number>;
  spy: SpyBenchmark;
  trades: Trade[];
  /** Share-level events (see StockEvent). Optional for older exports. */
  stockEvents?: StockEvent[];
  /** Per-ticker sector overrides; unknown tickers fall back to the built-in map. */
  sectors?: Record<string, string>;
}
