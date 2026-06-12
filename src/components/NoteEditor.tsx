import { useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { cls } from "../lib/format";
import { buildNote, parseNote } from "../lib/notes";
import type { Trade } from "../types";

// ---------------------------------------------------------------------------
// Inline journal-note editor for a single trade. Edits only the free-form
// prose; any earnings (`earn:`) token already on the note is preserved. Saves
// on blur or Ctrl/Cmd+Enter via the store's updateTrade — which persists to
// Supabase in cloud mode and to local state in demo mode automatically.
//
// It also flushes any pending edit on UNMOUNT: closing the drawer with Escape
// removes the editor before a blur can fire, so without this a just-typed note
// would be silently lost. A `lastSaved` guard keeps the flush from issuing a
// redundant write when blur already committed.
// ---------------------------------------------------------------------------

export function NoteEditor({
  trade,
  onSave,
  autoFocus = true,
  className,
}: {
  trade: Trade;
  onSave: (note: string | null) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const initial = parseNote(trade.note).text;
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const savedTimer = useRef<number>();

  // Latest values mirrored into refs so the unmount-flush cleanup reads fresh
  // state instead of a stale closure. `lastSaved` is the prose we believe is
  // already persisted, so the flush only writes genuinely newer text.
  const textRef = useRef(text);
  textRef.current = text;
  const tradeRef = useRef(trade);
  tradeRef.current = trade;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const lastSaved = useRef(initial);

  // Re-sync when switching to a different trade.
  useEffect(() => {
    const t = parseNote(trade.note).text;
    setText(t);
    lastSaved.current = t;
    setSaved(false);
  }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
    return () => window.clearTimeout(savedTimer.current);
  }, [autoFocus]);

  // Flush a pending edit if the editor unmounts before blur fires (e.g. the
  // drawer is dismissed with Escape), so a typed note is never silently lost.
  useEffect(() => {
    return () => {
      const next = textRef.current.trim();
      if (next !== lastSaved.current) {
        onSaveRef.current(buildNote(next, parseNote(tradeRef.current.note).earn));
      }
    };
  }, []);

  const commit = () => {
    const next = text.trim();
    if (next === lastSaved.current) return; // unchanged since last save
    onSave(buildNote(next, parseNote(trade.note).earn));
    lastSaved.current = next;
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className={cls("space-y-2", className)}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            commit();
            ref.current?.blur();
          }
        }}
        placeholder="Why this trade? Thesis, strike rationale, exit plan…"
        rows={4}
        className="input min-h-[88px] resize-y leading-relaxed"
      />
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Pencil size={11} />
          Saves on blur · ⌘/Ctrl+Enter
        </span>
        <span
          className={cls(
            "flex items-center gap-1 font-medium text-flux-400 transition-opacity",
            saved ? "opacity-100" : "opacity-0"
          )}
          aria-live="polite"
        >
          <Check size={12} /> Saved
        </span>
      </div>
    </div>
  );
}
