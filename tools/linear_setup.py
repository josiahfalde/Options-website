"""One-shot: create the FlywheelTrades Linear project + all issues.
Reads the API key from .linear-token (gitignored). Idempotent-ish: re-running
creates duplicate issues, so run once. Safe to re-run project creation check.
"""
import json, os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open(os.path.join(ROOT, ".linear-token")).read().strip()
TEAM = "e1097a06-3882-4ccf-bfb4-c0265ff04c1f"
STATE = {
    "todo": "f8425f93-92b3-42d8-8714-5f51d5c071c8",
    "done": "4eab6467-1ff6-44d7-ac18-02e625dc7db0",
    "inprogress": "84ba2d0d-8038-4f5c-9b88-75f3e38ae309",
    "backlog": "89808d11-8a75-45db-9e04-50a7e708d8b4",
}
API = "https://api.linear.app/graphql"


def gql(query, variables):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        API, data=body,
        headers={"Authorization": KEY, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()); sys.exit(1)
    if out.get("errors"):
        print("GQL ERROR:", json.dumps(out["errors"], indent=2)); sys.exit(1)
    return out["data"]


PROJECT_CONTENT = """# FlywheelTrades

Paid, multi-user, Wheel-strategy options-premium analytics SaaS. Extends the personal Options Trading.xlsx Wheel system into a premiuminsights.ai-style dashboard. "Your broker shows trades; Flywheel shows momentum."

## Goal
A fully working website with a paid plan where users sign up, import/log options trades, and track premium income, campaigns, and performance vs SPY.

## Stack
- Vite + React + TS + Tailwind + Recharts + SheetJS
- Supabase (Postgres + Auth + RLS), project ref wdzdtnrmdxgyoxuaqpbp, us-east-1 (separate from ParakaleoMMC)
- Repo: github.com/josiahfalde/Options-website
- Hosting: GitHub Pages now -> must move to Vercel before billing (serverless for Stripe webhook + OAuth)
- Payments: Stripe (planned)

## Architecture
Dual-mode data layer: DEMO (logged-out, ephemeral seed) vs CLOUD (logged-in, Supabase). Same useStore() API so pages don't change. Seam files: src/data/store.tsx, src/data/remote.ts, src/lib/supabase.ts, src/auth/AuthProvider.tsx. Analytics engine compute.ts validated to the penny vs the workbook. profiles table pre-stubbed with stripe_customer_id/plan/subscription_status/current_period_end.

## Phases
0 Brand+hosting | 1 Backend+data layer (DONE) | 2 Auth | 3 Stripe billing | 4 Legal/business | 5 Launch
"""

# --- create project --------------------------------------------------------
proj = gql(
    """mutation($name:String!,$desc:String!,$content:String!,$team:String!){
        projectCreate(input:{name:$name,description:$desc,content:$content,teamIds:[$team]}){
            success project{id name url}}}""",
    {"name": "FlywheelTrades",
     "desc": "Paid multi-user Wheel-strategy options analytics SaaS (Flywheel).",
     "content": PROJECT_CONTENT, "team": TEAM},
)["projectCreate"]
PID = proj["project"]["id"]
print("PROJECT:", proj["project"]["url"])

