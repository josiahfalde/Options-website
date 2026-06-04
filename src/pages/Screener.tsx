import { useMemo, useState } from "react";
import { Check, X, Gauge } from "lucide-react";
import { Card, Pill, SectionTitle } from "../components/ui";
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
            {tickers.length > 0 && (
              <div>
                <label className="stat-label">Ticker (loads last price)</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tickers.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFromTicker(t)}
                      className={cls(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold",
                        ticker === t ? "bg-flux-500 text-ink-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
                      )}
                    >
                      {t} <span className="opacity-60">{usd(dataset.lastPrices[t], 2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <NumField label="Strike ($/share)" value={strike} onChange={setStrike} step={0.5} />
            <NumField label="Premium ($ per contract)" value={premium} onChange={setPremium} step={1} />
            <div>
              <label className="stat-label">Days to expiry — {dte} DTE</label>
              <input
                type="range"
                min={1}
                max={90}
                value={dte}
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

        {/* Result gauge */}
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Yield"
            right={
              <Pill tone={go ? "green" : "red"}>
                <Gauge size={14} /> {go ? "GO — fits your rules" : "NO-GO"}
              </Pill>
            }
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Big label="Annualized" value={pct(y.annualized, 1)} tone="text-torque-400" big />
            <Big label="Period return" value={pct(y.periodReturn, 2)} tone="text-flux-400" />
            <Big label="Collateral" value={usd(y.collateral, 0)} tone="text-slate-100" />
            <Big label="Premium" value={usd(premium * contracts)} tone="text-flux-400" />
            <Big label="Breakeven" value={usd(y.breakeven, 2)} tone="text-slate-100" />
            <Big label="Downside cushion" value={pct(y.cushionPct, 1)} tone="text-sky-300" />
            <Big label="$/day" value={usd((premium * contracts) / Math.max(dte, 1), 2)} tone="text-slate-100" />
            <Big
              label="If assigned"
              value={usd(y.breakeven * shares, 0)}
              tone="text-slate-100"
              sub="cost of shares"
            />
          </div>

          {/* Rule checklist */}
          <div className="mt-5 space-y-2">
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
                <span className="ml-auto num text-xs text-slate-400">{c.detail}</span>
              </div>
            ))}
          </div>

          <details className="mt-4 text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400">Tune rules</summary>
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
  big,
}: {
  label: string;
  value: string;
  tone: string;
  sub?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="stat-label">{label}</div>
      <div className={cls("mt-1 num font-bold", big ? "text-2xl" : "text-lg", tone)}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}
