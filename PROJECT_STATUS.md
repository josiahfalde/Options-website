# FlywheelTrades — Project Status & Continuity

> **Purpose of this file:** the portable source of truth for this project. It lives
> in the repo (not in any one machine's local notes) so that on a fresh machine you
> can clone, read this, and pick up exactly where work left off. **If you are a
> Claude Code session resuming this project: read this file top to bottom first,
> then open the Linear project for the live task board.**
>
> _Last updated: 2026-06-15 (Vercel hosting live; full UI overhaul; wheel-tagging;
> legal pages; Brave OAuth fix; Google sign-in public; dashboard timeframe scoping;
> multi-strategy support — per-strategy P&L + multi-leg spreads)._

---

## 1. What this is

**FlywheelTrades** (working brand "Flywheel") — a **paid, multi-user, Wheel-strategy
options-premium analytics SaaS**. It extends a personal Excel Wheel-tracking system
(`Options Trading.xlsx`) into a premiuminsights.ai-style web dashboard.
Tagline: _"Your broker shows trades; Flywheel shows momentum."_

**Goal:** a fully working website with a paid plan where users sign up, import/log
their options trades, and track premium income, Wheel campaigns, and performance vs SPY.

**Decisions locked in:**
- Audience: **public SaaS** (others sign up & subscribe), not just personal.
- Logged-out visitors see an **anonymized read-only demo** ("sign in to save").
- Auth: **email/password + Google**.

---

## 2. Where to resume on a NEW machine

1. `git clone https://github.com/josiahfalde/Options-website && cd Options-website`
2. `npm install`
3. **Recreate the gitignored credential files** (they do NOT travel via git — see §7).
   At minimum, for the app to run: `cp .env.example .env.local` (the Supabase URL +
   anon key are public-safe and already filled in `.env.example`).
4. `npm run dev` to run locally; `npm run build` to typecheck+build; `npm run deploy`
   to publish to GitHub Pages.
5. Open the **Linear board** (§5) for the current task list, or just read §4/§6 below.

---

## 3. Stack & architecture

- **Frontend:** Vite + React + TypeScript + Tailwind + Recharts + SheetJS (xlsx).
- **Backend:** Supabase (Postgres + Auth + Row-Level Security). Project ref
  `wdzdtnrmdxgyoxuaqpbp`, region `us-east-1`. **Separate** from the ParakaleoMMC backend.
- **Hosting:** **LIVE on Vercel (JF-11 done, 2026-06-12).** Production URL
  **https://options-website-sandy.vercel.app/** (project `options-website`, Vercel team
  "Josiah's projects", Hobby plan). Auto-deploys on push to `main`; PRs get preview URLs.
  Config in `vercel.json`; dashboard playbook in `docs/vercel-deploy.md`. Verified
  end-to-end: app loads, Google login redirects back to Vercel, cloud-mode trade writes
  persist. GitHub Pages (`npm run deploy`) remains a manual fallback. Vercel gives the
  serverless functions (`/api/*`) that Stripe webhooks + OAuth callbacks need (unblocks
  billing, Phase 3).
- **Payments:** Stripe (planned, Phase 3).

**Dual-mode data layer** — the core design. The app switches on auth state:
- **DEMO** (logged out): anonymized seed data, in-memory only, nothing persists.
- **CLOUD** (logged in): Supabase is the source of truth, scoped per-user by RLS;
  writes are optimistic and revert on error.

Both modes expose the **same `useStore()` API**, so pages never change. The seam
(only these files know where data lives):
- `src/lib/supabase.ts` — null-safe client (app still runs with no backend).
- `src/auth/AuthProvider.tsx` — session source + `signUp` / `signInWithPassword` /
  `signInWithGoogle` / `signOut` / `resetPassword`.
- `src/data/remote.ts` — snake_case DB row ↔ camelCase `Trade`/`Dataset` mapping + CRUD.
- `src/data/store.tsx` — the demo/cloud switch + the public store API.
- `src/main.tsx` wraps `AuthProvider` → `StoreProvider` → `App`.

The analytics engine `src/data/compute.ts` was validated **to the penny** against the
real workbook (realized $382.66, MTM −$399.34). Don't casually refactor it.

**Database:** schema + RLS in `supabase/migrations/0001_init.sql`. Tables:
`profiles` (with `stripe_customer_id` / `plan` / `subscription_status` /
`current_period_end` already stubbed for billing), `trades`, `prices`,
`user_settings`. All RLS-locked to `auth.uid()`; a trigger auto-creates a profile +
settings row on signup. Apply with `supabase db push`.

