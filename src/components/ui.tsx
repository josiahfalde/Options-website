import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  type LucideProps,
} from "lucide-react";
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

/* ------------------------------------------------------------------ */
/* Delta — colorblind-safe gain/loss treatment.                        */
/* Meaning NEVER rides on color alone: every Delta carries a directional*/
/* icon (▲/▼) AND a +/− sign, with the semantic color only reinforcing. */
/* Reused everywhere a change / positive / negative value appears.      */
/* ------------------------------------------------------------------ */
export type DeltaDir = "up" | "down" | "flat";

export function deltaDir(n: number, flatEps = 0): DeltaDir {
  if (n > flatEps) return "up";
  if (n < -flatEps) return "down";
  return "flat";
}

export function Delta({
  value,
  dir,
  size = "sm",
  weight = "semibold",
  icon = true,
  className,
}: {
  /** Pre-formatted label, e.g. "+$641", "+6.4%", "1.2pp". A leading +/− is
   *  preserved; if absent we add one based on `dir`. */
  value: ReactNode;
  /** Direction drives icon + color. Pass it explicitly, or derive via deltaDir(). */
  dir: DeltaDir;
  size?: "xs" | "sm" | "base";
  weight?: "medium" | "semibold" | "bold";
  /** Show the directional arrow (kept true except in very tight inline spots). */
  icon?: boolean;
  className?: string;
}) {
  const Icon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const tone =
    dir === "up" ? "text-flux-400" : dir === "down" ? "text-loss-400" : "text-slate-400";
  const sizeCls = size === "xs" ? "text-[11px]" : size === "base" ? "text-sm" : "text-xs";
  const weightCls =
    weight === "bold" ? "font-bold" : weight === "medium" ? "font-medium" : "font-semibold";
  return (
    <span
      className={cls("inline-flex items-center gap-0.5 num", sizeCls, weightCls, tone, className)}
    >
      {icon && (
        <Icon
          size={size === "base" ? 15 : 13}
          strokeWidth={2.5}
          className="shrink-0"
          aria-hidden="true"
        />
      )}
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Kpi — the headline stat card.                                       */
/* Large bold primary value + muted label, and CONTEXT on every metric */
/* (a Delta vs a prior period / benchmark / target, or a plain `sub`). */
/* Optional `to` turns the whole card into a drill-down link.          */
/* ------------------------------------------------------------------ */
export function Kpi({
  label,
  value,
  sub,
  delta,
  tone = "neutral",
  hint,
  to,
  icon: Icon,
  className,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  /** Supporting context line (benchmark, breakdown, target). */
  sub?: ReactNode;
  /** Colorblind-safe change indicator — render with <Delta/>. */
  delta?: ReactNode;
  tone?: "pos" | "neg" | "neutral" | "gold";
  hint?: string;
  /** When set, the card becomes a drill-down link to this route. */
  to?: string;
  /** Optional leading glyph for the label row. */
  icon?: ComponentType<LucideProps>;
  className?: string;
  /** "lg" = hero card (bigger number). */
  size?: "md" | "lg";
}) {
  const toneCls =
    tone === "pos"
      ? "text-flux-400"
      : tone === "neg"
      ? "text-loss-400"
      : tone === "gold"
      ? "text-torque-400"
      : "text-slate-50";
  const valueSize =
    size === "lg"
      ? "text-[34px] leading-none md:text-[44px]"
      : "text-2xl leading-none md:text-[28px]";

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="stat-label flex items-center gap-1.5">
          {Icon && <Icon size={13} className="text-slate-500" aria-hidden="true" />}
          {label}
        </div>
        <div className="flex items-center gap-1.5">
          {delta}
          {hint && (
            <span
              className="cursor-help text-slate-500 transition-colors hover:text-slate-300"
              title={hint}
              aria-label={hint}
            >
              ⓘ
            </span>
          )}
        </div>
      </div>
      <div className={cls("mt-2.5 num font-bold", valueSize, toneCls)}>{value}</div>
      {sub && <div className="mt-2 text-xs leading-relaxed text-slate-400">{sub}</div>}
      {to && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ArrowUpRight size={15} />
        </span>
      )}
    </>
  );

  const base = cls(
    "card card-pad relative animate-fade-up",
    size === "lg" && "md:p-6",
    className
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cls(
          base,
          "group block transition-colors hover:border-flux-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
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

/* ------------------------------------------------------------------ */
/* EmptyState — a primary surface, not an afterthought.                */
/* Three parts per the principles: (1) icon/visual, (2) informative    */
/* copy, (3) a clear CTA that moves the user toward populating it.     */
/* ------------------------------------------------------------------ */
export function EmptyState({
  title,
  sub,
  icon: Icon,
  action,
  secondaryAction,
  className,
  compact,
}: {
  title: string;
  sub?: string;
  icon?: ComponentType<LucideProps>;
  /** Primary CTA. `to` (route) or `onClick`. */
  action?: { label: string; to?: string; onClick?: () => void; icon?: ComponentType<LucideProps> };
  /** Optional ghost-styled secondary CTA. */
  secondaryAction?: { label: string; to?: string; onClick?: () => void };
  className?: string;
  compact?: boolean;
}) {
  return (
    <Card
      className={cls(
        "grid place-items-center text-center",
        compact ? "py-10" : "py-16",
        className
      )}
    >
      <div className="max-w-sm">
        {Icon && (
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-flux-500/10 ring-1 ring-inset ring-flux-500/20">
            <Icon size={26} className="text-flux-400" strokeWidth={2} aria-hidden="true" />
          </div>
        )}
        <div className="text-base font-semibold text-slate-100">{title}</div>
        {sub && <div className="mx-auto mt-1.5 text-sm leading-relaxed text-slate-400">{sub}</div>}
        {(action || secondaryAction) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {action && <EmptyAction {...action} primary />}
            {secondaryAction && <EmptyAction {...secondaryAction} />}
          </div>
        )}
      </div>
    </Card>
  );
}

function EmptyAction({
  label,
  to,
  onClick,
  icon: Icon,
  primary,
}: {
  label: string;
  to?: string;
  onClick?: () => void;
  icon?: ComponentType<LucideProps>;
  primary?: boolean;
}) {
  const klass = primary ? "btn-primary" : "btn-ghost";
  const inner = (
    <>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {label}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={klass}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={klass}>
      {inner}
    </button>
  );
}
