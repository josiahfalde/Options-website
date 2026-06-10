import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, RotateCcw } from "lucide-react";
import { cls, usd0 } from "../lib/format";

/**
 * Inline, discoverable editor for the return-on-capital denominator.
 *
 * When `estimated` is true the capital base was derived from peak put
 * collateral (see compute.ts); we surface that with an amber "Estimated"
 * affordance so the user can correct it in one click, right where they
 * see the "(est.)" return. When the user has set their own value we drop
 * the estimate tag and offer a plain "edit" + "Reset to estimate".
 *
 * Visual-only wiring: Save/Reset call `onCommit`. Reset passes 0, which
 * makes compute.ts re-estimate (`ds.capitalBase || estimateCapitalBase`).
 *
 * The popover is portaled to <body> with fixed positioning so it can't be
 * clipped by the KPI card's overflow or painted under the charts below.
 */
export function CapitalBaseEditor({
  capitalBase,
  estimated,
  onCommit,
}: {
  capitalBase: number;
  estimated: boolean;
  onCommit: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(capitalBase)));
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const POP_WIDTH = 288; // w-72

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 12;
    const left = Math.min(
      Math.max(margin, r.left),
      window.innerWidth - POP_WIDTH - margin
    );
    setPos({ left, top: r.bottom + 8 });
  };

  // Position before paint, and re-seed/focus the draft on open.
  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (open) {
      setDraft(String(Math.round(capitalBase)));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open, capitalBase]);

  // Close on outside click / Escape; reposition on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const save = () => {
    const n = parseFloat(draft.replace(/[^0-9.]/g, "")) || 0;
    onCommit(n);
    setOpen(false);
  };

  const reset = () => {
    onCommit(0); // 0 → compute.ts re-estimates
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          estimated
            ? "Capital base is estimated from your peak put collateral — click to set your real capital."
            : "Click to edit your capital base."
        }
        className={cls(
          "group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1 text-xs font-medium",
          "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-flux-500/40",
          estimated
            ? "text-torque-300 hover:bg-torque-500/10"
            : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
        )}
      >
        {estimated ? (
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-torque-400" aria-hidden />
            <span className="num">${usd0(capitalBase).slice(1)}</span>
            <span className="uppercase tracking-wide text-[10px] font-semibold text-torque-400">
              · Est.
            </span>
            <span className="text-torque-300/80 underline decoration-dotted underline-offset-2 group-hover:text-torque-200">
              Set actual
            </span>
          </>
        ) : (
          <>
            <span className="num">${usd0(capitalBase).slice(1)}</span>
            <span className="text-slate-500">capital</span>
            <Pencil size={11} className="text-slate-500 group-hover:text-slate-300" />
          </>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Edit capital base"
            style={{ position: "fixed", left: pos.left, top: pos.top, width: POP_WIDTH }}
            className="z-50 max-w-[calc(100vw-1.5rem)] animate-fade-up rounded-xl border border-white/10 bg-ink-850/95 p-4 shadow-card backdrop-blur-md"
          >
            <div className="stat-label">Capital base</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              The denominator for your return on capital.{" "}
              {estimated ? (
                <>
                  We estimated <span className="text-torque-300">{usd0(capitalBase)}</span> from
                  your peak cash-secured-put collateral. Enter your real capital to override it.
                </>
              ) : (
                <>Enter your real account capital, or reset to use the estimate.</>
              )}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  inputMode="decimal"
                  aria-label="Capital base in dollars"
                  className="input num pl-6"
                />
              </div>
              <button type="button" onClick={save} className="btn-primary px-3 py-2 text-xs">
                Save
              </button>
            </div>

            {!estimated && (
              <button
                type="button"
                onClick={reset}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-slate-400 outline-none transition-colors hover:text-torque-300 focus-visible:text-torque-300"
              >
                <RotateCcw size={12} /> Reset to estimate (peak put collateral)
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
