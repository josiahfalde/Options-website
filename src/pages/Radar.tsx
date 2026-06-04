import { useMemo } from "react";
import { AlertTriangle, CalendarClock, PackageOpen } from "lucide-react";
import { useStore } from "../data/store";
import { openPositions, computeCampaigns, type OpenPosition } from "../data/compute";
import { Card, Pill, SectionTitle, EmptyState } from "../components/ui";
import { ActionPill } from "./Dashboard";
import { usd, signed, pct, fmtDate, daysBetween, todayISO, cls, posneg } from "../lib/format";

export default function RadarPage() {
  const { dataset, updateTrade } = useStore();
  const open = useMemo(() => openPositions(dataset), [dataset]);
  const camps = useMemo(() => computeCampaigns(dataset), [dataset]);
  const holdings = camps.filter((c) => c.sharesHeld > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Earnings &amp; Assignment Radar</h1>
        <p className="mt-1 text-sm text-slate-400">
          Open contracts ranked by time risk, plus assigned shares tracked against their
          premium-adjusted cost basis. Add an expiry &amp; earnings date to light up the warnings.
        </p>
      </div>

      {/* Open contracts */}
      <Card pad={false} className="overflow-hidden">
        <div className="card-pad pb-3">
          <SectionTitle
            title="Open Contracts"
            sub={`${open.length} live · sorted by soonest expiry`}
            right={<Pill tone="blue"><CalendarClock size={13} /> time decay working for you</Pill>}
          />
        </div>
        {open.length === 0 ? (
          <div className="px-5 pb-6"><EmptyState title="No open contracts" sub="Every sold contract is resolved." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-white/5 bg-white/[0.02]">
                <tr>
                  <th className="th">Ticker</th>
                  <th className="th">Type</th>
                  <th className="th">Opened</th>
                  <th className="th">Premium</th>
                  <th className="th">Expiry</th>
                  <th className="th">DTE</th>
                  <th className="th">Earnings</th>
                  <th className="th">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {open.map((o) => (
                  <OpenRow key={o.trade.id} o={o} onSet={(p) => updateTrade(o.trade.id, p)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assigned holdings */}
      <div>
        <SectionTitle
          title="Assigned Shares"
          sub="Capital tied up in stock. Keep selling calls until called away."
        />
        {holdings.length === 0 ? (
          <EmptyState title="No shares held" sub="You're all cash — selling puts." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {holdings.map((h) => {
              const underwater = h.lastPrice < h.costBasis;
              return (
                <Card key={h.ticker} className={cls(underwater && "ring-1 ring-loss-500/20")}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <PackageOpen size={18} className="text-torque-400" />
                      <span className="text-lg font-bold text-slate-50">{h.ticker}</span>
                      <Pill tone="gold">{h.sharesHeld} sh</Pill>
                    </div>
                    {underwater ? (
                      <Pill tone="red"><AlertTriangle size={13} /> Underwater</Pill>
                    ) : (
                      <Pill tone="green">In the green</Pill>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <Mini label="Cost basis" value={usd(h.costBasis)} />
                    <Mini label="Last price" value={usd(h.lastPrice)} />
                    <Mini label="Unrealized" value={signed(h.unrealized)} tone={posneg(h.unrealized)} />
                  </div>
                  <div className="mt-3 text-[11px] text-slate-500">
                    Premium has lowered your basis <span className="text-flux-300">{pct(h.cushionPct, 1)}</span>{" "}
                    below the assignment price. You need {usd(h.costBasis)} to break even — sell calls
                    near/above that strike.
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OpenRow({ o, onSet }: { o: OpenPosition; onSet: (p: any) => void }) {
  const dte = o.trade.expiry ? daysBetween(todayISO(), o.trade.expiry) : null;
  const earningsRisk =
    o.trade.expiry && o.trade.note && /earn:(\d{4}-\d{2}-\d{2})/.test(o.trade.note)
      ? (() => {
          const m = o.trade.note!.match(/earn:(\d{4}-\d{2}-\d{2})/)!;
          return m[1] <= o.trade.expiry!;
        })()
      : false;
  const urgent = dte !== null && dte <= 7;
  return (
    <tr className={cls("hover:bg-white/[0.025]", urgent && "bg-loss-500/[0.04]")}>
      <td className="td font-semibold text-slate-100">{o.trade.ticker}</td>
      <td className="td"><ActionPill action={o.trade.action} /></td>
      <td className="td whitespace-nowrap text-slate-400">{fmtDate(o.trade.date)} · {o.daysOpen}d ago</td>
      <td className="td num text-flux-400">+{usd(o.trade.amount)}</td>
      <td className="td">
        <input
          type="date"
          defaultValue={o.trade.expiry ?? ""}
          onChange={(e) => onSet({ expiry: e.target.value })}
          className="rounded-lg border border-white/10 bg-ink-900/80 px-2 py-1 text-xs text-slate-200 outline-none focus:border-flux-500/50"
        />
      </td>
      <td className="td num">
        {dte === null ? (
          <span className="text-slate-600">—</span>
        ) : (
          <span className={cls(urgent ? "text-loss-400 font-semibold" : "text-slate-300")}>{dte}d</span>
        )}
      </td>
      <td className="td">
        <input
          type="date"
          defaultValue={o.trade.note?.match(/earn:(\d{4}-\d{2}-\d{2})/)?.[1] ?? ""}
          onChange={(e) => onSet({ note: e.target.value ? `earn:${e.target.value}` : null })}
          className="rounded-lg border border-white/10 bg-ink-900/80 px-2 py-1 text-xs text-slate-200 outline-none focus:border-flux-500/50"
        />
      </td>
      <td className="td">
        {earningsRisk ? (
          <Pill tone="red"><AlertTriangle size={12} /> Earnings</Pill>
        ) : urgent ? (
          <Pill tone="gold">Expiring</Pill>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cls("num font-bold", tone === "pos" ? "text-flux-400" : tone === "neg" ? "text-loss-400" : "text-slate-100")}>
        {value}
      </div>
    </div>
  );
}
