import type { Trade } from "../types";

// ============================================================================
// Strategy registry + classification (JF-27).
//
// Flywheel is no longer Wheel-only. Every trade belongs to a "strategy bucket":
//   • a PREDEFINED type the app understands (wheel, the four verticals, iron
//     condor, …) — these carry a label + a semantic color + structure rules; or
//   • a CUSTOM bucket the user names (free-form string) for a strategy the app
//     doesn't model yet.
//
// `resolveStrategy()` is the single source of truth for "what strategy is this
// trade?" — explicit tag wins, else we auto-detect from structure (mirrors the
// confirm/override pattern proven by wheel-tagging). Pure + deterministic.
// ============================================================================

export type StrategyKey =
  | "wheel"
  | "csp"
  | "covered-call"
  | "put-credit-spread"
  | "call-credit-spread"
  | "put-debit-spread"
  | "call-debit-spread"
  | "iron-condor"
  | "long-call"
  | "long-put"
  | "stock"
  | "other";

export type StrategyTone = "green" | "blue" | "gold" | "red" | "slate";

export interface StrategyDef {
  key: StrategyKey;
  label: string;
  /** Short label for chips / tight columns. */
  short: string;
  /** Pill/accent tone (maps to the Pill component tones). */
  tone: StrategyTone;
  /** Number of option legs that define the structure (0 = stock, undefined = varies). */
  legs?: number;
  blurb: string;
}

// Order here is the canonical display order for selectors and breakdowns.
export const STRATEGY_DEFS: StrategyDef[] = [
  { key: "wheel", label: "Wheel", short: "Wheel", tone: "green", blurb: "Cash-secured puts → assignment → covered calls." },
  { key: "csp", label: "Cash-Secured Put", short: "CSP", tone: "green", legs: 1, blurb: "Standalone short put (not part of a wheel)." },
  { key: "covered-call", label: "Covered Call", short: "CC", tone: "green", legs: 1, blurb: "Short call against held shares." },
  { key: "put-credit-spread", label: "Put Credit Spread", short: "PCS", tone: "green", legs: 2, blurb: "Bull put vertical — sell a put, buy a lower put." },
  { key: "call-credit-spread", label: "Call Credit Spread", short: "CCS", tone: "blue", legs: 2, blurb: "Bear call vertical — sell a call, buy a higher call." },
  { key: "put-debit-spread", label: "Put Debit Spread", short: "PDS", tone: "blue", legs: 2, blurb: "Bear put vertical — buy a put, sell a lower put." },
  { key: "call-debit-spread", label: "Call Debit Spread", short: "CDS", tone: "blue", legs: 2, blurb: "Bull call vertical — buy a call, sell a higher call." },
  { key: "iron-condor", label: "Iron Condor", short: "IC", tone: "gold", legs: 4, blurb: "Put credit spread + call credit spread, defined risk." },
  { key: "long-call", label: "Long Call", short: "LC", tone: "blue", legs: 1, blurb: "Bought call." },
  { key: "long-put", label: "Long Put", short: "LP", tone: "red", legs: 1, blurb: "Bought put." },
  { key: "stock", label: "Stock", short: "STK", tone: "slate", legs: 0, blurb: "Shares (assignment / outright)." },
  { key: "other", label: "Other", short: "Other", tone: "slate", blurb: "Uncategorized / custom." },
];

const DEF_BY_KEY = new Map<string, StrategyDef>(STRATEGY_DEFS.map((d) => [d.key, d]));

export function isPredefinedStrategy(key: string): key is StrategyKey {
  return DEF_BY_KEY.has(key);
}

