import { useMemo } from "react";
import { CircleDashed, Coins, Layers, ShieldCheck } from "lucide-react";
import { useStore } from "../data/store";
import { computeCampaigns, type WheelCampaign } from "../data/compute";
import { Card, Pill, Bar } from "../components/ui";
import { usd, signed, pct, fmtDate, cls, posneg } from "../lib/format";

export default function Campaigns() {
  const { dataset } = useStore();
  const camps = useMemo(() => computeCampaigns(dataset), [dataset]);
  const totalPremium = camps.reduce((a, c) => a + c.premiumCollected, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Wheel Campaigns</h1>
        <p className="mt-1 text-sm text-slate-400">
          Each ticker's full Wheel cycle — sell puts, get assigned, sell calls, get called away —
          with premium-adjusted cost basis and capital at risk.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {camps.map((c) => (
          <CampaignCard key={c.ticker} c={c} totalPremium={totalPremium} />
        ))}
      </div>
    </div>
  );
}

function CampaignCard({ c, totalPremium }: { c: WheelCampaign; totalPremium: number }) {
  const stateTone =
    c.state === "Holding shares" ? "gold" : c.state === "Selling puts" ? "green" : "slate";
  const holding = c.sharesHeld > 0;
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-6 -top-6 opacity-[0.06]">
        <CircleDashed size={120} className="animate-spinslow text-flux-400" />
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold tracking-tight text-slate-50">{c.ticker}</h3>
            <Pill tone={stateTone as any}>{c.state}</Pill>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {fmtDate(c.firstDate)} → {fmtDate(c.lastDate)} · {c.contracts} contracts
          </div>
        </div>
        <div className="text-right">
          <div className="stat-label">Premium</div>
          <div className="num text-lg font-bold text-flux-400">{usd(c.premiumCollected)}</div>
        </div>
      </div>

      {/* Share of total premium */}
      <div className="mt-3">
        <Bar value={c.premiumCollected} max={totalPremium} tone="green" />
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Stat
          icon={<Coins size={14} />}
          label="Realized"
          value={signed(c.realized)}
          tone={posneg(c.realized)}
        />
        <Stat
          icon={<Layers size={14} />}
          label="Cycles done"
          value={String(c.cyclesCompleted)}
          sub={`${c.putsAssigned} assigned`}
        />
        <Stat
          icon={<ShieldCheck size={14} />}
          label={holding ? "Cost basis" : "Capital risk"}
          value={holding ? usd(c.costBasis) : usd(c.capitalAtRisk)}
          sub={holding ? `${c.sharesHeld} sh held` : c.capitalAtRisk > 0 ? "deployed" : "flat"}
        />
      </div>

      {/* Holding detail */}
      {holding && (
        <div className="mt-4 rounded-xl border border-torque-500/15 bg-torque-500/[0.06] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Holding {c.sharesHeld} sh · last {usd(c.lastPrice)} · basis {usd(c.costBasis)}
            </span>
            <span className={cls("num font-semibold", posneg(c.unrealized))}>
              {signed(c.unrealized)} unreal.
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
            <span className="text-flux-300">▼ {pct(c.cushionPct, 1)}</span>
            premium has cut your basis below the assignment price — that's your cushion before a
            real loss.
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className={cls("mt-1 num font-bold", tone === "pos" ? "text-flux-400" : tone === "neg" ? "text-loss-400" : "text-slate-100")}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}
