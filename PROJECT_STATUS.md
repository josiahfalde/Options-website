# FlywheelTrades — Project Status & Continuity

> **Purpose of this file:** the portable source of truth for this project. It lives
> in the repo (not in any one machine's local notes) so that on a fresh machine you
> can clone, read this, and pick up exactly where work left off. **If you are a
> Claude Code session resuming this project: read this file top to bottom first,
> then open the Linear project for the live task board.**
>
> _Last updated: 2026-06-05 (end of Phase 1)._

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
- **Hosting:** currently GitHub Pages (static). **Must move to Vercel/Cloudflare before
  billing** — Stripe webhooks + OAuth redirects need serverless functions, which Pages can't host.
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

### ✅ Done (Phase 1)
- **Supabase backend live & verified.** Schema + RLS applied; verified anonymous REST
  reads return `[]` (no cross-user leak). (Linear JF-5)
- **Dual-mode data layer built & committed.** Demo/cloud adapter, builds + typechecks
  clean. (Linear JF-6, commit `746eaa8`)

### ⬜ TODO (in order)
| Linear | Work |
|--------|------|
| **JF-7**  | Auth UI: signup/login/reset forms |
| JF-8  | Google sign-in (needs Google OAuth creds — see §6 problems) |
| JF-9  | Route protection + account menu + "viewing demo — sign in to save" banner + account settings page |
| JF-10 | **End-to-end cloud test** (first real runtime test: signup → add trade → confirm row in Postgres → reload → persists; verify 2 users can't see each other's data) |
| JF-11 | Migrate hosting to Vercel (serverless for webhook/OAuth) |
| JF-12 | Stripe: account + define Free/Pro plans + what's gated |
| JF-13 | Stripe Checkout + Customer Portal |
| JF-14 | Stripe webhook (signature-verified, idempotent) + entitlement gating |
| JF-15 | Not-financial-advice disclaimer (high priority for a finance app) |
| JF-16 | Terms of Service + Privacy Policy |
| JF-17 | Business entity + Stripe Tax |
| JF-18 | Final brand name + domain + HTTPS |
| JF-19 | Monitoring (Sentry) + analytics |
| JF-20 | Launch: live-mode Stripe test + go live |

**NEXT STEP: JF-7 (Auth UI).** It unlocks the first real cloud runtime test (JF-10).

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

---

## 6. Known problems / caveats / open threads

- **Cloud read/write is NOT yet runtime-tested.** The dual-mode layer compiles and RLS
  is verified at the DB level, but no login UI exists yet to create a session — so the
  cloud insert/update/delete paths have never actually run. First real test is JF-10.
- **Google sign-in needs user action:** create a Google Cloud OAuth client (ID+secret)
  and paste into Supabase dashboard → Authentication → Providers → Google, plus set the
  authorized redirect URLs. Build/test the email path first.
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
