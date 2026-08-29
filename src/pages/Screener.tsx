import { useMemo, useState } from "react";
import { Check, X, Gauge, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, Pill, SectionTitle, Delta, deltaDir } from "../components/ui";
import { cspYield, checkRules, DEFAULT_RULES, type RuleConfig } from "../lib/finance";
import { usd, pct, cls } from "../lib/format";
import { useStore } from "../data/store";

export default function Screener() {
  const { dataset } = useStore();
  const tickers = Object.keys(dataset.lastPrices);

  const [ticker, setTicker] = useState(tickers[0] ?? "");
  const [strike, setStrike] = useState(12);
  const [premium, setPremium] = useState(40);
  const [dte, setDte] = useState(30);
  const [contracts, setContracts] = useState(1);
  const [earnings, setEarnings] = useState(false);
  const [rules, setRules] = useState<RuleConfig>(DEFAULT_RULES);

  const shares = contracts * 100;
  const y = useMemo(
    () => cspYield({ premium: premium * contracts, strike, dte, shares }),
    [premium, strike, dte, shares, contracts]
  );
  const checks = useMemo(
    () => checkRules(y, dte, { ...rules, earningsBeforeExpiry: earnings }),
    [y, dte, rules, earnings]
  );
  const go = checks.every((c) => c.pass);
  const passCount = checks.filter((c) => c.pass).length;
  // Yield headroom vs the user's annualized-target rule — the headline context.
  const yieldVsTarget = y.annualized - rules.minAnnualized;

  const setFromTicker = (t: string) => {
    setTicker(t);
    const px = dataset.lastPrices[t];
    if (px) setStrike(Math.round(px));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Yield Screener</h1>
        <p className="mt-1 text-sm text-slate-400">
          Price a cash-secured put before you sell it. Get the annualized yield on collateral and a
          go/no-go against your Wheel rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Inputs */}
        <Card>
          <SectionTitle title="Contract" />
          <div className="space-y-4">
            {tickers.length > 0 ? (
              <div>
                <label className="stat-label">Ticker (loads last price)</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tickers.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFromTicker(t)}
                      aria-pressed={ticker === t}
                      className={cls(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40",
                        ticker === t
                          ? "bg-flux-500 text-ink-950"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      )}
                    >
                      {t} <span className="num opacity-60">{usd(dataset.lastPrices[t], 2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                Enter a strike and premium below to price any put.{" "}
                <Link to="/import" className="font-medium text-flux-300 hover:text-flux-200">
                  Import your trades
                </Link>{" "}
                to one-tap-fill your own tickers' last prices.
              </div>
            )}
            <NumField label="Strike ($/share)" value={strike} onChange={setStrike} step={0.5} />
            <NumField label="Premium ($ per contract)" value={premium} onChange={setPremium} step={1} />
            <div>
              <label className="stat-label">Days to expiry: {dte} DTE</label>
              <input
                type="range"
                min={1}
                max={90}
                value={dte}
                aria-label="Days to expiry"
                onChange={(e) => setDte(+e.target.value)}
                className="mt-2 w-full accent-flux-500"
              />
            </div>
            <NumField label="Contracts" value={contracts} onChange={setContracts} step={1} min={1} />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={earnings}
                onChange={(e) => setEarnings(e.target.checked)}
                className="h-4 w-4 accent-loss-500"
              />
              Earnings before expiry
            </label>
          </div>
        </Card>

        {/* Result */}
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Yield"
            right={
              <Pill tone={go ? "green" : "red"}>
                {go ? <Check size={13} /> : <X size={13} />}
                {go ? "GO: fits your rules" : `NO-GO · ${passCount}/${checks.length}`}
              </Pill>
            }
          />

          {/* Hero: annualized yield with target context */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label flex items-center gap-1.5">
                <Gauge size={13} className="text-slate-500" />
                Annualized yield on collateral
              </span>
              <Delta
                dir={deltaDir(yieldVsTarget)}
                value={`${pct(yieldVsTarget, 1)} vs target`}
                size="sm"
              />
            </div>
            <div className="mt-2 num text-[34px] font-bold leading-none text-torque-400 md:text-[44px]">
              {pct(y.annualized, 1)}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              <span className="num text-flux-400">{pct(y.periodReturn, 2)}</span> over {dte} days ·
              target <span className="num">{pct(rules.minAnnualized, 0)}</span> annualized
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Big label="Premium" value={usd(premium * contracts)} tone="pos" />
            <Big label="Collateral" value={usd(y.collateral, 0)} />
            <Big label="$/day" value={usd((premium * contracts) / Math.max(dte, 1), 2)} />
            <Big label="Breakeven" value={usd(y.breakeven, 2)} />
            <Big label="Downside cushion" value={pct(y.cushionPct, 1)} tone="sky" />
            <Big
              label="If assigned"
              value={usd(y.breakeven * shares, 0)}
              sub="cost of shares"
            />
          </div>

          {/* Rule checklist */}
          <div className="mt-5 space-y-2">
            <div className="stat-label">Wheel-rule check</div>
            {checks.map((c) => (
              <div
                key={c.label}
                className={cls(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                  c.pass
                    ? "border-flux-500/20 bg-flux-500/[0.06]"
                    : "border-loss-500/20 bg-loss-500/[0.06]"
                )}
              >
                <span
                  className={cls(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                    c.pass ? "bg-flux-500/20 text-flux-400" : "bg-loss-500/20 text-loss-400"
                  )}
                >
                  {c.pass ? <Check size={14} /> : <X size={14} />}
                </span>
                <span className="font-medium text-slate-200">{c.label}</span>
                <span className={cls("ml-auto num text-xs", c.pass ? "text-flux-300" : "text-loss-400")}>
                  {c.detail}
                </span>
              </div>
            ))}
          </div>

          <details className="group mt-4 text-xs text-slate-500">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-slate-400 hover:text-slate-200">
              <Sparkles size={13} className="text-flux-400" />
              Tune rules
            </summary>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <NumField
                label="Min annualized %"
                value={Math.round(rules.minAnnualized * 100)}
                onChange={(v) => setRules({ ...rules, minAnnualized: v / 100 })}
                step={1}
              />
              <NumField
                label="DTE low"
                value={rules.dteLow}
                onChange={(v) => setRules({ ...rules, dteLow: v })}
                step={1}
              />
              <NumField
                label="DTE high"
                value={rules.dteHigh}
                onChange={(v) => setRules({ ...rules, dteHigh: v })}
                step={1}
              />
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <div>
      <label className="stat-label">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="input mt-1.5 num"
      />
    </div>
  );
}

function Big({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "pos" | "sky";
  sub?: string;
}) {
  const toneCls =
    tone === "pos" ? "text-flux-400" : tone === "sky" ? "text-sky-300" : "text-slate-100";
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="stat-label">{label}</div>
      <div className={cls("mt-1 num text-lg font-bold", toneCls)}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}
