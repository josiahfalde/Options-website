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
import type { Dataset, Trade } from "../types";
import seed from "./seed.json";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import {
  deleteTradeRemote,
  fetchDataset,
  insertTrade,
  insertTrades,
  updateTradeRemote,
  upsertPrice,
  upsertSettings,
} from "./remote";

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
  }));
  return {
    exportedAt: raw.exportedAt ?? new Date().toISOString().slice(0, 10),
    capitalBase: Number(raw.capitalBase) || 0,
    lastPrices: raw.lastPrices ?? {},
    spy: raw.spy ?? { now: 0, year_ago: 0, year_ago_date: "" },
    trades,
  };
}

const emptyDataset = (): Dataset => ({
  exportedAt: new Date().toISOString().slice(0, 10),
  capitalBase: 0,
  lastPrices: {},
  spy: { now: 0, year_ago: 0, year_ago_date: "" },
  trades: [],
});

export type StoreMode = "demo" | "cloud";

interface StoreCtx {
  dataset: Dataset;
  isSeed: boolean;
  mode: StoreMode;
  loading: boolean;
  error: string | null;
  addTrade: (t: Omit<Trade, "id">) => void;
  updateTrade: (id: string, patch: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  replaceDataset: (ds: Dataset, opts?: { merge?: boolean }) => void;
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
    (ds: Dataset, opts?: { merge?: boolean }) => {
      setIsSeed(false);
      setError(null);
      const next = normalize(ds);

      // Compute the merged/replaced trade list off current state.
      const base = datasetRef.current;
      const seen = new Set(
        base.trades.map((t) => `${t.ticker}|${t.date}|${t.action}|${t.amount}`)
      );
      const incoming = opts?.merge
        ? next.trades.filter(
            (t) => !seen.has(`${t.ticker}|${t.date}|${t.action}|${t.amount}`)
          )
        : next.trades;

      if (mode === "cloud" && supabase && user) {
        // Persist: on replace (not merge) clear existing first, then bulk insert.
        (async () => {
          try {
            if (!opts?.merge) {
              const { error: delErr } = await supabase
                .from("trades")
                .delete()
                .eq("user_id", user.id);
              if (delErr) throw delErr;
            }
            await insertTrades(
              supabase,
              user.id,
              incoming.map(({ id: _id, ...rest }) => rest)
            );
            // settings + prices
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
          } catch (e: any) {
            setError(e?.message ?? "Import failed.");
          }
        })();
      } else {
        setDataset((d) =>
          opts?.merge
            ? {
                ...d,
                trades: [...d.trades, ...incoming],
                lastPrices: { ...d.lastPrices, ...next.lastPrices },
                capitalBase: next.capitalBase || d.capitalBase,
                spy: next.spy.now ? next.spy : d.spy,
              }
            : next
        );
      }
    },
    [mode, user]
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
    setDataset((d) => ({ ...d, trades: [] }));
    if (mode === "cloud" && supabase && user) {
      runRemote(async () => {
        const { error: e } = await supabase!.from("trades").delete().eq("user_id", user.id);
        if (e) throw e;
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
