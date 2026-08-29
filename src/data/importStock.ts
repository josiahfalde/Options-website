import type { StockEvent } from "../types";
import { splitCsv, normalizeDate } from "./importXlsx";

// ============================================================================
// Fidelity "Accounts History" CSV → share-level StockEvents.
//
// The option parser (parseFidelityCsv) only reads option rows. This one reads
// the SHARE rows in the same file so the Allocation page can see outright
// holdings:
//
//   YOU BOUGHT <name> (TICKER) ...                 buy
//   YOU SOLD <name> (TICKER) ...                   sell
//   REINVESTMENT <name> (TICKER) ...               reinvest (DRIP)
//
// Deliberately SKIPPED, because they are already represented on the option
// trades and would double count:
//   YOU BOUGHT ... ASSIGNED PUTS / YOU SOLD ... ASSIGNED CALLS
//   anything whose symbol is an option contract
//   money-market sweeps (SPAXX / FDRXX / FZFXX), cash transfers, dividends paid
//     in cash, fees, interest
// ============================================================================

const isOptionSymbol = (sym: string) => /^-?[A-Z]+\d{6}[CP]\d/.test(sym.replace(/\s/g, ""));
const MONEY_MARKET = new Set(["SPAXX", "FDRXX", "FZFXX", "FCASH", "FDLXX", "SPRXX"]);

export interface StockImport {
  events: StockEvent[];
  /** Rows that looked like share activity but we chose not to import (assignments). */
  skippedAssignments: number;
}

export function parseFidelityStockCsv(text: string): StockImport {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /run date/i.test(l) && /action/i.test(l));
  if (headerIdx < 0) return { events: [], skippedAssignments: 0 };

  const header = splitCsv(lines[headerIdx]).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const cAction = idx("action");
  const cDate = idx("run date") >= 0 ? idx("run date") : idx("date");
  const cSymbol = idx("symbol");
  const cPrice = idx("price");
  const cQty = idx("quantity");
  const cAmount = idx("amount");

  const events: StockEvent[] = [];
  let skippedAssignments = 0;
  let n = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = splitCsv(lines[i]);
    const action = (f[cAction] || "").toUpperCase();
    const symbol = (f[cSymbol] || "").trim().toUpperCase();
    if (!symbol || isOptionSymbol(symbol) || MONEY_MARKET.has(symbol)) continue;
    if (!/^[A-Z.]{1,6}$/.test(symbol)) continue; // not an equity ticker

    let kind: StockEvent["kind"] | null = null;
    if (/^YOU BOUGHT/.test(action)) kind = "buy";
    else if (/^YOU SOLD/.test(action)) kind = "sell";
    else if (/^REINVESTMENT/.test(action)) kind = "reinvest";
    if (!kind) continue;

    if (/ASSIGNED|EXERCISE/.test(action)) {
      skippedAssignments++;
      continue;
    }

    const date = normalizeDate(f[cDate] || "");
    if (!date) continue;
    const shares = Math.abs(parseFloat((f[cQty] || "0").replace(/[,]/g, "")) || 0);
    if (shares <= 0) continue;
    const price = Math.abs(parseFloat((f[cPrice] || "0").replace(/[$,]/g, "")) || 0);
    const amount = Math.abs(parseFloat((f[cAmount] || "0").replace(/[$,]/g, "")) || 0);

    events.push({
      id: `fs-${n++}`,
      ticker: symbol,
      date,
      kind,
      shares,
      price,
      amount: amount || Math.round(shares * price * 100) / 100,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
  return { events, skippedAssignments };
}
