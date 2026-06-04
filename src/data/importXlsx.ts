import * as XLSX from "xlsx";
import type { Dataset, Trade, TradeAction } from "../types";

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

// ---- Fidelity CSV (lightweight first pass) ---------------------------------
// Fidelity option descriptions look like:  "PUT (SOFI) SOFI JUN 20 26 $12 ..."
// We parse SOLD/BOUGHT OPENING/CLOSING rows into credit/debit trades.
export function parseFidelityCsv(text: string): Trade[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const cAction = idx("action");
  const cDate = idx("run date") >= 0 ? idx("run date") : idx("date");
  const cSymbol = idx("symbol");
  const cDesc = idx("description");
  const cAmount = idx("amount");
  const cQty = idx("quantity");

  const out: Trade[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsv(lines[i]);
    const action = (f[cAction] || "").toUpperCase();
    if (!/OPTION|PUT|CALL|ASSIGNED/.test(action) && !/OPTION/.test((f[cDesc] || "").toUpperCase()))
      continue;
    const desc = (f[cDesc] || "").toUpperCase();
    const isPut = /\bPUT\b/.test(action + desc);
    const isCall = /\bCALL\b/.test(action + desc);
    const opening = /OPENING/.test(action);
    const closing = /CLOSING/.test(action);
    const sold = /SOLD/.test(action);
    const assigned = /ASSIGNED/.test(action);
    const amount = Math.abs(parseFloat((f[cAmount] || "0").replace(/[$,]/g, "")) || 0);
    const date = normalizeDate(f[cDate] || "");
    const ticker = extractTicker(f[cSymbol] || "", desc);
    const shares = Math.abs(parseInt(f[cQty] || "1", 10) || 1) * 100;
    if (!date || !ticker) continue;

    let act: TradeAction | null = null;
    let side: "credit" | "debit" = "credit";
    if (assigned) {
      act = "AAssignSTK";
      side = "debit";
    } else if (sold && opening) {
      act = isPut ? "CSP" : isCall ? "CC" : "CSP";
      side = "credit";
    } else if (closing) {
      act = "BB";
      side = "debit";
    }
    if (!act) continue;
    out.push({
      id: `fid-${i}`,
      ticker,
      side,
      action: act,
      date,
      shares,
      amount,
      invested: act === "AAssignSTK" ? amount : null,
      status: act === "BB" ? "" : "Open",
    });
  }
  return out;
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

function extractTicker(symbol: string, desc: string): string | null {
  const paren = desc.match(/\(([A-Z]{1,5})\)/);
  if (paren) return paren[1];
  const sym = symbol.replace(/[^A-Z]/gi, "").toUpperCase();
  return sym.slice(0, 5) || null;
}
