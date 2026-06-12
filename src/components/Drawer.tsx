import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cls } from "../lib/format";

// ---------------------------------------------------------------------------
// A right-side slide-over panel (drawer) for drill-downs and detail views.
// On mobile it becomes a near-full-width sheet. Closes on Escape / backdrop
// click. Motion respects prefers-reduced-motion via the animate-* utilities
// (which already gate on the media query in this project's Tailwind setup —
// we additionally use motion-reduce: to disable the slide transform).
// ---------------------------------------------------------------------------

export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-fade-up motion-reduce:animate-none"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={cls(
          "relative flex h-full w-full flex-col border-l border-white/10 bg-ink-900 shadow-2xl",
          "translate-x-0 animate-[slidein_.22s_ease-out] motion-reduce:animate-none",
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold tracking-tight text-slate-100">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flux-500/40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/5 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
