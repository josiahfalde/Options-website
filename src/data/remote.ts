import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dataset, Trade } from "../types";

// ============================================================================
// Remote (Supabase) data access. Maps snake_case DB rows <-> camelCase app
// types. RLS scopes everything to the logged-in user, but we still set
// user_id explicitly on writes (the `with check` policy requires it == auth.uid()).
//
// The component API in store.tsx never imports this directly except through the
// cloud branch — so swapping backends stays contained here + store.tsx.
// ============================================================================

interface TradeRow {
  id: string;
  ticker: string;
  side: Trade["side"];
  action: Trade["action"];
  trade_date: string;
  shares: number;
  amount: number;
  invested: number | null;
  status: Trade["status"];
  strike: number | null;
  expiry: string | null;
  note: string | null;
  thesis: string | null;
  grade: number | null;
}

function rowToTrade(r: TradeRow): Trade {
  return {
    id: r.id,
    ticker: r.ticker,
    side: r.side,
    action: r.action,
    date: r.trade_date,
    shares: r.shares,
    amount: Number(r.amount) || 0,
    invested: r.invested,
    status: r.status,
    strike: r.strike,
    expiry: r.expiry,
    note: r.note,
    thesis: r.thesis,
    grade: r.grade,
  };
}

/** Map a Trade (sans id) to the DB insert/update shape. user_id added by caller. */
function tradeToRow(t: Partial<Trade>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.ticker !== undefined) row.ticker = t.ticker.toUpperCase();
  if (t.side !== undefined) row.side = t.side;
  if (t.action !== undefined) row.action = t.action;
  if (t.date !== undefined) row.trade_date = t.date;
  if (t.shares !== undefined) row.shares = t.shares;
  if (t.amount !== undefined) row.amount = t.amount;
  if (t.invested !== undefined) row.invested = t.invested;
  if (t.status !== undefined) row.status = t.status;
  if (t.strike !== undefined) row.strike = t.strike;
  if (t.expiry !== undefined) row.expiry = t.expiry;
  if (t.note !== undefined) row.note = t.note;
  if (t.thesis !== undefined) row.thesis = t.thesis;
  if (t.grade !== undefined) row.grade = t.grade;
  return row;
}

/** Load the full dataset for the current user from Supabase. */
export async function fetchDataset(sb: SupabaseClient, userId: string): Promise<Dataset> {
  const [tradesRes, pricesRes, settingsRes] = await Promise.all([
    sb.from("trades").select("*").eq("user_id", userId).order("trade_date", { ascending: true }),
    sb.from("prices").select("ticker, price").eq("user_id", userId),
    sb.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (tradesRes.error) throw tradesRes.error;
  if (pricesRes.error) throw pricesRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const lastPrices: Record<string, number> = {};
  for (const p of pricesRes.data ?? []) lastPrices[p.ticker] = Number(p.price) || 0;

  const s = settingsRes.data;
  return {
    exportedAt: new Date().toISOString().slice(0, 10),
    capitalBase: s ? Number(s.capital_base) || 0 : 0,
    lastPrices,
    spy: {
      now: s ? Number(s.spy_now) || 0 : 0,
      year_ago: s ? Number(s.spy_year_ago) || 0 : 0,
      year_ago_date: s?.spy_year_ago_date ?? "",
    },
    trades: (tradesRes.data ?? []).map(rowToTrade),
  };
}

export async function insertTrade(
  sb: SupabaseClient,
  userId: string,
  t: Omit<Trade, "id">
): Promise<Trade> {
  const { data, error } = await sb
    .from("trades")
    .insert({ ...tradeToRow(t), user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return rowToTrade(data as TradeRow);
}

export async function updateTradeRemote(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Trade>
): Promise<void> {
  const { error } = await sb.from("trades").update(tradeToRow(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteTradeRemote(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("trades").delete().eq("id", id);
  if (error) throw error;
}

/** Bulk insert (used by the xlsx/CSV import). Returns the inserted trades. */
export async function insertTrades(
  sb: SupabaseClient,
  userId: string,
  trades: Array<Omit<Trade, "id">>
): Promise<Trade[]> {
  if (trades.length === 0) return [];
  const { data, error } = await sb
    .from("trades")
    .insert(trades.map((t) => ({ ...tradeToRow(t), user_id: userId })))
    .select("*");
  if (error) throw error;
  return (data as TradeRow[]).map(rowToTrade);
}

export async function upsertPrice(
  sb: SupabaseClient,
  userId: string,
  ticker: string,
  price: number
): Promise<void> {
  const { error } = await sb
    .from("prices")
    .upsert({ user_id: userId, ticker: ticker.toUpperCase(), price }, { onConflict: "user_id,ticker" });
  if (error) throw error;
}

export async function upsertSettings(
  sb: SupabaseClient,
  userId: string,
  patch: { capitalBase?: number; spyNow?: number; spyYearAgo?: number; spyYearAgoDate?: string }
): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId };
  if (patch.capitalBase !== undefined) row.capital_base = patch.capitalBase;
  if (patch.spyNow !== undefined) row.spy_now = patch.spyNow;
  if (patch.spyYearAgo !== undefined) row.spy_year_ago = patch.spyYearAgo;
  if (patch.spyYearAgoDate !== undefined) row.spy_year_ago_date = patch.spyYearAgoDate;
  const { error } = await sb.from("user_settings").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}
