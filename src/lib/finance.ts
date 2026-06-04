// Option-seller math used by the screener and radar.

export interface YieldInputs {
  premium: number; // total $ collected for the contract
  strike: number; // per share
  dte: number; // days to expiry
  shares?: number; // default 100
}

export interface YieldResult {
  collateral: number; // cash secured (CSP) = strike * shares
  periodReturn: number; // premium / collateral
  annualized: number; // periodReturn * 365 / dte
  premiumPerShare: number;
  breakeven: number; // strike - premiumPerShare (CSP downside cushion)
  cushionPct: number; // breakeven distance vs strike
}

export function cspYield(i: YieldInputs): YieldResult {
  const shares = i.shares ?? 100;
  const collateral = i.strike * shares;
  const periodReturn = collateral > 0 ? i.premium / collateral : 0;
  const annualized = i.dte > 0 ? periodReturn * (365 / i.dte) : 0;
  const premiumPerShare = i.premium / shares;
  const breakeven = i.strike - premiumPerShare;
  const cushionPct = i.strike > 0 ? premiumPerShare / i.strike : 0;
  return {
    collateral,
    periodReturn,
    annualized,
    premiumPerShare,
    breakeven,
    cushionPct,
  };
}

// The aiwheel rule set, surfaced as a go/no-go checklist.
export interface RuleCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface RuleConfig {
  minAnnualized: number; // 0.20
  dteLow: number; // 21
  dteHigh: number; // 45
  earningsBeforeExpiry: boolean;
}

export const DEFAULT_RULES: RuleConfig = {
  minAnnualized: 0.2,
  dteLow: 21,
  dteHigh: 45,
  earningsBeforeExpiry: false,
};

export function checkRules(
  y: YieldResult,
  dte: number,
  rules: RuleConfig
): RuleCheck[] {
  return [
    {
      label: "Annualized yield ≥ target",
      pass: y.annualized >= rules.minAnnualized,
      detail: `${(y.annualized * 100).toFixed(1)}% vs ${(rules.minAnnualized * 100).toFixed(0)}% min`,
    },
    {
      label: "DTE in sweet spot",
      pass: dte >= rules.dteLow && dte <= rules.dteHigh,
      detail: `${dte} DTE (target ${rules.dteLow}–${rules.dteHigh})`,
    },
    {
      label: "No earnings before expiry",
      pass: !rules.earningsBeforeExpiry,
      detail: rules.earningsBeforeExpiry ? "Earnings risk inside window" : "Clear",
    },
  ];
}