---

## 4. Status — what's DONE vs TODO

### ✅ Done (Phase 1 + Phase 2)
- **Supabase backend live & verified.** Schema + RLS applied; verified anonymous REST
  reads return `[]` (no cross-user leak). (JF-5)
- **Dual-mode data layer built & committed.** Demo/cloud adapter, builds + typechecks
  clean. (JF-6, commit `746eaa8`)
- **Auth UI** — signup / login / reset modal, portaled & centered. (JF-7)
- **Google sign-in (OAuth)** — "Continue with Google" button wired to `signInWithGoogle`;
  Google Cloud OAuth client created + Google provider enabled in Supabase + redirect URLs
  whitelisted. Verified working end-to-end on 2026-06-10. (JF-8, commit `3991b52`)
- **Route protection + account menu + demo banner + account settings.** (JF-9)
- **End-to-end cloud test PASSED** — DB/RLS proven (15/15: signup trigger, insert/fetch
  persists, RLS blocks all cross-user read/update/delete/spoof) + full UI flow (login →
  add trade via UI → row confirmed in Postgres → survives reload). (JF-10)
- **Fidelity CSV import fix** — parse expiry/strike, resolve statuses, estimate capital
  base. (JF-21) Plus a follow-up: the capital-base estimator now releases CSP collateral
  on the **actual** buyback/assignment date, not expiry, so the peak isn't overstated
  (a real CSV went from a bogus $6,800 to a correct ~$2,650). (commit `31d6d85`)
