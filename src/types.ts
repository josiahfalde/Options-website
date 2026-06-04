// ---- Core domain types -----------------------------------------------------
// A Trade is one row from the Wheel workbook (or a manual / CSV entry).
// Credits = sold contracts (you collect premium). Debits = buybacks / assignments.

export type TradeAction = "CSP" | "CC" | "BB" | "AAssignSTK";
export type TradeSide = "credit" | "debit";

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
}

export interface SpyBenchmark {
  now: number;
  year_ago: number;
  year_ago_date: string;
}

export interface Dataset {
  exportedAt: string;
  capitalBase: number;
  lastPrices: Record<string, number>;
  spy: SpyBenchmark;
  trades: Trade[];
}
