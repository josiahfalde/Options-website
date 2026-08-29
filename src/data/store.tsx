import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Dataset, StockEvent, Trade } from "../types";
import seed from "./seed.json";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import {
  deleteStockEventRemote,
  deleteTradeRemote,
  deleteTradesRemote,
  fetchDataset,
  insertStockEvents,
  insertTrade,
  insertTrades,
  updateTradeRemote,
  upsertPrice,
  upsertSector,
  upsertSettings,
} from "./remote";
import { planStockMerge } from "./allocation";

// ============================================================================
// Data layer. Two modes, one API (pages never change):
//
//   • DEMO  (logged out): anonymized seed data, in-memory only. Visitors can
//     poke around; nothing persists. "Sign in to save" is the conversion path.
//   • CLOUD (logged in):  Supabase is the source of truth, scoped to the user
//     by Row-Level Security. Mutations are optimistic and revert on error.
//
// This file + remote.ts are the only places that know where data lives.
// ============================================================================

let _id = 0;
const newId = () => `t${Date.now().toString(36)}-${(_id++).toString(36)}`;

function normalize(raw: any): Dataset {
  const trades: Trade[] = (raw.trades ?? []).map((t: any) => ({
    id: t.id ?? newId(),
    ticker: String(t.ticker).toUpperCase(),
    side: t.side,
    action: t.action,
    date: t.date,
    shares: t.shares ?? 100,
    amount: Number(t.amount) || 0,
    invested: t.invested ?? null,
    status: t.status ?? (t.side === "credit" ? "Open" : ""),
    strike: t.strike ?? null,
    expiry: t.expiry ?? null,
    note: t.note ?? null,
    thesis: t.thesis ?? null,
    grade: t.grade ?? null,
    wheelId: t.wheelId ?? t.wheel_id ?? null,
    strategy: t.strategy ?? null,
    positionId: t.positionId ?? t.position_id ?? null,
    optionType: t.optionType ?? t.option_type ?? null,
  }));
  const stockEvents: StockEvent[] = (raw.stockEvents ?? []).map((e: any) => ({
    id: e.id ?? newId(),
    ticker: String(e.ticker).toUpperCase(),
    date: e.date,
    kind: e.kind ?? "buy",
    shares: Math.abs(Number(e.shares)) || 0,
    price: Number(e.price) || 0,
    amount: Math.abs(Number(e.amount)) || 0,
  }));
  return {
    exportedAt: raw.exportedAt ?? new Date().toISOString().slice(0, 10),
    capitalBase: Number(raw.capitalBase) || 0,
    lastPrices: raw.lastPrices ?? {},
    spy: raw.spy ?? { now: 0, year_ago: 0, year_ago_date: "" },
    trades,
    stockEvents,
    sectors: raw.sectors ?? {},
  };
}

const emptyDataset = (): Dataset => ({
  exportedAt: new Date().toISOString().slice(0, 10),
  capitalBase: 0,
  lastPrices: {},
  spy: { now: 0, year_ago: 0, year_ago_date: "" },
  trades: [],
  stockEvents: [],
  sectors: {},
});

export type StoreMode = "demo" | "cloud";

/** What an import actually did, so the UI can report the truth. */
export interface ImportSummary {
  inserted: number;
  updated: number; // stale "Open" rows upgraded to Closed/Assigned/Expired
  skipped: number; // exact duplicates ignored
}

// Identity key deliberately EXCLUDES status, so a re-imported rolling
// window that now shows a contract as Closed/Assigned/Expired can UPGRADE
// the stale "Open" we stored on a previous import (instead of being thrown
// away as a duplicate). This is what makes "re-import to update" work.
const mergeKey = (t: Trade) =>
  `${t.ticker}|${t.date}|${t.action}|${t.strike ?? ""}|${t.expiry ?? ""}|${t.amount}`;
const isResolved = (s: Trade["status"]) => !!s && s !== "Open";

interface MergePlan {
  toInsert: Trade[];
  statusUpdates: { id: string; patch: Partial<Trade> }[];
  skipped: number;
}

