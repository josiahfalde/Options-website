import { useMemo } from "react";
import { AlertTriangle, CalendarClock, PackageOpen, Radar as RadarIcon, Upload } from "lucide-react";
import { useStore } from "../data/store";
import { openPositions, computeCampaigns, type OpenPosition } from "../data/compute";
import { Card, Pill, SectionTitle, EmptyState, Delta, deltaDir } from "../components/ui";
import { ActionPill } from "./Dashboard";
import { usd, pct, fmtDate, daysBetween, todayISO, cls } from "../lib/format";

export default function RadarPage() {
  const { dataset, updateTrade } = useStore();
  const open = useMemo(() => openPositions(dataset), [dataset]);
  const camps = useMemo(() => computeCampaigns(dataset), [dataset]);
  const holdings = camps.filter((c) => c.sharesHeld > 0);

  const hasTrades = dataset.trades.length > 0;
  const nothingToTrack = open.length === 0 && holdings.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Earnings &amp; Assignment Radar</h1>
        <p className="mt-1 text-sm text-slate-400">
          Open contracts ranked by time risk, plus assigned shares tracked against their
          premium-adjusted cost basis. Add an expiry &amp; earnings date to light up the warnings.
        </p>
      </div>

      {nothingToTrack ? (
        <EmptyState
          icon={RadarIcon}
          title={hasTrades ? "Nothing on the radar right now" : "No positions to track yet"}
          sub={
            hasTrades
              ? "Every contract is resolved and you're holding no assigned shares; you're all cash. New open puts and calls will appear here, sorted by soonest expiry."
              : "Open puts and calls show up here ranked by time risk, and any assigned shares are tracked against their cost basis. Import your trades to start watching the clock."
          }
          action={
            hasTrades
              ? { label: "Price a new put", to: "/screener" }
              : { label: "Import your trades", to: "/import", icon: Upload }
          }
          secondaryAction={hasTrades ? { label: "View all trades", to: "/trades" } : undefined}
        />
      ) : (
        <>
      {/* Open contracts */}
      <div>
        <SectionTitle
          title="Open Contracts"
          sub={open.length ? `${open.length} live · sorted by soonest expiry` : "None open right now"}
          right={
            open.length > 0 ? (
              <Pill tone="blue">
                <CalendarClock size={13} /> time decay working for you
              </Pill>
            ) : undefined
          }
        />
        {open.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarClock}
            title="No open contracts"
            sub="Every sold contract is resolved. Sell a new put or call and it'll show up here with its expiry countdown."
            action={{ label: "Price a put in the screener", to: "/screener" }}
          />
        ) : (
          <>
            {/* Desktop / tablet: full table */}
            <Card pad={false} className="hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/5 bg-white/[0.02]">
                    <tr>
                      <th className="th">Ticker</th>
                      <th className="th">Type</th>
                      <th className="th">Opened</th>
                      <th className="th text-right">Premium</th>
                      <th className="th">Expiry</th>
                      <th className="th text-right">DTE</th>
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
            </Card>

            {/* Mobile: stacked cards — no horizontal scroll */}
            <div className="space-y-2 md:hidden">
              {open.map((o) => (
                <OpenCard key={o.trade.id} o={o} onSet={(p) => updateTrade(o.trade.id, p)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Assigned holdings */}
      <div>
        <SectionTitle
          title="Assigned Shares"
          sub="Capital tied up in stock. Keep selling calls until called away."
        />
        {holdings.length === 0 ? (
          <EmptyState
            compact
            icon={PackageOpen}
            title="No shares held"
            sub="You're all cash and selling puts; nothing has been assigned. Any shares you get put are tracked here against their premium-adjusted basis."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {holdings.map((h) => {
              const underwater = h.lastPrice < h.costBasis;
              return (
                <Card key={h.ticker} className={cls(underwater && "ring-1 ring-loss-500/20")}>
                  <div className="flex items-start justify-between gap-2">
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
                    <Mini
                      label="Unrealized"
                      value={
                        <Delta
                          dir={deltaDir(h.unrealized)}
                          value={usd(Math.abs(h.unrealized))}
                          size="sm"
                          weight="bold"
                        />
                      }
                    />
                  </div>
                  <div className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    Premium has lowered your basis{" "}
                    <span className="num font-semibold text-flux-300">{pct(h.cushionPct, 1)}</span>{" "}
                    below the assignment price. You need{" "}
                    <span className="num">{usd(h.costBasis)}</span> to break even; sell calls
                    near/above that strike.
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function dteMeta(o: OpenPosition) {
  const dte = o.trade.expiry ? daysBetween(todayISO(), o.trade.expiry) : null;
  const earningsRisk =
    o.trade.expiry && o.trade.note && /earn:(\d{4}-\d{2}-\d{2})/.test(o.trade.note)
      ? (() => {
          const m = o.trade.note!.match(/earn:(\d{4}-\d{2}-\d{2})/)!;
          return m[1] <= o.trade.expiry!;
        })()
      : false;
  const urgent = dte !== null && dte <= 7;
  return { dte, earningsRisk, urgent };
}

function FlagPill({ earningsRisk, urgent }: { earningsRisk: boolean; urgent: boolean }) {
  if (earningsRisk) return <Pill tone="red"><AlertTriangle size={12} /> Earnings</Pill>;
  if (urgent) return <Pill tone="gold">Expiring</Pill>;
  return <span className="text-slate-600">—</span>;
}

function OpenRow({ o, onSet }: { o: OpenPosition; onSet: (p: any) => void }) {
  const { dte, earningsRisk, urgent } = dteMeta(o);
  return (
    <tr className={cls("hover:bg-white/[0.025]", urgent && "bg-loss-500/[0.04]")}>
      <td className="td font-semibold text-slate-100">{o.trade.ticker}</td>
      <td className="td"><ActionPill action={o.trade.action} /></td>
      <td className="td whitespace-nowrap text-slate-400">{fmtDate(o.trade.date)} · {o.daysOpen}d ago</td>
      <td className="td text-right">
        <Delta dir="up" value={usd(o.trade.amount)} size="sm" className="justify-end" />
      </td>
      <td className="td">
        <input
          type="date"
          aria-label={`Expiry date for ${o.trade.ticker} ${o.trade.action}`}
          defaultValue={o.trade.expiry ?? ""}
          onChange={(e) => onSet({ expiry: e.target.value })}
          className="rounded-lg border border-white/10 bg-ink-900/80 px-2 py-1 text-xs text-slate-200 outline-none transition focus:border-flux-500/50 focus:ring-2 focus:ring-flux-500/20"
        />
      </td>
      <td className="td text-right num">
        {dte === null ? (
          <span className="text-slate-600">—</span>
        ) : (
          <span className={cls(urgent ? "font-semibold text-loss-400" : "text-slate-300")}>{dte}d</span>
        )}
      </td>
      <td className="td">
        <input
          type="date"
          aria-label={`Earnings date for ${o.trade.ticker}`}
          defaultValue={o.trade.note?.match(/earn:(\d{4}-\d{2}-\d{2})/)?.[1] ?? ""}
          onChange={(e) => onSet({ note: e.target.value ? `earn:${e.target.value}` : null })}
          className="rounded-lg border border-white/10 bg-ink-900/80 px-2 py-1 text-xs text-slate-200 outline-none transition focus:border-flux-500/50 focus:ring-2 focus:ring-flux-500/20"
        />
      </td>
      <td className="td"><FlagPill earningsRisk={earningsRisk} urgent={urgent} /></td>
    </tr>
  );
}

function OpenCard({ o, onSet }: { o: OpenPosition; onSet: (p: any) => void }) {
  const { dte, earningsRisk, urgent } = dteMeta(o);
  return (
    <div className={cls("card p-3", urgent && "ring-1 ring-loss-500/20")}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-100">{o.trade.ticker}</span>
        <ActionPill action={o.trade.action} />
        <Delta dir="up" value={usd(o.trade.amount)} size="sm" weight="bold" className="ml-auto" />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span>Opened {fmtDate(o.trade.date)} · {o.daysOpen}d ago</span>
        {dte !== null && (
          <>
            <span className="text-slate-600">·</span>
            <span className={cls("num", urgent ? "font-semibold text-loss-400" : "text-slate-400")}>
              {dte}d to expiry
            </span>
          </>
        )}
        {(earningsRisk || urgent) && <FlagPill earningsRisk={earningsRisk} urgent={urgent} />}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Expiry</span>
          <input
            type="date"
            aria-label={`Expiry date for ${o.trade.ticker} ${o.trade.action}`}
            defaultValue={o.trade.expiry ?? ""}
            onChange={(e) => onSet({ expiry: e.target.value })}
            className="input mt-1 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Earnings</span>
          <input
            type="date"
            aria-label={`Earnings date for ${o.trade.ticker}`}
            defaultValue={o.trade.note?.match(/earn:(\d{4}-\d{2}-\d{2})/)?.[1] ?? ""}
            onChange={(e) => onSet({ note: e.target.value ? `earn:${e.target.value}` : null })}
            className="input mt-1 px-2 py-1.5 text-xs"
          />
        </label>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="num font-bold text-slate-100">{value}</div>
    </div>
  );
}
