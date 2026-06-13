# Flywheel UI redesign — research-grounded principles

> Foundation for the JF-25 UI overhaul. Distilled from a deep, source-verified
> UX research pass (WCAG primary standards, Bloomberg's terminal accessibility
> work, Nielsen Norman Group, behavioral-economics literature, and fintech
> design-consensus sources). Apply these across **every** screen. Items marked
> **[MUST]** are non-negotiable (accessibility / correctness); the rest are
> strong heuristics — use judgment, and improve on them where it serves the user.

## 1. Gain/loss & color — accessibility is non-negotiable
- **[MUST] Never encode gain/loss by color alone.** ~8% of men (1 in 12) and
  ~0.5% of women are red-green colorblind; deuteranopia/protanopia make our
  flux-green and loss-rose nearly identical. **Every** positive/negative value
  must carry a *non-color* cue too: a leading `+`/`−` sign, an up/down arrow
  (▲/▼ or lucide `ArrowUp`/`ArrowDown`/`TrendingUp`/`TrendingDown`), and/or a
  text label. Color reinforces; it never carries the meaning by itself.
- Keep the existing semantic palette (it's load-bearing): **green=premium/gain,
  amber/torque=capital-at-risk/caution, rose=loss.** Don't recolor for aesthetics.
- Apply the strong color to the **delta/change**, not necessarily the raw number,
  and always pair the delta with a directional icon.
- **[MUST] Contrast:** body text ≥ 4.5:1; critical numbers (P&L, balances, the
  hero figures) target ≈ 7:1. Verify in both light and dark themes.

## 2. Information architecture — inverted pyramid
- Lead with the most important answer. On the **overview (Dashboard)**, the
  single most critical KPI(s) go **top / top-left** (users scan in F/Z patterns;
  the top-left is the "golden triangle"). Summaries first, detail on demand.
- **Keep the overview to ~5–7 key metrics/visuals.** Resist cramming; push the
  rest to drill-downs and the dedicated pages. Operational pages can be denser,
  but the home screen must answer "how am I doing?" in one glance.
- Group navigation logically (e.g. Overview → positions/campaigns → research
  tools → journal/history → data/account). Every nav item and button should have
  a clear, single purpose; remove or merge anything that doesn't.

## 3. KPI / stat cards
- **Never show an isolated number.** Pair every metric with context: prior-period
  comparison, a target/goal, a benchmark (e.g. vs SPY), or a trend/sparkline.
  e.g. "Realized P&L $641 ▲ +6.4% vs last month".
- Visual hierarchy on the card: **primary value large & bold** (≈30% larger than
  secondary), supporting metrics smaller and lighter. One clear focal point per card.
- Use `font-mono tabular-nums` (the `.num` class) for all figures so columns and
  changing values stay aligned and scannable.

## 4. Progressive disclosure & drill-down
- Show high-level summaries first; reveal detail on demand. **Make summary cards
  and chart elements clickable entry points** into a detailed breakdown (a drawer,
  expand, or sub-view) — this is also what stacks cleanly on mobile.
- Don't bury primary KPIs or common actions behind disclosure — keep frequent
  tasks shallow; hide only the secondary depth.

## 5. Onboarding & empty states  **[MUST] every empty state]**
- This tool is empty until the user seeds it with their own trades, so empty
  states are a primary surface, not an afterthought. **Every** empty/zero-data
  state needs three parts: (1) informative copy explaining what will fill it,
  (2) a visual/illustration/icon, (3) a clear **CTA/action** that moves the user
  toward populating it (e.g. "Import your trades" / "Log your first trade" /
  "Sign in to save"). No dead-end blank screens.
- The logged-out demo is itself onboarding — make the "this is sample data → make
  it yours" path obvious and inviting.

## 6. Cognitive load, rhythm & trust
- Muted/calm base with **selective accent color to guide attention** (accent the
  things that matter — the hero number, the primary action — not everything).
  Generous, consistent whitespace and a clear type scale reduce strain and read
  as trustworthy/credible.
- Consistency builds trust: one card style, one button hierarchy, one spacing
  scale, predictable placement. Reuse the existing component classes and tokens
  (see CLAUDE.md) — extend them deliberately rather than inventing one-offs.
- Present **losses with care** (loss aversion: losses are felt ~2× as intensely).
  Be honest and clear about downside — but do **not** use manipulative
  loss-framing to steer the user. Inform, don't nudge.

## 7. Responsive / mobile
- Card/grid layouts should stack cleanly at the `md` breakpoint (sidebar→top-nav).
- **Dense data tables on mobile** are the classic failure: prefer column-priority
  (hide/collapse low-priority columns), a sticky first column, row-expand for
  detail, or sparkline/summary substitution — over forcing a wide horizontal scroll.
- Charts must remain legible at ~390px wide; simplify rather than shrink.

## Do NOT (research-refuted or out of scope)
- Don't use loss-framing as a persuasive nudge to steer choices (refuted).
- Don't recolor the app around "blue/green = trust" (refuted); keep the existing
  green/amber/rose semantics.
- Note (future): green=gain/red=loss is a **Western** convention (reversed in
  much of East Asia). If the app is ever internationalized, make it configurable.
  Not in scope now.

## Guardrails for this overhaul
- **Presentation only.** Do not change `src/data/*` (`compute.ts` is penny-validated)
  or `src/types.ts` or auth/session logic. Preserve every existing feature: demo
  vs cloud modes, auth (incl. the Brave OAuth fix), the calendar, wheels, journal
  notes, disclaimer/terms/privacy, import. Consume data only via the public
  `useStore()` / compute exports.
- Keep it real: every screen must still build (`npm run build`) and be verified
  in the browser (desktop + mobile, light + dark) before it's "done".