/**
 * Split incoming trades into NEW rows vs status-upgrades vs duplicates,
 * measured against `existing`. Count-aware: each existing row absorbs at most
 * one incoming duplicate, so a book that legitimately contains two identical
 * fills still imports both the first time.
 */
function planMerge(existing: Trade[], incoming: Trade[]): MergePlan {
  const byKey = new Map<string, Trade[]>();
  for (const t of existing) {
    const k = mergeKey(t);
    const arr = byKey.get(k);
    if (arr) arr.push(t);
    else byKey.set(k, [t]);
  }
  const plan: MergePlan = { toInsert: [], statusUpdates: [], skipped: 0 };
  for (const t of incoming) {
    const ex = byKey.get(mergeKey(t))?.shift();
    if (!ex) {
      plan.toInsert.push(t);
    } else if (ex.status === "Open" && isResolved(t.status)) {
      plan.statusUpdates.push({
        id: ex.id,
        patch: { status: t.status, invested: t.invested ?? ex.invested },
      });
    } else {
      plan.skipped++; // a true duplicate with no new info
    }
  }
  return plan;
}

/**
 * Find redundant copies of the same trade so they can be deleted.
 * Two passes:
 *   1. Rows identical on ticker/date/action/amount/shares/strike/expiry/status
 *      — the signature of the same file imported twice. Keeps the copy carrying
 *      user metadata (note/thesis/grade/wheel tag), drops the rest.
 *   2. A strike-less row (workbook-era import) shadowed by a strike-carrying
 *      row of the same ticker/date/action/amount — the signature of a broker
 *      CSV re-importing trades first loaded from the Wheel workbook. The bare
 *      row is dropped unless it carries user metadata.
 */
export function findDuplicateTradeIds(trades: Trade[]): string[] {
  const hasMeta = (t: Trade) => !!(t.note || t.thesis || t.grade || t.wheelId);
  const dupes = new Set<string>();

  const strict = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = `${t.ticker}|${t.date}|${t.side}|${t.action}|${t.amount}|${t.shares}|${t.strike ?? ""}|${t.expiry ?? ""}|${t.status}`;
    const arr = strict.get(k);
    if (arr) arr.push(t);
    else strict.set(k, [t]);
  }
  for (const group of strict.values()) {
    if (group.length < 2) continue;
    const keep = group.find(hasMeta) ?? group[0];
    for (const t of group) if (t !== keep) dupes.add(t.id);
  }

  const loose = new Map<string, Trade[]>();
  for (const t of trades) {
    if (dupes.has(t.id)) continue;
    const k = `${t.ticker}|${t.date}|${t.side}|${t.action}|${t.amount}`;
    const arr = loose.get(k);
    if (arr) arr.push(t);
    else loose.set(k, [t]);
  }
  for (const group of loose.values()) {
    if (group.length < 2) continue;
    const withStrike = group.filter((t) => t.strike != null || t.expiry != null);
    const bare = group.filter((t) => t.strike == null && t.expiry == null && !hasMeta(t));
    // one shadowed bare row per strike-carrying row, never more
    for (const t of bare.slice(0, withStrike.length)) dupes.add(t.id);
  }

  return [...dupes];
}

