import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  Table2,
  CircleDashed,
  Calculator,
  Radar,
  CalendarDays,
  Lightbulb,
  Upload,
  Cog,
  type LucideProps,
} from "lucide-react";
import { useState, type ComponentType, type DragEvent, type ReactNode } from "react";
import { BRAND } from "../brand";
import { setPendingImportFile } from "../lib/pendingImport";
import { DISCLAIMER_SHORT } from "../content/legal";
import { useStore } from "../data/store";
import { AuthButton } from "../auth/AuthButton";
import { DemoBanner } from "../auth/DemoBanner";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { to: string; label: string; icon: ComponentType<LucideProps>; end?: boolean };
type NavGroup = { heading: string; items: NavItem[] };

// Grouped by job-to-be-done: see how you're doing → manage live positions →
// research the next trade → review the record → manage your data.
const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/strategies", label: "Strategies", icon: Layers },
    ],
  },
  {
    heading: "Positions",
    items: [
      { to: "/campaigns", label: "Wheel Campaigns", icon: CircleDashed },
      { to: "/trades", label: "Trades", icon: Table2 },
    ],
  },
  {
    heading: "Research",
    items: [
      { to: "/screener", label: "Yield Screener", icon: Calculator },
      { to: "/radar", label: "Earnings Radar", icon: Radar },
    ],
  },
  {
    heading: "Review",
    items: [
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/insights", label: "Insights", icon: Lightbulb },
    ],
  },
  {
    heading: "Data",
    items: [{ to: "/import", label: "Import / Data", icon: Upload }],
  },
];

// Flat list for the mobile top-nav (order preserved from the groups).
const NAV_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** True only for a real OS file drag (not text/link drags within the page). */
function isFileDrag(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
}

/**
 * Lets a file dragged from the OS be hovered over the "Import / Data" nav
 * link to switch to the Import page mid-drag (like hovering a browser tab),
 * so one continuous drag can land on the dropzone there. A drop directly on
 * the link is also caught and handed to ImportData instead of letting the
 * browser open the file.
 */
function useImportNavFileDrag() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dragOver, setDragOver] = useState(false);

  const props = {
    onDragEnter: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setDragOver(true);
      if (location.pathname !== "/import") navigate("/import");
    },
    onDragOver: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // required so the link is a valid drop target
    },
    onDragLeave: (e: DragEvent) => {
      // Ignore leaves into our own children (icon/label) to avoid flicker.
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // never let the browser navigate to/open the file
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) setPendingImportFile(f);
      if (location.pathname !== "/import") navigate("/import");
    },
  };
  return { dragOver, props };
}

export function Layout({ children }: { children: ReactNode }) {
  const { isSeed } = useStore();
  const importDrag = useImportNavFileDrag();
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-ink-900/60 p-4 backdrop-blur md:flex">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {group.heading}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    {...(n.to === "/import" ? importDrag.props : {})}
                    className={({ isActive }) =>
                      "nav-link" +
                      (isActive || (n.to === "/import" && importDrag.dragOver)
                        ? " nav-link-active"
                        : "")
                    }
                  >
                    <n.icon size={18} strokeWidth={2} />
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </div>
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
        <div className="sticky top-[57px] z-10 bg-ink-950/80 backdrop-blur md:hidden">
          <nav className="flex gap-1 overflow-x-auto border-b border-white/5 px-2 py-2">
            {NAV_FLAT.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                {...(n.to === "/import" ? importDrag.props : {})}
                className={({ isActive }) =>
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40 " +
                  (isActive || (n.to === "/import" && importDrag.dragOver)
                    ? "bg-flux-500/10 text-flux-300 ring-1 ring-inset ring-flux-500/20"
                    : "text-slate-400 hover:text-slate-200")
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

        <footer className="border-t border-white/5 px-4 py-5 md:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 text-[11px] leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl">
              {DISCLAIMER_SHORT} Trading options involves substantial risk of loss.
            </p>
            <nav className="flex shrink-0 items-center gap-3 font-medium text-slate-400">
              <NavLink to="/disclaimer" className="hover:text-slate-200">
                Disclaimer
              </NavLink>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <NavLink to="/terms" className="hover:text-slate-200">
                Terms
              </NavLink>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <NavLink to="/privacy" className="hover:text-slate-200">
                Privacy
              </NavLink>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Cog className="animate-spinslow shrink-0 text-flux-400" size={24} strokeWidth={1.75} />
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