# --- issues ----------------------------------------------------------------
# (title, state, priority[0-4], description)
ISSUES = [
    ("Phase 1 — Supabase backend: schema + RLS", "done", 1,
     "DONE & verified. Tables profiles/trades/prices/user_settings, all RLS-locked to auth.uid(); auto-creates profile+settings on signup. Migration supabase/migrations/0001_init.sql applied via db push. RLS verified: anon REST read returns []. Project ref wdzdtnrmdxgyoxuaqpbp."),
    ("Phase 1 — Dual-mode data layer (demo/cloud adapter)", "done", 1,
     "DONE & committed (746eaa8). DEMO mode (logged-out, ephemeral seed) vs CLOUD mode (logged-in, Supabase, optimistic writes w/ revert). Same useStore() API, zero page changes. Files: src/lib/supabase.ts, src/auth/AuthProvider.tsx, src/data/remote.ts, src/data/store.tsx. Builds + typechecks clean. NOTE: cloud read/write not yet runtime-tested (needs login UI)."),
    ("Phase 2 — Auth UI: signup / login / reset", "todo", 2,
     "Build login + signup forms (email/password) on the AuthProvider methods. Password reset flow. Loading/error states. Forms styled to match the app."),
    ("Phase 2 — Google sign-in (OAuth)", "todo", 3,
     "Wire 'Sign in with Google' button. REQUIRES USER ACTION: create a Google Cloud OAuth client (ID+secret) and paste into Supabase dashboard -> Authentication -> Providers -> Google, plus set authorized redirect URLs. Build/test email path first."),
    ("Phase 2 — Route protection + account menu + demo banner", "todo", 2,
     "Gate data pages behind a session; redirect logged-out users appropriately. Account menu with logout. 'Viewing demo - sign in to save' banner in demo mode. Account settings page (email, delete account, export my data)."),
    ("Phase 2 — End-to-end cloud test", "todo", 2,
     "First real runtime test of CLOUD mode: signup -> add a trade -> confirm the row lands in Postgres -> reload -> confirm it persists. Also verify two different users cannot see each other's data (RLS at runtime). Then import the real workbook and dogfood."),
    ("Phase 0/5 — Migrate hosting to Vercel", "todo", 2,
     "GitHub Pages can't host the SaaS (no serverless). Move to Vercel (or Cloudflare Pages): build config, env vars (VITE_SUPABASE_URL/ANON_KEY + server-only SUPABASE_SERVICE_ROLE_KEY + Stripe secrets), and serverless functions dir for the Stripe webhook + OAuth redirects. Blocks billing."),
    ("Phase 3 — Stripe: account + plans", "todo", 2,
     "Create Stripe account + business details. Define Free vs Pro plans and decide exactly what's gated (trade count? cloud sync? screener/radar?). Create products/prices in Stripe."),
    ("Phase 3 — Stripe Checkout + Customer Portal", "todo", 2,
     "Stripe-hosted Checkout for subscribe and Customer Portal for cancel/update card. We don't build billing UI ourselves."),
    ("Phase 3 — Stripe webhook + entitlement gating", "todo", 1,
     "TRICKIEST PIECE. Serverless webhook (signature-verified, idempotent) listens for Stripe events and flips subscription_status/plan/current_period_end on the profiles row (via service_role, bypassing RLS). App reads the flag to lock/unlock features. Must handle replays + out-of-order events."),
    ("Phase 4 — Not-financial-advice disclaimer", "todo", 1,
     "Non-negotiable for a finance app. Prominent, persistent disclaimer that Flywheel is analytics, not financial/investment advice."),
    ("Phase 4 — Terms of Service + Privacy Policy", "todo", 2,
     "Storing users' personal financial data on a server = real obligation. Generate ToS + Privacy Policy; get legal eyes once revenue is real."),
    ("Phase 4 — Business entity + sales tax", "todo", 3,
     "Entity decision (sole-prop to start is fine; LLC matters more with outside customers/liability). Enable Stripe Tax for sales tax/VAT on digital subscriptions."),
    ("Phase 0 — Final brand name + domain + HTTPS", "todo", 2,
     "Lock the final brand name (currently 'Flywheel' placeholder in src/brand.ts). Buy domain (~$12/yr). Point at Vercel/Cloudflare with HTTPS. Needed before Stripe/legal registration."),
    ("Phase 5 — Monitoring + analytics", "todo", 3,
     "Sentry (error monitoring) so silent webhook failures surface. Privacy-respecting product analytics."),
    ("Phase 5 — Launch: live-mode test + go live", "todo", 2,
     "Full E2E once more in Stripe LIVE mode with a real card you refund (signup -> subscribe -> sync -> cancel -> access revoked). Then announce/invite."),
]

created = []
for title, st, prio, desc in ISSUES:
    d = gql(
        """mutation($t:String!,$d:String!,$team:String!,$proj:String!,$state:String!,$p:Int!){
            issueCreate(input:{title:$t,description:$d,teamId:$team,projectId:$proj,stateId:$state,priority:$p}){
                success issue{identifier url}}}""",
        {"t": title, "d": desc, "team": TEAM, "proj": PID, "state": STATE[st], "p": prio},
    )["issueCreate"]
    iden = d["issue"]["identifier"]
    created.append((iden, st, title))
    print(f"  {iden}  [{st:10}]  {title}")

print(f"\nDONE: project + {len(created)} issues created.")
print("URL:", proj["project"]["url"])
