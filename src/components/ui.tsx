import type { ReactNode } from "react";
import { cls } from "../lib/format";

export function Card({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return <div className={cls("card", pad && "card-pad", className)}>{children}</div>;
}

export function SectionTitle({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-100">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "pos" | "neg" | "neutral" | "gold";
  hint?: string;
}) {
  const toneCls =
    tone === "pos"
      ? "text-flux-400"
      : tone === "neg"
      ? "text-loss-400"
      : tone === "gold"
      ? "text-torque-400"
      : "text-slate-100";
  return (
    <Card className="animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="stat-label">{label}</div>
        {hint && (
          <span className="cursor-help text-slate-600" title={hint}>
            ⓘ
          </span>
        )}
      </div>
      <div className={cls("mt-2 num text-2xl font-bold md:text-[28px]", toneCls)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "green" | "red" | "gold" | "slate" | "blue";
}) {
  const map: Record<string, string> = {
    green: "bg-flux-500/15 text-flux-300 ring-flux-500/25",
    red: "bg-loss-500/15 text-loss-400 ring-loss-500/25",
    gold: "bg-torque-500/15 text-torque-300 ring-torque-500/25",
    blue: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
    slate: "bg-white/5 text-slate-300 ring-white/10",
  };
  return <span className={cls("chip ring-1 ring-inset", map[tone])}>{children}</span>;
}

export function Bar({ value, max, tone = "green" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const color =
    tone === "green" ? "bg-flux-500" : tone === "gold" ? "bg-torque-500" : "bg-loss-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={cls("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <Card className="grid place-items-center py-16 text-center">
      <div className="text-slate-300">{title}</div>
      {sub && <div className="mt-1 max-w-md text-sm text-slate-500">{sub}</div>}
    </Card>
  );
}
