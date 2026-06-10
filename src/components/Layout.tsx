import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Table2,
  CircleDashed,
  Calculator,
  Radar,
  Lightbulb,
  Upload,
  Cog,
} from "lucide-react";
import type { ReactNode } from "react";
import { BRAND } from "../brand";
import { useStore } from "../data/store";
import { AuthButton } from "../auth/AuthButton";
import { DemoBanner } from "../auth/DemoBanner";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/campaigns", label: "Wheel Campaigns", icon: CircleDashed },
  { to: "/trades", label: "Trades", icon: Table2 },
  { to: "/screener", label: "Yield Screener", icon: Calculator },
  { to: "/radar", label: "Earnings Radar", icon: Radar },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/import", label: "Import / Data", icon: Upload },
];

export function Layout({ children }: { children: ReactNode }) {
  const { isSeed } = useStore();
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-ink-900/60 p-4 backdrop-blur md:flex">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " nav-link-active" : "")
              }
            >
              <n.icon size={18} strokeWidth={2} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        {isSeed && (
          <div className="mt-4 rounded-xl border border-torque-500/20 bg-torque-500/5 p-3 text-[11px] leading-relaxed text-torque-300">
            <span className="font-semibold">Live demo data</span> from your Wheel
            workbook. Import or edit on the Data page to make it yours.
          </div>
        )}
        <div className="mt-4 border-t border-white/5 pt-4">
          <AuthButton />
        </div>
        <div className="mt-3">
          <ThemeToggle />
        </div>
        <div className="mt-3 px-2 text-[10px] text-slate-500">
          Local-first · your data stays in this browser
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-ink-950/80 px-4 py-3 backdrop-blur md:hidden">
          <Brand compact />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle compact />
            <AuthButton compact />
          </div>
        </header>
        <div className="md:hidden">
          <nav className="flex gap-1 overflow-x-auto border-b border-white/5 px-2 py-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium " +
                  (isActive ? "bg-flux-500/10 text-flux-300" : "text-slate-400")
                }
              >
                <n.icon size={15} />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <DemoBanner />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-flux-500/10 ring-1 ring-flux-500/30">
        <Cog className="animate-spinslow text-flux-400" size={22} />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight text-slate-100">
          {BRAND.name}
        </div>
        {!compact && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Premium Analytics
          </div>
        )}
      </div>
    </div>
  );
}
