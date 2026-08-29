# Flywheel — project guide for Claude

**Flywheel** is a Wheel-strategy options-premium analytics dashboard — a single-page
web app that turns a trader's wheel positions into momentum/yield analytics.
Aesthetic direction (from the README): calm, premium, data-dense but uncluttered —
*"Your broker shows trades. Flywheel shows momentum."*

This file is the single source of truth for the project's stack and design system.
It exists so any agent — especially the global **`ui-designer`** subagent — can
orient quickly and stay consistent instead of reinventing patterns. Reuse what's
here; a new token or pattern needs a real justification.

## Stack & commands

- **Framework / build:** Vite + React 18 + TypeScript. Icons: `lucide-react`.
  Charts: `Recharts`.
- **Routing:** `react-router-dom` **`HashRouter`** (wrapper in `src/main.tsx`,
  routes in `src/App.tsx`). URLs look like `…/#/trades`. Routes: `/#/` (Dashboard),
  `/#/trades`, `/#/campaigns`, `/#/allocation`, `/#/screener`, `/#/radar`, `/#/insights`,
  `/#/import`, `/#/account`. Unknown paths fall back to Dashboard.
- **Dev server:** `npm run dev` → http://localhost:5173/ (Vite default; no custom
  port set).
- **Typecheck + build:** `npm run build` (`tsc --noEmit && vite build`). This is the
  no-regression backstop — a clean build is part of "done."
- **Deploy:** `npm run deploy` (builds, then publishes `dist` to the `gh-pages`
  branch via `gh-pages`). Hosted on GitHub Pages.

## Styling & theming

- **Tailwind utilities + a small set of component classes.** No CSS Modules /
  styled-components / UI kit.
- **Light AND dark themes** (this is NOT a dark-only app). `darkMode: "class"`;
  the active theme is a `.dark` / `.light` class on the root, toggled via
  `src/components/ThemeToggle.tsx` + `src/lib/theme.ts` (`ThemeProvider`,
  `useTheme`, `useChartTheme`, `applyTheme`, `resolveInitialTheme`).
- **Theme-aware tokens via CSS variables.** Neutral surfaces (`ink-*`), text
  (`slate-*`), and the overlay `white` are backed by CSS variables defined per
  theme in `src/index.css` (`.dark { --c-ink-950: … }` / `.light { … }`). The same
  utility (`bg-ink-850`, `text-slate-400`, `border-white/10`) automatically flips
  between themes — so **prefer these tokens over hard-coded colors**, and when you
  add light-mode polish, follow the existing `.light .<class>` override pattern in
  `index.css` rather than inlining conditionals.

## Design tokens — `tailwind.config.js` (`theme.extend`)

- `ink` 950→600 — neutral surfaces (page canvas / cards / inputs), theme-aware.
- `slate` 50→600 — text, theme-aware.
- `flux` (emerald, `flux-500` = brand/primary) — **premium / positive / primary
  action.** Static hex (same in both themes).
- `torque` (amber) — **capital deployed / at-risk / "gold" highlight.**
- `loss` (rose) — **losses / negative / destructive.**
- **Color semantics are load-bearing: green = good/premium, amber = capital/caution,
  rose = loss. Never swap them for aesthetic reasons.**
- Fonts: `font-sans` = Inter (body), `font-mono` = JetBrains Mono (numbers).
- Shadows: `shadow-card` (the card look, var-driven), `shadow-glow` (emerald glow —
  use sparingly).
- Animations: `animate-fade-up` (entrances), `animate-spinslow` (the logo cog).
  Respect `prefers-reduced-motion` for anything new.

## Reusable component classes — `src/index.css` (`@layer components`)

`.card` / `.card-pad`, `.btn` / `.btn-primary` / `.btn-ghost`, `.input`, `.chip`,
`.stat-label`, `.num` (`font-mono tabular-nums` — use for ALL numeric/tabular data
so columns align), `.nav-link` / `.nav-link-active`, `.th` / `.td`, and `.pos` /
`.neg` text colors. Several have `.light .<class>` overrides. **Reach for these
before writing raw utility soup.**

## Shared React components — `src/components/`

- `ui.tsx`: `Card`, `SectionTitle`, `Kpi` (`tone: "pos" | "neg" | "neutral" |
  "gold"`), `Pill` (`tone: "green" | "red" | "gold" | "slate" | "blue"`), `Bar`
  (`tone` string, default `"green"`), `EmptyState` (`title`, `sub`).
- `Layout.tsx`: the app shell — sidebar at `md:` and up, horizontal scrolling
  top-nav below `md`, plus the `Brand` mark.
- `ThemeToggle.tsx`, `CapitalBaseEditor.tsx`.

## Other anchors

- Brand strings: `src/brand.ts` — `BRAND.name` = "Flywheel",
  `BRAND.tagline` = "Your broker shows trades. Flywheel shows momentum."
- Helpers: `src/lib/format.ts` — number/formatting helpers and **`cls(...)`** for
  conditional classNames (use this, NOT `clsx`/`classnames` — not dependencies here).
  Also `finance.ts`, `theme.ts`, `supabase.ts`.
- Screens: `src/pages/*` (Dashboard, Trades, Campaigns, Allocation, Screener, Radar, Insights,
  ImportData, Account).
- Auth UI: `src/auth/` (`AuthProvider`, `AuthModal`, `AuthButton`, `AccountMenu`,
  `AuthUI`, `DemoBanner`).

## Guardrails

- **Do NOT touch the analytics/data layer for a visual change:** `src/data/`
  (`compute.ts`, `allocation.ts`, `store.tsx`, `remote.ts`, `importXlsx.ts`, `importStock.ts`). `compute.ts` was
  validated to the penny against a real workbook. Surface backend/data/auth needs
  rather than reaching into them.
- **Verify visually.** Playwright MCP browser tools are available — load the actual
  hash route, screenshot before/after at desktop (~1440×900) and mobile (~390×844,
  the sidebar→top-nav breakpoint is `md`), and check the interactive states
  (hover, focus-visible, active, disabled, loading, empty, error) **and both light
  and dark themes**. Wide data tables (`.th`/`.td`) are a common mobile-overflow
  culprit. Then run `npm run build`.
- Keep diffs tight and reviewable; preserve conventions, file structure, and naming.

## Front-end design work → `ui-designer`

Design-heavy or "change what I can see" work on this app should be handled by the
global **`ui-designer`** subagent (`~/.claude/agents/ui-designer.md`), which orients
to this file before designing. Route backend/data/auth/build work elsewhere.
