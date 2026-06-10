import * as XLSX from "xlsx";
import type { Dataset, Trade, TradeAction } from "../types";
import { estimateCapitalBase } from "./compute";

// Mirrors tools/export_workbook.py — parses the per-company "<TICKER> Wheel"
// sheets straight in the browser so you can drag-drop your workbook to refresh.

const CREDIT = { action: 0, date: 1, shares: 2, prem: 3, total: 4, status: 5 };
const DEBIT = { action: 9, date: 10, shares: 11, cost: 12, invested: 13 };
const SHARE_VALUE_COL = 4;
const FIRST_DATA_ROW = 5;

function toISO(v: any): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
    return d ? d.toISOString().slice(0, 10) : null;
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

const num = (v: any): number | null =>
  typeof v === "number" ? v : typeof v === "string" && v.trim() && !isNaN(+v) ? +v : null;

export async function parseWorkbook(file: File): Promise<Dataset> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const trades: Trade[] = [];
  const lastPrices: Record<string, number> = {};

  for (const name of wb.SheetNames) {
    if (!name.endsWith("Wheel")) continue;
    const ticker = name.replace("Wheel", "").trim().toUpperCase();
    if (!ticker) continue;
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true });

    const sh100 = num(rows[0]?.[SHARE_VALUE_COL]);
    if (sh100) lastPrices[ticker] = Math.round((sh100 / 100) * 10000) / 10000;

    for (let r = FIRST_DATA_ROW; r < rows.length; r++) {
      const row = rows[r] || [];
      // credit
      const ca = row[CREDIT.action];
      if (typeof ca === "string" && ca.trim()) {
        const d = toISO(row[CREDIT.date]);
        const amount = num(row[CREDIT.total]) ?? num(row[CREDIT.prem]);
        if (d && amount != null) {
          const status = row[CREDIT.status];
          trades.push({
            id: `${ticker}-c-${r}`,
            ticker,
            side: "credit",
            action: (ca.trim() as TradeAction) || "CSP",
            date: d,
            shares: num(row[CREDIT.shares]) ?? 100,
            amount: Math.round(amount * 100) / 100,
            status: (typeof status === "string" && status.trim() ? status.trim() : "Open") as any,
          });
        }
      }
      // debit
      const da = row[DEBIT.action];
      if (typeof da === "string" && da.trim()) {
        const d = toISO(row[DEBIT.date]);
        if (d) {
          const cost = num(row[DEBIT.cost]);
          const invested = num(row[DEBIT.invested]);
          trades.push({
            id: `${ticker}-d-${r}`,
            ticker,
            side: "debit",
            action: (da.trim() as TradeAction) || "BB",
            date: d,
            shares: num(row[DEBIT.shares]) ?? 100,
            amount: cost != null ? Math.round(cost * 100) / 100 : 0,
            invested: invested != null ? Math.round(invested * 100) / 100 : null,
            status: "",
          });
        }
      }
    }
  }

  trades.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));

  // pull capital base + SPY from the Summary sheet if present
  let capitalBase = 0;
  let spy = { now: 0, year_ago: 0, year_ago_date: "" };
  if (wb.SheetNames.includes("Summary")) {
    const srows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Summary"], { header: 1, raw: true });
    for (const row of srows) {
      const label = row?.[0];
      if (label === "Account capital base" && num(row[1])) capitalBase = num(row[1])!;
      if (label === "SPY price now (live)" && num(row[1])) spy.now = num(row[1])!;
      if (label === "SPY one year ago" && num(row[1])) spy.year_ago = num(row[1])!;
    }
  }

  return {
    exportedAt: new Date().toISOString().slice(0, 10),
    capitalBase,
    lastPrices,
    spy,
    trades,
  };
}

// ---- Fidelity CSV ----------------------------------------------------------
// A Fidelity "Accounts_History" export. Each option row carries the contract in
// its symbol ( -SOFI260702P15.5 = ticker + YYMMDD expiry + P/C + strike) and an
// Action describing the transaction. We decode the symbol for strike/expiry and
// reconcile the four transaction kinds per contract so statuses resolve:
//   SOLD OPENING    -> a credit (CSP/CC), status starts "Open"
//   BOUGHT CLOSING  -> the matching sold contract -> "Closed" + a BB debit
//   EXPIRED         -> the matching sold contract -> "Expired"
//   ASSIGNED (put)  -> the matching CSP -> "Assigned" + an AAssignSTK debit
//   ASSIGNED (call) -> the matching CC  -> "Assigned" (shares called away)
// NB: Fidelity exports carry no earnings dates — that's not in the file.

type OptKind = "sell" | "buy" | "expired" | "assigned";
interface OptEvent {
  kind: OptKind;
  ticker: string;
  type: "P" | "C";
  strike: number | null;
  expiry: string | null;
  date: string;
  amount: number; // absolute $
  shares: number; // contracts * 100
}

export interface CsvImport {
  trades: Trade[];
  /** Peak cash-secured-put collateral ever committed — a sensible default
   * capital base when the CSV (which has no cash balance) is all we have. */
  suggestedCapitalBase: number;
}

