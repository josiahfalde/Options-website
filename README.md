# Flywheel — Options Premium Analytics

> Your broker shows trades. **Flywheel** shows momentum.

A Wheel-strategy options analytics dashboard. Inspired by premiuminsights.ai, but
built around the way *I actually trade* — selling cash-secured puts, getting
assigned, selling covered calls, and compounding premium. Named for the mechanical
flywheel: collected premium is rotational energy that smooths out and compounds.

Working name `Flywheel` lives in one place (`src/brand.ts`) — rename freely.

## What it does

- **Premium Dashboard** — realized P&L, win rate, annualized yield-on-capital, and
  alpha vs SPY, with a cumulative-premium curve and monthly P&L. Timeframe filters
  (14d → ALL).
- **Wheel Campaigns** — every ticker's full cycle: puts assigned, calls sold,
  premium-adjusted cost basis, shares held, capital at risk, and the cushion
  premium has carved below your assignment price.
- **Trades** — sortable, filterable ledger of every credit and debit.
- **Yield Screener** — price a CSP before you sell it: annualized yield on
  collateral, breakeven, downside cushion, and a go/no-go against your Wheel rules
  (≥20% annualized, 21–45 DTE, earnings-clear).
- **Earnings & Assignment Radar** — open contracts ranked by time risk; assigned
  shares tracked against cost basis with underwater warnings.
- **Insights** — CSP vs CC win rates, hold-time edge, outcome mix, best/worst
  closes, and expectancy.

The analytics engine was validated to the penny against the real
`Options Trading.xlsx` (realized and mark-to-market P&L both matched exactly).
The data shipped in this repo is an **anonymized demo** — real trades stay local.

## Privacy / architecture

100% client-side. Your data is parsed in the browser and persisted to
`localStorage` — nothing is uploaded. No broker login (CSV/workbook import only,
like Premium Insights). The data layer (`src/data/store.tsx`) is the single seam
where a future Supabase backend + user accounts will slot in.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build to dist/
```

## Import your data (stays local)

- **Drag-drop** `Options Trading.xlsx` on the Import page — parsed in-browser,
  stored only in `localStorage`. Never uploaded, never committed.
- Or bridge via the export script (writes to the gitignored `private/` folder):
  ```bash
  npm run export-workbook    # -> private/seed.real.json
  ```
  then drag that `.json` onto the Import page.
- Fidelity CSV import and manual quick-entry are also on the Import page.

The committed `src/data/seed.json` is anonymized demo data
(`python tools/make_sample.py`).

## Deploy

Pushing to `main` auto-builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. Enable it once under **Settings → Pages → Source:
GitHub Actions**.

## Roadmap

- User accounts + cloud sync (Supabase — Postgres + Auth)
- Live prices & automatic SPY benchmark refresh
- More broker CSV formats (Schwab, IBKR, Robinhood)
- Pre-trade thesis + execution grading (behavioral edge)

## Stack

Vite · React · TypeScript · Tailwind · Recharts · SheetJS
