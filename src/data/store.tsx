import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Dataset, Trade } from "../types";
import seed from "./seed.json";

// ============================================================================
// Data layer. Today: a local-first store persisted to localStorage so your data
// never leaves the browser (privacy by default — like premiuminsights.ai).
//
// FUTURE (public, multi-user): swap the read/write internals here for Supabase
// (Postgres + Auth — CLI already installed). The component API below
// (dataset + mutators) is the seam; pages never touch storage directly, so the
// migration is contained to this file.
// ============================================================================

const STORAGE_KEY = "flywheel:dataset:v1";

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
  }));
  return {
    exportedAt: raw.exportedAt ?? new Date().toISOString().slice(0, 10),
    capitalBase: Number(raw.capitalBase) || 0,
    lastPrices: raw.lastPrices ?? {},
    spy: raw.spy ?? { now: 0, year_ago: 0, year_ago_date: "" },
    trades,
  };
}

function loadInitial(): Dataset {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalize(JSON.parse(stored));
  } catch {
    /* fall through to seed */
  }
  return normalize(seed);
}

interface StoreCtx {
  dataset: Dataset;
  isSeed: boolean;
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
  const [dataset, setDataset] = useState<Dataset>(loadInitial);
  const [isSeed, setIsSeed] = useState<boolean>(() => !localStorage.getItem(STORAGE_KEY));

  // persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      /* storage full / disabled — in-memory still works */
    }
  }, [dataset]);

  const persistMark = useCallback(() => setIsSeed(false), []);

  const addTrade = useCallback(
    (t: Omit<Trade, "id">) => {
      persistMark();
      setDataset((d) => ({ ...d, trades: [...d.trades, { ...t, id: newId() }] }));
    },
    [persistMark]
  );

  const updateTrade = useCallback(
    (id: string, patch: Partial<Trade>) => {
      persistMark();
      setDataset((d) => ({
        ...d,
        trades: d.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },
    [persistMark]
  );

  const deleteTrade = useCallback(
    (id: string) => {
      persistMark();
      setDataset((d) => ({ ...d, trades: d.trades.filter((t) => t.id !== id) }));
    },
    [persistMark]
  );

  const replaceDataset = useCallback(
    (ds: Dataset, opts?: { merge?: boolean }) => {
      persistMark();
      const next = normalize(ds);
      setDataset((d) => {
        if (!opts?.merge) return next;
        // merge: keep existing trades, append new ones, prefer incoming prices/spy
        const seen = new Set(
          d.trades.map((t) => `${t.ticker}|${t.date}|${t.action}|${t.amount}`)
        );
        const merged = [
          ...d.trades,
          ...next.trades.filter(
            (t) => !seen.has(`${t.ticker}|${t.date}|${t.action}|${t.amount}`)
          ),
        ];
        return {
          ...d,
          trades: merged,
          lastPrices: { ...d.lastPrices, ...next.lastPrices },
          capitalBase: next.capitalBase || d.capitalBase,
          spy: next.spy.now ? next.spy : d.spy,
        };
      });
    },
    [persistMark]
  );

  const setCapitalBase = useCallback(
    (n: number) => {
      persistMark();
      setDataset((d) => ({ ...d, capitalBase: n }));
    },
    [persistMark]
  );

  const setPrice = useCallback(
    (ticker: string, price: number) => {
      persistMark();
      setDataset((d) => ({
        ...d,
        lastPrices: { ...d.lastPrices, [ticker.toUpperCase()]: price },
      }));
    },
    [persistMark]
  );

  const setSpy = useCallback(
    (now: number, yearAgo: number, yearAgoDate: string) => {
      persistMark();
      setDataset((d) => ({
        ...d,
        spy: { now, year_ago: yearAgo, year_ago_date: yearAgoDate },
      }));
    },
    [persistMark]
  );

  const resetToSeed = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDataset(normalize(seed));
    setIsSeed(true);
  }, []);

  const clearAll = useCallback(() => {
    persistMark();
    setDataset((d) => ({ ...d, trades: [] }));
  }, [persistMark]);

  const value = useMemo<StoreCtx>(
    () => ({
      dataset,
      isSeed,
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