// " -SOFI260702P15.5" -> { ticker, expiry: 2026-07-02, type: P, strike: 15.5 }
function parseOptionSymbol(sym: string): Omit<OptEvent, "kind" | "date" | "amount" | "shares"> | null {
  const m = sym.replace(/\s/g, "").match(/^-?([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const [, ticker, yy, mm, dd, cp, strike] = m;
  return {
    ticker,
    type: cp as "P" | "C",
    strike: parseFloat(strike),
    expiry: `20${yy}-${mm}-${dd}`,
  };
}

export function parseFidelityCsv(text: string): CsvImport {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /run date/i.test(l) && /action/i.test(l));
  if (headerIdx < 0) return { trades: [], suggestedCapitalBase: 0 };

  const header = splitCsv(lines[headerIdx]).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const cAction = idx("action");
  const cDate = idx("run date") >= 0 ? idx("run date") : idx("date");
  const cSymbol = idx("symbol");
  const cDesc = idx("description");
  const cAmount = idx("amount");
  const cQty = idx("quantity");

  // 1. Parse each option row into a structured event.
  const events: OptEvent[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = splitCsv(lines[i]);
    const action = (f[cAction] || "").toUpperCase();
    const desc = (f[cDesc] || "").toUpperCase();

    const opt = parseOptionSymbol(f[cSymbol] || "") ?? parseOptionFromDesc(desc);
    if (!opt) continue; // not an option row (disclaimer footer, dividends, etc.)

    let kind: OptKind | null = null;
    if (/ASSIGNED/.test(action)) kind = "assigned";
    else if (/EXPIRED/.test(action)) kind = "expired";
    else if (/SOLD/.test(action) && /OPENING/.test(action)) kind = "sell";
    else if (/BOUGHT/.test(action) && /CLOSING/.test(action)) kind = "buy";
    if (!kind) continue;

    const date = normalizeDate(f[cDate] || "");
    if (!date) continue;
    const contracts = Math.abs(parseInt(f[cQty] || "1", 10) || 1);
    events.push({
      kind,
      ...opt,
      date,
      amount: Math.abs(parseFloat((f[cAmount] || "0").replace(/[$,]/g, "")) || 0),
      shares: contracts * 100,
    });
  }

  // 2. Reconcile per contract (ticker+expiry+type+strike), chronologically.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const byContract = new Map<string, OptEvent[]>();
  for (const e of events) {
    const key = `${e.ticker}|${e.expiry}|${e.type}|${e.strike}`;
    (byContract.get(key) ?? byContract.set(key, []).get(key)!).push(e);
  }

  const trades: Trade[] = [];
  let tid = 0;
  for (const evs of byContract.values()) {
    evs.sort((a, b) => a.date.localeCompare(b.date));
    const openSells: Trade[] = [];
    for (const e of evs) {
      if (e.kind === "sell") {
        const t: Trade = {
          id: `fid-${tid++}`,
          ticker: e.ticker,
          side: "credit",
          action: e.type === "P" ? "CSP" : "CC",
          date: e.date,
          shares: e.shares,
          amount: round2(e.amount),
          status: "Open",
          strike: e.strike,
          expiry: e.expiry,
          invested: null,
        };
        trades.push(t);
        openSells.push(t);
      } else {
        const open = openSells.shift(); // FIFO: close the oldest open leg

        if (e.kind === "buy") {
          if (open) open.status = "Closed";
          trades.push({
            id: `fid-${tid++}`,
            ticker: e.ticker,
            side: "debit",
            action: "BB",
            date: e.date,
            shares: e.shares,
            amount: round2(e.amount),
            status: "",
            strike: e.strike,
            expiry: e.expiry,
            invested: null,
          });
        } else if (e.kind === "expired") {
          if (open) open.status = "Expired";
        } else if (e.kind === "assigned") {
          if (open) open.status = "Assigned";
          // A put assignment buys shares at the strike; a call assignment sells
          // shares away (handled via the CC's "Assigned" status in compute.ts).
          if (e.type === "P" && e.strike) {
            trades.push({
              id: `fid-${tid++}`,
              ticker: e.ticker,
              side: "debit",
              action: "AAssignSTK",
              date: e.date,
              shares: e.shares,
              amount: 0,
              status: "",
              strike: e.strike,
              expiry: e.expiry,
              invested: round2(e.strike * e.shares),
            });
          }
        }
      }
    }
  }

  trades.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));

  // Suggest a capital base using the same estimator the dashboard falls back to,
  // so the import toast and the dashboard always agree.
  return { trades, suggestedCapitalBase: estimateCapitalBase(trades) };
}

// Fallback when the symbol column is blank: pull contract from the description,
// e.g. "PUT (SOFI) SOFI TECHNOLOGIES JUN 26 26 $9.5 (100 SHS)".
function parseOptionFromDesc(desc: string): Omit<OptEvent, "kind" | "date" | "amount" | "shares"> | null {
  const tk = desc.match(/\(([A-Z]{1,5})\)/);
  const type: "P" | "C" | null = /\bPUT\b/.test(desc) ? "P" : /\bCALL\b/.test(desc) ? "C" : null;
  const mdy = desc.match(/([A-Z]{3})\s+(\d{1,2})\s+(\d{2})\b/); // MON DD YY
  const strike = desc.match(/\$(\d+(?:\.\d+)?)/);
  if (!tk || !type || !mdy) return null;
  const MON: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  const mm = MON[mdy[1]];
  if (!mm) return null;
  return {
    ticker: tk[1],
    type,
    strike: strike ? parseFloat(strike[1]) : null,
    expiry: `20${mdy[3]}-${mm}-${mdy[2].padStart(2, "0")}`,
  };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeDate(s: string): string | null {
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const [, mo, da, yr] = m;
    const y = yr.length === 2 ? "20" + yr : yr;
    return `${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  }
  return null;
}
