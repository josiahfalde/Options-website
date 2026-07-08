import * as XLSX from "xlsx";
import type { Dataset, OptionType, Trade, TradeAction } from "../types";
import { computePositions, estimateCapitalBase } from "./compute";

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
    // Same-day tie-break: the sell must precede its own close (the export lists
    // newest-first, so a same-day open+close otherwise arrives reversed).
    evs.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.kind === "sell" ? 0 : 1) - (b.kind === "sell" ? 0 : 1)
    );
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

// ---- tastytrade CSV (Activity → Orders export) -----------------------------
// A tastytrade order-history export. Columns:
//   Symbol,Status,MarketOrFill,Price,TIF,Time,TimeStampAtType,Order #,Description
// Quirks this parser handles:
//   • The `Description` is a MULTI-LINE quoted field — one line per leg, e.g.
//       "-1 Jun 17 0d 730 Put STO        (sell-to-open 730 put)
//         1 Jun 17 0d 721 Put BTO"       (buy-to-open  721 put)   → a spread.
//     So we tokenize the whole file respecting quoted newlines, not line-by-line.
//   • There is NO trade-date column — only a time of day. But every leg encodes
//     its expiry + days-to-expiry ("Jun 17 0d"), so trade date = expiry − DTE.
//     The expiry's YEAR isn't in the file either; we infer it from the filename
//     (tastytrade_activity_YYMMDD.csv) or fall back to today.
//   • Price is a per-spread NET ("1.45 cr" / "2.61 db"), not per-leg. We attach
//     the whole net to the leg whose side matches the order (credit→a sold leg,
//     debit→a bought leg) and 0 to the rest, so the position's realized P&L and
//     net credit/width/max-loss all come out exact even without per-leg fills.
//   • Only `Filled` orders are real; Canceled/Received/Routed never executed.
//   • Open and close orders for the same structure (same symbol/expiry/strikes/
//     type) are grouped into ONE position via a shared positionId. Strategy is
//     left null so the app auto-detects (put credit spread, iron condor, …) and
//     the user can confirm/override.
// Limitation: the orders export has no expiration/assignment settlement events,
// so an opened position with no closing order is treated as Expired once its
// expiry has passed (credit kept / debit lost) and Open before then.

interface TtLeg {
  qty: number; // signed contracts (− = short)
  strike: number;
  type: OptionType;
  action: "STO" | "BTO" | "STC" | "BTC";
  expiry: string; // YYYY-MM-DD
  tradeDate: string; // expiry − DTE
}

interface TtOrder {
  symbol: string;
  legs: TtLeg[];
  net: number; // per-share net price
  direction: "credit" | "debit";
  closing: boolean; // a close order (BTC/STC) vs an open (STO/BTO)
  structKey: string; // groups open + close of the same structure
}

const MON3: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Shift an ISO date by N days (UTC-safe so it never drifts a day by timezone). */
function shiftDaysISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** Reference date for year inference — from a YYMMDD in the filename, else today. */
function refDateFromName(fileName?: string): string {
  const m = fileName?.match(/(\d{2})(\d{2})(\d{2})/);
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return new Date().toISOString().slice(0, 10);
}

/** Full-text CSV tokenizer that keeps newlines inside quoted fields. */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { record.push(field); field = ""; }
    else if (ch === "\r") { /* skip */ }
    else if (ch === "\n") { record.push(field); field = ""; records.push(record); record = []; }
    else field += ch;
  }
  if (field.length || record.length) { record.push(field); records.push(record); }
  return records;
}

/** "-1 Jun 17 0d 730 Put STO" → a structured leg (null if it doesn't match). */
function parseTtLeg(line: string, refDate: string): TtLeg | null {
  // DTE token is "<N>d" (e.g. "0d", "5d") OR the word "Exp" on expiration day —
  // tastytrade swaps in "Exp" for a 0-DTE contract on its expiry date.
  const m = line
    .trim()
    .match(/^(-?\d+)\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d+d|Exp)\s+(\d+(?:\.\d+)?)\s+(Put|Call)\s+(STO|BTO|STC|BTC)$/i);
  if (!m) return null;
  const [, qty, mon, day, dte, strike, type, action] = m;
  const dteDays = /^exp$/i.test(dte) ? 0 : parseInt(dte, 10);
  const mm = MON3[mon.toLowerCase()];
  if (!mm) return null;
  let expiry = `${refDate.slice(0, 4)}-${mm}-${day.padStart(2, "0")}`;
  // Year roll: if that expiry lands far before the file date, it's next year.
  if (expiry < shiftDaysISO(refDate, -180)) expiry = `${+refDate.slice(0, 4) + 1}-${mm}-${day.padStart(2, "0")}`;
  return {
    qty: parseInt(qty, 10),
    strike: parseFloat(strike),
    type: type.toLowerCase() === "put" ? "put" : "call",
    action: action.toUpperCase() as TtLeg["action"],
    expiry,
    tradeDate: shiftDaysISO(expiry, -dteDays),
  };
}