interface StoreCtx {
  dataset: Dataset;
  isSeed: boolean;
  mode: StoreMode;
  loading: boolean;
  error: string | null;
  addTrade: (t: Omit<Trade, "id">) => void;
  updateTrade: (id: string, patch: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  replaceDataset: (ds: Dataset, opts?: { merge?: boolean }) => Promise<ImportSummary>;
  /** Delete redundant copies of the same trade (see findDuplicateTradeIds). */
  removeDuplicates: () => Promise<number>;
  /** Merge share-level events (buys/sells/DRIP); exact duplicates are skipped. */
  importStockEvents: (events: StockEvent[]) => Promise<{ inserted: number; skipped: number }>;
  deleteStockEvent: (id: string) => void;
  /** Override a ticker's sector (null = back to the built-in map). */
  setSector: (ticker: string, sector: string | null) => void;
  setCapitalBase: (n: number) => void;
  setPrice: (ticker: string, price: number) => void;
  setSpy: (now: number, yearAgo: number, yearAgoDate: string) => void;
  resetToSeed: () => void;
  clearAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const mode: StoreMode = user ? "cloud" : "demo";

  const [dataset, setDataset] = useState<Dataset>(() => normalize(seed));
  const [isSeed, setIsSeed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest dataset in a ref so async error-reverts read fresh state.
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;

  // --- load on auth change -------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    if (mode === "demo" || !supabase || !user) {
      // logged out → ephemeral anonymized demo
      setDataset(normalize(seed));
      setIsSeed(true);
      setLoading(false);
      setError(null);
      return;
    }

    // logged in → load this user's data from Supabase
    setLoading(true);
    setError(null);
    fetchDataset(supabase, user.id)
      .then((ds) => {
        if (cancelled) return;
        setDataset(ds);
        setIsSeed(ds.trades.length === 0);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load your data.");
        setDataset(emptyDataset());
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [mode, user, authLoading]);

  // --- helpers -------------------------------------------------------------
  // Run a Supabase write in cloud mode; in demo mode it's a no-op (state-only).
  const runRemote = useCallback(
    (fn: () => Promise<unknown>) => {
      if (mode !== "cloud" || !supabase || !user) return;
      fn().catch((e) => setError(e?.message ?? "Save failed."));
    },
    [mode, user]
  );

  // --- mutators (optimistic; cloud writes go through runRemote) ------------
  const addTrade = useCallback(
    (t: Omit<Trade, "id">) => {
      setIsSeed(false);
      setError(null);
      if (mode === "cloud" && supabase && user) {
        // remote-first so we get the real DB id, then reflect it locally
        insertTrade(supabase, user.id, t)
          .then((saved) => setDataset((d) => ({ ...d, trades: [...d.trades, saved] })))
          .catch((e) => setError(e?.message ?? "Save failed."));
      } else {
        setDataset((d) => ({ ...d, trades: [...d.trades, { ...t, id: newId() }] }));
      }
    },
    [mode, user]
  );

  const updateTrade = useCallback(
    (id: string, patch: Partial<Trade>) => {
      setIsSeed(false);
      const prev = datasetRef.current;
      setDataset((d) => ({
        ...d,
        trades: d.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      runRemote(() =>
        updateTradeRemote(supabase!, id, patch).catch((e) => {
          setDataset(prev); // revert
          throw e;
        })
      );
    },
    [runRemote]
  );

  const deleteTrade = useCallback(
    (id: string) => {
      setIsSeed(false);
      const prev = datasetRef.current;
      setDataset((d) => ({ ...d, trades: d.trades.filter((t) => t.id !== id) }));
      runRemote(() =>
        deleteTradeRemote(supabase!, id).catch((e) => {
          setDataset(prev);
          throw e;
        })
      );
    },
    [runRemote]
  );

  const replaceDataset = useCallback(
    async (ds: Dataset, opts?: { merge?: boolean }): Promise<ImportSummary> => {
      setIsSeed(false);
      setError(null);
      const next = normalize(ds);

      if (mode === "cloud" && supabase && user) {
        // Persist first, then reflect what the server actually holds. The
        // caller awaits this, so success is only reported once it's saved.
        try {
          let summary: ImportSummary;
          if (!opts?.merge) {
            // replace: clear existing, then bulk insert everything
            const { error: delErr } = await supabase
              .from("trades")
              .delete()
              .eq("user_id", user.id);
            if (delErr) throw delErr;
            await insertTrades(
              supabase,
              user.id,
              next.trades.map(({ id: _id, ...rest }) => rest)
            );
            summary = { inserted: next.trades.length, updated: 0, skipped: 0 };
          } else {
            // merge: dedupe against what the DATABASE holds right now — never
            // against local state, which can lag mid-refresh and would let a
            // re-imported file double-insert every trade.
            const fresh = await fetchDataset(supabase, user.id);
            const plan = planMerge(fresh.trades, next.trades);
            for (const u of plan.statusUpdates) await updateTradeRemote(supabase, u.id, u.patch);
            await insertTrades(
              supabase,
              user.id,
              plan.toInsert.map(({ id: _id, ...rest }) => rest)
            );
            summary = {
              inserted: plan.toInsert.length,
              updated: plan.statusUpdates.length,
              skipped: plan.skipped,
            };
          }
          // share events + sector overrides (from a Flywheel JSON backup)
          if (next.stockEvents?.length) {
            const freshS = await fetchDataset(supabase, user.id);
            const sp = planStockMerge(freshS.stockEvents ?? [], next.stockEvents);
            await insertStockEvents(
              supabase,
              user.id,
              sp.toInsert.map(({ id: _id, ...rest }) => rest)
            );
          }
          for (const [ticker, sector] of Object.entries(next.sectors ?? {})) {
            await upsertSector(supabase, user.id, ticker, sector);
          }
          // settings + prices
          const base = datasetRef.current;
          await upsertSettings(supabase, user.id, {
            capitalBase: next.capitalBase || base.capitalBase,
            spyNow: next.spy.now || base.spy.now,
            spyYearAgo: next.spy.year_ago || base.spy.year_ago,
            spyYearAgoDate: next.spy.year_ago_date || base.spy.year_ago_date,
          });
          for (const [ticker, price] of Object.entries({
            ...base.lastPrices,
            ...next.lastPrices,
          })) {
            await upsertPrice(supabase, user.id, ticker, price as number);
          }
          // reflect authoritative server ids
          const ds2 = await fetchDataset(supabase, user.id);
          setDataset(ds2);
          return summary;
        } catch (e: any) {
          setError(e?.message ?? "Import failed.");
          throw e;
        }
      }

      // demo/local
      if (!opts?.merge) {
        setDataset(next);
        return { inserted: next.trades.length, updated: 0, skipped: 0 };
      }
      const plan = planMerge(datasetRef.current.trades, next.trades);
      const patchById = new Map(plan.statusUpdates.map((u) => [u.id, u.patch] as const));
      setDataset((d) => ({
        ...d,
        trades: [
          ...d.trades.map((t) => (patchById.has(t.id) ? { ...t, ...patchById.get(t.id)! } : t)),
          ...plan.toInsert,
        ],
        lastPrices: { ...d.lastPrices, ...next.lastPrices },
        capitalBase: next.capitalBase || d.capitalBase,
        spy: next.spy.now ? next.spy : d.spy,
      }));
      return {
        inserted: plan.toInsert.length,
        updated: plan.statusUpdates.length,
        skipped: plan.skipped,
      };
    },
    [mode, user]
  );

  const removeDuplicates = useCallback(async (): Promise<number> => {
    const ids = findDuplicateTradeIds(datasetRef.current.trades);
    if (ids.length === 0) return 0;
    setIsSeed(false);
    const drop = new Set(ids);
    const prev = datasetRef.current;
    setDataset((d) => ({ ...d, trades: d.trades.filter((t) => !drop.has(t.id)) }));
    if (mode === "cloud" && supabase && user) {
      try {
        await deleteTradesRemote(supabase, ids);
      } catch (e: any) {
        setDataset(prev); // revert
        setError(e?.message ?? "Could not remove duplicates.");
        throw e;
      }
    }
    return ids.length;
  }, [mode, user]);

  // --- allocation layer: share events + sector overrides --------------------
  const importStockEvents = useCallback(
    async (events: StockEvent[]) => {
      if (events.length === 0) return { inserted: 0, skipped: 0 };
      setIsSeed(false);
      setError(null);
      if (mode === "cloud" && supabase && user) {
        try {
          // Dedupe against what the DATABASE holds (same rule as trades).
          const fresh = await fetchDataset(supabase, user.id);
          const plan = planStockMerge(fresh.stockEvents ?? [], events);
          await insertStockEvents(
            supabase,
            user.id,
            plan.toInsert.map(({ id: _id, ...rest }) => rest)
          );
          const ds2 = await fetchDataset(supabase, user.id);
          setDataset(ds2);
          return { inserted: plan.toInsert.length, skipped: plan.skipped };
        } catch (e: any) {
          setError(e?.message ?? "Import failed.");
          throw e;
        }
      }
      const plan = planStockMerge(datasetRef.current.stockEvents ?? [], events);
      const fresh = plan.toInsert.map((e) => ({ ...e, id: newId() }));
      setDataset((d) => ({ ...d, stockEvents: [...(d.stockEvents ?? []), ...fresh] }));
      return { inserted: plan.toInsert.length, skipped: plan.skipped };
    },
    [mode, user]
  );

  const deleteStockEvent = useCallback(
    (id: string) => {
      setIsSeed(false);
      const prev = datasetRef.current;
      setDataset((d) => ({ ...d, stockEvents: (d.stockEvents ?? []).filter((e) => e.id !== id) }));
      runRemote(() =>
        deleteStockEventRemote(supabase!, id).catch((e) => {
          setDataset(prev);
          throw e;
        })
      );
    },
    [runRemote]
  );

  const setSector = useCallback(
    (ticker: string, sector: string | null) => {
      setIsSeed(false);
      const t = ticker.toUpperCase();
      setDataset((d) => {
        const sectors = { ...(d.sectors ?? {}) };
        if (sector) sectors[t] = sector;
        else delete sectors[t];
        return { ...d, sectors };
      });
      runRemote(() => upsertSector(supabase!, user!.id, t, sector));
    },
    [runRemote, user]
  );

  const setCapitalBase = useCallback(
    (n: number) => {
      setIsSeed(false);
      setDataset((d) => ({ ...d, capitalBase: n }));
      runRemote(() => upsertSettings(supabase!, user!.id, { capitalBase: n }));
    },
    [runRemote, user]
  );

  const setPrice = useCallback(
    (ticker: string, price: number) => {
      setIsSeed(false);
      setDataset((d) => ({
        ...d,
        lastPrices: { ...d.lastPrices, [ticker.toUpperCase()]: price },
      }));
      runRemote(() => upsertPrice(supabase!, user!.id, ticker, price));
    },
    [runRemote, user]
  );

  const setSpy = useCallback(
    (now: number, yearAgo: number, yearAgoDate: string) => {
      setIsSeed(false);
      setDataset((d) => ({ ...d, spy: { now, year_ago: yearAgo, year_ago_date: yearAgoDate } }));
      runRemote(() =>
        upsertSettings(supabase!, user!.id, {
          spyNow: now,
          spyYearAgo: yearAgo,
          spyYearAgoDate: yearAgoDate,
        })
      );
    },
    [runRemote, user]
  );

  const resetToSeed = useCallback(() => {
    // Demo-only affordance. In cloud mode this just reloads the demo view
    // locally without touching the user's saved data.
    setDataset(normalize(seed));
    setIsSeed(true);
  }, []);

  const clearAll = useCallback(() => {
    setIsSeed(false);
    setDataset((d) => ({ ...d, trades: [], stockEvents: [] }));
    if (mode === "cloud" && supabase && user) {
      runRemote(async () => {
        const { error: e } = await supabase!.from("trades").delete().eq("user_id", user.id);
        if (e) throw e;
        const { error: e2 } = await supabase!.from("stock_events").delete().eq("user_id", user.id);
        if (e2) throw e2;
      });
    }
  }, [mode, user, runRemote]);

  const value = useMemo<StoreCtx>(
    () => ({
      dataset,
      isSeed,
      mode,
      loading,
      error,
      addTrade,
      updateTrade,
      deleteTrade,
      replaceDataset,
      removeDuplicates,
      importStockEvents,
      deleteStockEvent,
      setSector,
      setCapitalBase,
      setPrice,
      setSpy,
      resetToSeed,
      clearAll,
    }),
    [
      dataset,
      isSeed,
      mode,
      loading,
      error,
      addTrade,
      updateTrade,
      deleteTrade,
      replaceDataset,
      removeDuplicates,
      importStockEvents,
      deleteStockEvent,
      setSector,
      setCapitalBase,
      setPrice,
      setSpy,
      resetToSeed,
      clearAll,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}