/** Look up the definition for a key, or synthesize one for a custom bucket. */
export function strategyDef(key: string): StrategyDef {
  const d = DEF_BY_KEY.get(key);
  if (d) return d;
  // Custom user bucket: title-case the slug, neutral tone.
  const label = key
    .split(/[-_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return { key: "other", label: label || "Custom", short: label || "Custom", tone: "slate", blurb: "Custom strategy." };
}

export const strategyLabel = (key: string): string => strategyDef(key).label;
export const strategyTone = (key: string): StrategyTone => strategyDef(key).tone;

// ---- auto-detection --------------------------------------------------------

const WHEEL_ACTIONS = new Set<Trade["action"]>(["CSP", "CC", "BB", "AAssignSTK"]);

/** True for the original wheel-native single-leg actions. */
export function isWheelLeg(t: Trade): boolean {
  return WHEEL_ACTIONS.has(t.action);
}

const isShortLeg = (t: Trade) => t.action === "CSP" || t.action === "CC" || t.action === "STO" || t.action === "STC";

/**
 * Classify a multi-leg group (legs sharing a positionId) by structure. Handles
 * the four verticals + iron condor; falls back to "other" for shapes we don't
 * model yet. Looks at the OPENING legs only (BTO/STO/CSP/CC), by option type.
 */
function classifyGroup(legs: Trade[]): StrategyKey {
  const opens = legs.filter((l) => l.action === "STO" || l.action === "BTO" || l.action === "CSP" || l.action === "CC");
  const puts = opens.filter((l) => l.optionType === "put");
  const calls = opens.filter((l) => l.optionType === "call");

  // Iron condor: a put pair + a call pair.
  if (puts.length === 2 && calls.length === 2) return "iron-condor";

  // Two-leg vertical: same option type, one short + one long.
  if (opens.length === 2) {
    const sameType =
      (puts.length === 2 && "put") || (calls.length === 2 && "call") || null;
    if (sameType) {
      const short = opens.find(isShortLeg);
      const long = opens.find((l) => !isShortLeg(l));
      if (short && long) {
        const shortIsCredit = short.side === "credit";
        if (sameType === "put") return shortIsCredit ? "put-credit-spread" : "put-debit-spread";
        return shortIsCredit ? "call-credit-spread" : "call-debit-spread";
      }
    }
  }
  return "other";
}

/** Classify a single standalone leg. */
function classifyLeg(t: Trade): StrategyKey {
  if (isWheelLeg(t)) {
    if (t.action === "CSP") return "csp";
    if (t.action === "CC") return "covered-call";
    if (t.action === "AAssignSTK") return "stock";
    return "wheel"; // a lone BB — treat as wheel activity
  }
  if (t.action === "BTO") return t.optionType === "put" ? "long-put" : "long-call";
  if (t.action === "STO") return t.optionType === "put" ? "csp" : "covered-call";
  return "other";
}

/**
 * Resolve a trade's effective strategy. Precedence:
 *   1. explicit `trade.strategy` (user confirmed/overrode) — wins outright.
 *   2. if it belongs to a wheel cycle (passed in `inWheel`) → "wheel".
 *   3. if it's part of a multi-leg position → classify the group.
 *   4. otherwise → classify the standalone leg.
 *
 * `byPosition` maps positionId → all legs in that position (built once by the
 * caller). `inWheel` is the set of trade ids the wheel engine grouped.
 */
export function resolveStrategy(
  t: Trade,
  ctx: { byPosition: Map<string, Trade[]>; inWheel: Set<string> }
): string {
  if (t.strategy) return t.strategy;
  if (isWheelLeg(t) && ctx.inWheel.has(t.id)) return "wheel";
  if (t.positionId) {
    const legs = ctx.byPosition.get(t.positionId);
    if (legs && legs.length > 1) return classifyGroup(legs);
  }
  return classifyLeg(t);
}

/** Build the positionId → legs index used by resolveStrategy / computePositions. */
export function indexByPosition(trades: Trade[]): Map<string, Trade[]> {
  const m = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!t.positionId) continue;
    (m.get(t.positionId) ?? m.set(t.positionId, []).get(t.positionId)!).push(t);
  }
  return m;
}
