# Deploying Flywheel to Vercel (JF-11)

This is the **hosting migration from GitHub Pages → Vercel**, the prerequisite for
Phase 3 billing (Stripe webhooks + OAuth callbacks need serverless functions that a
static host can't run).

The app needs **no code changes** to run on Vercel: `vite.config.ts` uses
`base: "./"` (relative assets work at any origin) and routing is `HashRouter`
(no server-side rewrite needed). `vercel.json` in the repo root pins the framework,
build command, output dir, a SPA fallback rewrite, and security headers.

---

## Part A — One-time setup (you do this in the Vercel dashboard)

1. **Create / log in to Vercel.** Go to <https://vercel.com> and sign in **with
   GitHub** (so it can see the repo). Free "Hobby" plan is fine.
2. **Import the repo.** Add New… → **Project** → import
   `josiahfalde/Options-website`. Vercel auto-detects Vite and reads `vercel.json`,
   so the build settings are already correct — don't override them.
3. **Add environment variables** (Project → Settings → Environment Variables).
   These are the same public values as `.env.example`, set for **all environments**
   (Production, Preview, Development):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://wdzdtnrmdxgyoxuaqpbp.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon key from `.env.example` (public-safe) |

   > Vite only exposes vars prefixed `VITE_`. The anon key is public by design — RLS
   > is what protects data — so it's safe in the client bundle.
4. **Deploy.** Click Deploy. You'll get a URL like
   `https://options-website-<hash>.vercel.app` (and a stable
   `https://options-website.vercel.app`). Every push to `main` now auto-deploys;
   every PR gets its own preview URL.

## Part B — Make auth work on the Vercel URL (critical — login breaks without it)

The OAuth/redirect code is domain-agnostic (`redirectTo` is computed from
`window.location`), but Supabase and Google only honor **whitelisted** URLs. After
you know the Vercel URL (call it `https://options-website.vercel.app`):

5. **Supabase → Auth → URL Configuration:**
   - Add `https://options-website.vercel.app/**` to the **Redirect URLs** allow-list
     (keep the existing localhost + github.io entries during the transition).
   - Leave **Site URL** as-is for now, or switch it to the Vercel URL once you've
     verified it works. (It becomes the custom domain later in JF-18.)
6. **Google Cloud → APIs & Services → Credentials → the OAuth client:**
   - Under **Authorized JavaScript origins**, add `https://options-website.vercel.app`.
   - **Do NOT change the Authorized redirect URI** — it stays the Supabase
     `https://wdzdtnrmdxgyoxuaqpbp.supabase.co/auth/v1/callback`.
   - Consent screen stays in **Testing** mode (publish it at custom-domain time, JF-18).

## Part C — Verify, then cut over

7. Open the Vercel URL. Check: app loads, light/dark toggle, **email login**, and
   **Continue with Google** (use a whitelisted Google test account). Confirm a logged-in
   trade write still persists (cloud mode).
8. Once Vercel is confirmed good, GitHub Pages becomes the fallback. `npm run deploy`
   still publishes to Pages if ever needed, but the canonical host is now Vercel.

---

## What changes vs GitHub Pages

| | GitHub Pages | Vercel |
|---|---|---|
| URL | `josiahfalde.github.io/Options-website/` | `options-website.vercel.app` (root) |
| Deploy | `npm run deploy` (manual, gh-pages branch) | auto on push to `main`; PR previews |
| Serverless | ❌ none | ✅ `/api/*` functions (enables Stripe webhook, JF-14) |
| Subpath | `/Options-website/` | root `/` |

`base: "./"` + `HashRouter` work in **both**, which is why no code changed.

## Notes / gotchas

- **PR preview URLs** (`*-git-<branch>-*.vercel.app`) are NOT whitelisted in Supabase,
  so Google login won't work on previews unless you add a wildcard. That's expected;
  test auth on the stable production URL.
- The **bundle-size warning** at build time (xlsx + recharts) is pre-existing and
  cosmetic — not a Vercel issue.
- When a **custom domain** is bought (JF-18), repeat Part B for the new origin and
  publish the Google consent screen. See `PROJECT_STATUS.md` §6 domain checklist.