export function isTastytradeCsv(text: string): boolean {
  const head = text.slice(0, 500).toLowerCase();
  return /timestampattype/.test(head) || /marketorfill/.test(head);
}

export function parseTastytradeCsv(text: string, fileName?: string): CsvImport {
  const refDate = refDateFromName(fileName);
  const records = parseCsvRecords(text);
  if (!records.length) return { trades: [], suggestedCapitalBase: 0 };

  const header = records[0].map((h) => h.toLowerCase().trim());
  const col = (name: string) => header.findIndex((h) => h.includes(name));
  const cSym = col("symbol");
  const cStatus = col("status");
  const cFill = col("marketorfill");
  const cPrice = col("price");
  const cDesc = col("description");
  if (cSym < 0 || cStatus < 0 || cDesc < 0) return { trades: [], suggestedCapitalBase: 0 };

  // 1. Parse every Filled order into a structured order.
  const orders: TtOrder[] = [];
  for (let i = 1; i < records.length; i++) {
    const r = records[i];
    if (!r || !r[cStatus]) continue;
    if (!/filled/i.test(r[cStatus])) continue; // skip Canceled / Received / Routed

    const legs = (r[cDesc] || "")
      .split("\n")
      .map((l) => parseTtLeg(l, refDate))
      .filter((l): l is TtLeg => !!l);
    if (!legs.length) continue;

    // Net price + direction from MarketOrFill (fallback Price). Take the number
    // adjacent to cr/db, so "STP 2.61 LMT 2.61 db" reads 2.61 db.
    const priceStr = (cFill >= 0 && r[cFill]) || (cPrice >= 0 && r[cPrice]) || "";
    const pm = String(priceStr).match(/(\d+(?:\.\d+)?)\s*(cr|db)\b/i);
    if (!pm) continue; // no fill price — can't value it
    const net = parseFloat(pm[1]);
    const direction: "credit" | "debit" = /cr/i.test(pm[2]) ? "credit" : "debit";

    const symbol = (r[cSym] || "").trim().toUpperCase();
    const closing = legs.some((l) => l.action === "BTC" || l.action === "STC");
    const strikes = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
    const types = [...new Set(legs.map((l) => l.type))].sort();
    const structKey = `${symbol}|${legs[0].expiry}|${types.join(",")}|${strikes.join(",")}`;
    orders.push({ symbol, legs, net, direction, closing, structKey });
  }
  if (!orders.length) return { trades: [], suggestedCapitalBase: 0 };

  // 2. Which structures ever got a closing order? Drives open-leg status.
  const closedStructs = new Set(orders.filter((o) => o.closing).map((o) => o.structKey));

  // 3. Materialize legs → Trade rows. positionId = structKey so open + close group.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const isCreditAction = (a: TtLeg["action"]) => a === "STO" || a === "STC";
  const trades: Trade[] = [];
  let tid = 0;
  for (const o of orders) {
    const spreadQty = Math.max(1, ...o.legs.map((l) => Math.abs(l.qty)));
    const netDollar = round2(o.net * 100 * spreadQty);
    // Attach the whole net to the first leg matching the order direction.
    const primary = o.legs.find((l) => (isCreditAction(l.action) ? "credit" : "debit") === o.direction);

    for (const leg of o.legs) {
      const side: Trade["side"] = isCreditAction(leg.action) ? "credit" : "debit";
      const amount = leg === primary ? netDollar : 0;
      let status: Trade["status"];
      if (o.closing) status = "Closed";
      else if (closedStructs.has(o.structKey)) status = "Closed";
      else status = leg.expiry <= refDate ? "Expired" : "Open";
      trades.push({
        id: `tt-${tid++}`,
        ticker: o.symbol,
        side,
        action: leg.action,
        date: leg.tradeDate,
        shares: Math.max(1, Math.abs(leg.qty)) * 100,
        amount,
        status,
        strike: leg.strike,
        expiry: leg.expiry,
        optionType: leg.type,
        positionId: o.structKey,
        strategy: null, // auto-detect (put credit spread, iron condor, …)
        invested: null,
      });
    }
  }

  trades.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));

  // Suggested capital base = total defined-risk (Σ max loss) of imported
  // positions — a sane yield denominator for a spread book with no cash balance.
  const positions = computePositions({
    exportedAt: refDate,
    capitalBase: 0,
    lastPrices: {},
    spy: { now: 0, year_ago: 0, year_ago_date: "" },
    trades,
  });
  const suggestedCapitalBase = Math.round(
    positions.reduce((a, p) => a + (p.maxLoss ?? 0), 0)
  );
  return { trades, suggestedCapitalBase };
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
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) {
    const [, mo, da, yr] = m;
    const y = yr.length === 2 ? "20" + yr : yr;
    return `${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  }
  return null;
}
