// ---------------------------------------------------------------------------
// Note helpers. A Trade.note string can carry two things at once:
//   • an "earn:YYYY-MM-DD" earnings-date token (set on the Radar page, read by
//     the earnings-risk logic there), and
//   • free-form journal text the trader writes about the position.
// These helpers split a raw note into its parts and recombine them, so the
// Journal editor can edit the prose without clobbering earnings metadata and
// vice-versa. The earnings token is kept first so Radar's regex still matches.
// ---------------------------------------------------------------------------

const EARN_RE = /earn:(\d{4}-\d{2}-\d{2})/;

export interface ParsedNote {
  /** earnings date token value, or null */
  earn: string | null;
  /** human-written journal prose, trimmed of the earn token */
  text: string;
}

export function parseNote(raw: string | null | undefined): ParsedNote {
  if (!raw) return { earn: null, text: "" };
  const m = raw.match(EARN_RE);
  const earn = m ? m[1] : null;
  const text = raw.replace(EARN_RE, "").trim();
  return { earn, text };
}

/** Recombine journal prose with an optional earnings token into one note string. */
export function buildNote(text: string, earn: string | null): string | null {
  const t = text.trim();
  const parts: string[] = [];
  if (earn) parts.push(`earn:${earn}`);
  if (t) parts.push(t);
  return parts.length ? parts.join(" ") : null;
}

/** The journal-visible prose for a trade (empty string when none). */
export function noteText(raw: string | null | undefined): string {
  return parseNote(raw).text;
}

/** True when the trade carries human journal prose (ignores earnings-only notes). */
export function hasJournalNote(raw: string | null | undefined): boolean {
  return parseNote(raw).text.length > 0;
}