- **Capital-base override** made discoverable as an inline editor on the Dashboard. (`e574aa1`)
- **Light mode + theme toggle** — Tailwind class strategy + CSS-variable tokens; dark
  stays default & identical. (PR #5, `7113824`)

### ✅ Done (Phase 3 — hosting, product, polish: 2026-06-12 → 06-14)
- **JF-11 — Hosting migrated to Vercel.** Live at **https://options-website-sandy.vercel.app/**
  (auto-deploys on push to `main`; PR preview URLs). `vercel.json` (Vite preset, SPA
  rewrite, security headers); playbook `docs/vercel-deploy.md`. No app code changed —
  `base:"./"` + HashRouter were already portable. GitHub Pages kept as manual fallback. (PR #6)
- **JF-23 — Brave/mobile Google sign-in fixed.** PKCE `code_verifier` was being dropped
  from localStorage across the OAuth redirect on Brave mobile → silent bounce. Now:
  `detectSessionInUrl:false` + manual OAuth return in `src/auth/oauthReturn.ts` (surfaces
  real errors), and a **resilient `storage` adapter** in `src/lib/supabase.ts` that mirrors
  the verifier into a first-party cookie. Confirmed working on the user's Brave phone. (PR #8)
- **Google consent screen PUBLISHED (2026-06-13).** In production — **anyone** can Google
  sign-in now (no longer test-users-only). Email + Google both fully public.
- **JF-15 — Not-financial-advice disclaimer.** Footer (every page) + `/#/disclaimer` page +
  signup acknowledgment. Copy in `src/content/legal.ts`. (PR #9)
- **JF-16 — Terms of Service + Privacy Policy.** `/#/terms` + `/#/privacy`; footer links
  Disclaimer · Terms · Privacy; copy in `src/content/legal.ts` (`LEGAL_CONTACT`). (PR #11)
  ⚠️ Legal copy is a sensible default — get a lawyer's review before a hard public launch.
- **JF-22 — Premium calendar + per-trade journal + drill-downs.** `/#/calendar` (P&L heatmap /
  activity / upcoming toggle + day drill-down); per-trade journal notes (`Trade.note`, saved
  via `updateTrade`); Dashboard By-Ticker drill-down. (PR #7) Calendar heatmap contrast fix
  later (green-on-green washout → high-contrast neutral text + capped fill alpha, commit `7a40bd5`).
- **JF-24 — Wheel-tagging.** Per-cycle wheels + auto-detect-then-confirm/adjust. Backend:
  `Trade.wheelId` + migration `0002_wheel_id.sql` (applied) + `computeWheels()` in compute.ts
  (auto-splits cycles, honors overrides; `WHEEL_EXCLUDED` sentinel; reconciles to the penny).
  UI: Wheels page (suggested→Confirm, exclude/split/move) + trade-drawer Wheel section. (PR #10)
- **JF-25 — Full research-grounded UI overhaul** (3 phases). Foundation:
  `docs/ux-redesign-principles.md` (from a deep-research pass). New shared primitives in
  `src/components/ui.tsx`: **`Delta`** (colorblind-safe gain/loss = sign+arrow, never color
  alone) + `deltaDir`; upgraded **`Kpi`** (`size`, `delta`, drill-down `to`, `icon`); rebuilt
  **`EmptyState`** (icon+copy+CTA). Nav regrouped (Overview/Positions/Research/Review/Data).
  Inverted-pyramid Dashboard. Trades/Radar tables → stacked cards below `md` (no mobile
  overflow). App-wide `.btn` focus ring. (PR #12)
- **JF-26 — Dashboard timeframe scopes the whole page.** The timeframe selector now re-scopes
  flow cards + charts + By-Ticker to the window; snapshot cards (Mark-to-Market, Capital
  Deployed) stay "· current"; Alpha stays trailing-12mo; graceful empty-window states. (PR #13)
- **JF-27 — Multi-strategy foundation (per-strategy P&L + multi-leg spreads).** Flywheel is no
  longer Wheel-only. **Model:** `Trade.strategy` (predefined key OR custom bucket; null =
  auto-detect) + `positionId` (groups spread legs into one position) + `optionType` + new leg
  actions `STO/BTO/STC/BTC`; migration `0002`→`0003_strategy.sql` (**applied to remote DB
  2026-06-15** — widens the `action` CHECK + nullable strategy/position_id/option_type cols).
  **Compute (layered on the penny-validated wheel engine, NOT a rewrite):** `src/data/strategies.ts`
  (predefined registry + custom buckets + `resolveStrategy()`); generalized "premium debit" from
  `{BB}`→`{any non-assignment debit}` (provably identical on wheel-only data, so realized still
  reconciles to the penny); wheel cycle/FIFO pairing guarded to wheel-native legs so spreads can't
  pollute it; `computePositions()` (net credit/debit, max profit/loss, width, breakeven for
  verticals + iron condors); `strategyBreakdown()` (per-strategy realized/premium/capital/ROI/share,
  ranked best-first; Σ per-strategy realized === `computePortfolio().realized` to the penny).
  **UI:** new **Strategies** page `/#/strategies` (Combined headline + ranked by-strategy comparison
  + per-position drill-down with leg detail; nav under Overview) + `StrategySection` in the trade
  drawer (auto-detect chip + override to predefined/custom + reset-to-auto, applied to all legs).
  Demo seed seeded with anonymized spreads (PCS/CCS/iron condor + custom "Momentum Calls").
  Verified: build clean, both themes, desktop+mobile (no overflow), reconciliation exact. (PR #14)
  **Follow-up (not yet built):** multi-leg spread *entry form* + **tastytrade then robinhood CSV
  importers** (model already supports both; the import session needs real broker CSV samples).
- **JF-28 — tastytrade CSV importer.** Drag-drop a tastytrade "Activity → Orders" export
  (`parseTastytradeCsv` in `src/data/importXlsx.ts`, auto-detected vs Fidelity via
  `isTastytradeCsv`). Handles the multi-line quoted `Description` (one line per leg) with a
  full-text CSV tokenizer; derives trade date from each leg's expiry − DTE (the file has no date
  column) and the expiry year from the filename; only `Filled` orders; net cr/db attached to the
  direction-matching leg so realized/net/width/max-loss are exact without per-leg fills; open +
  close orders of the same structure grouped into one position (shared `positionId`), strategy
  left null for auto-detect. Suggests a capital base = Σ defined-risk (max loss). Verified
  end-to-end on a real export (two QQQ 0DTE put credit spreads → −$116 / −$190, BE $728.55,
  max-loss $755 — exact). (PR #15) **Robinhood importer is next** (needs a sample RH CSV).

### ✅ Done (JF-36, 2026-08-29): Allocation tracker (by ticker + by sector)

- New `/#/allocation` page (nav: Positions → Allocation). Shows where capital sits
  right now: share value + cash reserved behind open cash-secured puts, per ticker
  and per sector, with weight of allocated total and % of capital base.
- **Share-level data is a NEW, separate layer** so the validated option accounting
  is untouched: `Dataset.stockEvents` (buy/sell/reinvest fills) +
  `Dataset.sectors` (per-ticker overrides). Parser `src/data/importStock.ts` reads
  the SHARE rows of the same Fidelity Accounts History CSV the option parser
  reads (YOU BOUGHT / YOU SOLD / REINVESTMENT); rows tagged ASSIGNED are skipped
  because assignments already live on the option trades (AAssignSTK / CC
  Assigned) and `computeAllocation()` in `src/data/allocation.ts` combines both
  (FIFO lots, avg cost, last price else at-cost). Re-import merges: exact
  duplicate fills are skipped (`planStockMerge`, count-aware like trades).
- Sector map: `src/data/sectors.ts` (GICS 11 + ETF/Fund + Unassigned; ~500
  built-in tickers); user override wins, stored per ticker.
- Backend: migration `supabase/migrations/0004_allocation.sql` adds
  `stock_events` + `ticker_sectors` (RLS: owner-only, same shape as trades).
  Store API: `importStockEvents`, `deleteStockEvent`, `setSector`; `clearAll`
  also clears stock_events; JSON backup/restore carries both new fields.

### ⬜ TODO (in order) — billing is the next milestone
| Linear | Work |
|--------|------|
| **JF-12** | **Stripe: account + define Free/Pro plans + what's gated** ← next |
| JF-13 | Stripe Checkout + Customer Portal |
| JF-14 | Stripe webhook (signature-verified, idempotent) + entitlement gating |
| JF-17 | Business entity + Stripe Tax |
| JF-18 | Final brand name + domain + HTTPS (see §6 for the domain checklist) |
| JF-19 | Monitoring (Sentry) + analytics |
| JF-20 | Launch: live-mode Stripe test + go live |

_Done and removed from TODO: JF-11, JF-15, JF-16, JF-22, JF-23, JF-24, JF-25, JF-26, JF-27._

**Multi-strategy follow-ups (newly opened by JF-27, not yet ticketed):** (a) multi-leg spread
**entry form** so spreads can be logged in-app; (b) **tastytrade → robinhood CSV importers**
(user priority: tastytrade #1, robinhood #2). The data model already supports both; the importer
session needs a real tastytrade transaction-history CSV export to build against.

**NEXT STEP: JF-12 (Stripe planning).** Hosting (Vercel) + auth (public) are done, so Phase 3
billing is unblocked. Stripe was "unparked" 2026-06-14 (tracked, not started). The user's
preferred kickoff: design the Free vs Pro tiers + what's gated BEFORE writing code. JF-12 =
create the Stripe account,
define Free vs Pro tiers, and decide exactly what's gated.

---

## 5. Linear (the live task board)

- **Project:** FlywheelTrades — https://linear.app/parakaleomed/project/flywheeltrades-a8b3d3a0b2a3
  (project id `a8b3d3a0b2a3`).
- **Team:** "Josiah", key **JF** (issues JF-5..JF-20). It's a solo workspace — one team,
  one project per initiative (FlywheelTrades; ParakaleoMMC may get its own project later).
- **No Linear MCP tool is installed** on the dev machine. Drive Linear via the GraphQL
  API at `https://api.linear.app/graphql` using the personal API key in `.linear-token`
  (gitignored). Helper script: `tools/linear_setup.py` (⚠️ re-running it DUPLICATES
  issues — edit, don't blindly re-run).
- **When a phase ships, flip its JF issue to Done** (`issueUpdate`, Done state id
  `4eab6467-1ff6-44d7-ac18-02e625dc7db0`).
- **GitHub↔Linear integration IS enabled** (`github` in workspace integrations).
  It links via **branch names / pull requests** containing an issue ID — e.g. a branch
  named `jf-7-auth-ui` or a PR with "JF-7" in the title/description, and keywords like
  "Fixes JF-7" auto-close on merge. **Direct pushes to `main` do NOT create links**
  (no PR event to hook onto). To get auto-linking, use a feature-branch + PR per issue.

**Working convention (decided 2026-06-05):** branch + PR per issue for *substantial*
work (auth, billing, webhook, etc.) — branch named like `jf-7-auth-ui`, PR with the
issue ID so Linear auto-links and can auto-close on merge. *Small/mechanical* changes
go straight to `main`. For PR-flow issues, set the JF issue to "In Progress" when work
starts and let PR-merge (or a manual `issueUpdate`) move it to Done.

---

## 6. Known problems / caveats / open threads

- **Cloud read/write is NOT yet runtime-tested.** The dual-mode layer compiles and RLS
  is verified at the DB level, but no login UI exists yet to create a session — so the
  cloud insert/update/delete paths have never actually run. First real test is JF-10.
- **Google sign-in is DONE** (JF-8, 2026-06-10). Google Cloud OAuth client + Supabase
  Google provider enabled + redirect URLs whitelisted. Current config:
  - Google Cloud OAuth client (project "Flywheel", consent screen **Published / In
    production** as of 2026-06-13 — ANYONE can sign in with Google, not just test users).
    - Authorized JS origins: `http://localhost:5173`, `https://josiahfalde.github.io`
    - Authorized redirect URI: `https://wdzdtnrmdxgyoxuaqpbp.supabase.co/auth/v1/callback`
  - Supabase → Auth → URL Configuration (updated 2026-06-12 for Vercel): Site URL
    `https://options-website-sandy.vercel.app`; redirect allow-list includes
    `https://options-website-sandy.vercel.app/**` (plus the retained
    `http://localhost:5173/**` and the legacy github.io entries). Google OAuth client
    JS origins now also include `https://options-website-sandy.vercel.app`. **The Site
    URL is the post-auth fallback — pointing it at github.io was what bounced a Vercel
    login back to github.io until it was switched.**
- **DOMAIN CHECKLIST (JF-18)** — when a custom domain (e.g. `flywheel.app`) is purchased,
  these must ALL be updated or Google login + redirects break. Order matters:
  1. **Hosting:** point the domain at the host (GitHub Pages: add a `CNAME` file + DNS;
     Vercel after JF-11: add the domain in the Vercel dashboard + its DNS records). Enable HTTPS.
  2. **Google Cloud → Credentials → the OAuth client:** add the new origin to
     *Authorized JavaScript origins* (e.g. `https://flywheel.app`). The redirect URI stays
     the Supabase `…/auth/v1/callback` — do NOT change it.
  3. **Google Cloud → OAuth consent screen:** already **Published** (done 2026-06-13) —
     nothing to do here unless Google later requires re-verification for a new domain.
  4. **Supabase → Auth → URL Configuration:** change Site URL to `https://flywheel.app/`
     and add `https://flywheel.app/**` to the redirect allow-list.
  5. **App:** if NOT using HashRouter at a subpath anymore (root domain), the relative
     `base: "./"` still works; just confirm `redirectTo` resolves to the new origin.
- **Hosting blocker:** billing (Phase 3) cannot ship on GitHub Pages. Move to Vercel
  (JF-11) before JF-14.
- **Stripe webhook is the trickiest piece** (JF-14): must be signature-verified and
  idempotent (handle replays/out-of-order events), and writes subscription state to
  `profiles` via the service_role key (bypassing RLS) from a serverless function.
- **Supabase free tier auto-pauses** after 7 days idle; unpausing is dashboard-only.
  Production needs the $25/mo Pro tier so it never sleeps.
- **service_role key** was printed once into a chat transcript on 2026-06-05 — rotate in
  the Supabase dashboard if you want to be clean (Settings → API).
- **CLI auth quirk:** interactive `supabase login` does NOT persist to non-TTY shells on
  this machine. Always auth via `SUPABASE_ACCESS_TOKEN=$(cat .supabase-token) supabase ...`.
- **Bundle size warning** on build (xlsx + recharts) is pre-existing and cosmetic.

---

## 7. Credential files (all gitignored — must be recreated per machine)

| File | Holds | Secret? | How to recreate |
|------|-------|---------|-----------------|
| `.env.local` | `VITE_SUPABASE_URL` + anon key | **No** (public) | `cp .env.example .env.local` |
| `.supabase-token` | Supabase CLI personal access token | Yes | Generate at supabase.com → Account → Access Tokens |
| `.supabase-db-password` | Postgres password | Yes | Set when project created; reset in dashboard if lost |
| `.supabase-service-role.env` | `SUPABASE_SERVICE_ROLE_KEY` (server only) | **Yes** | Supabase dashboard → Settings → API |
| `.linear-token` | Linear personal API key (`lin_api_...`) | Yes | Linear → Settings → Security & access → Personal API keys |

The anon key + URL are public by design (they ship in the client bundle; RLS is what
protects data), which is why `.env.example` can safely hold them.

---

## 8. Related context

- Personal trade-logging system this grew from: `Options Trading.xlsx` + the
  `optionstrade` Claude skill (Wheel strategy: cash-secured puts / covered calls).
- Anonymized demo data committed at `src/data/seed.json` (F/T/PLTR/BAC/NIO, $10k).
  Real workbook data stays local — import via the Data page or
  `npm run export-workbook` → gitignored `private/seed.real.json`.
