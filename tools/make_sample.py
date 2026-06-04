#!/usr/bin/env python3
"""
make_sample.py -- generate the ANONYMIZED demo dataset shipped publicly.

This is fake-but-realistic data so the public site has something to show without
exposing anyone's real trades. Real data is imported client-side and never
committed. Run:  python tools/make_sample.py   ->  writes src/data/seed.json
"""
import json, os

# (action, date, premium, status)  for credits
# (action, date, cost, invested)   for debits  (BB cost, AAssignSTK invested)
def credit(action, date, amount, status="Closed"):
    return {"side": "credit", "action": action, "date": date,
            "shares": 100, "amount": amount, "status": status}

def debit(action, date, amount, invested=None):
    return {"side": "debit", "action": action, "date": date, "shares": 100,
            "amount": amount, "invested": invested, "status": ""}

book = {
    # F: assigned early, now holding shares and selling calls (slightly underwater)
    "F": [
        credit("CSP", "2026-01-12", 18.0, "Expired"),
        credit("CSP", "2026-01-28", 22.0, "Assigned"),
        debit("AAssignSTK", "2026-02-03", 11.0, 1100.0),
        credit("CC", "2026-02-10", 34.0, "Closed"),
        debit("BB", "2026-02-24", 11.0),
        credit("CC", "2026-02-26", 30.0, "Expired"),
        credit("CC", "2026-03-09", 28.0, "Closed"),
        debit("BB", "2026-03-20", 9.0),
        credit("CC", "2026-03-24", 26.0, "Closed"),
        debit("BB", "2026-04-02", 8.0),
        credit("CC", "2026-04-14", 24.0, "Expired"),
        credit("CC", "2026-05-05", 27.0, "Closed"),
        debit("BB", "2026-05-19", 10.0),
        credit("CC", "2026-05-29", 25.0, "Open"),
    ],
    # T: clean CSP ladder, never assigned
    "T": [
        credit("CSP", "2026-02-04", 21.0, "Closed"),
        debit("BB", "2026-02-18", 6.0),
        credit("CSP", "2026-02-20", 19.0, "Expired"),
        credit("CSP", "2026-03-06", 23.0, "Closed"),
        debit("BB", "2026-03-19", 5.0),
        credit("CSP", "2026-03-23", 18.0, "Expired"),
        credit("CSP", "2026-04-10", 20.0, "Expired"),
        credit("CSP", "2026-05-01", 22.0, "Closed"),
        debit("BB", "2026-05-15", 4.0),
        credit("CSP", "2026-05-22", 17.0, "Open"),
    ],
    # PLTR: higher-IV name, fatter premiums, one rough buyback
    "PLTR": [
        credit("CSP", "2026-01-20", 62.0, "Closed"),
        debit("BB", "2026-02-02", 28.0),
        credit("CSP", "2026-02-13", 58.0, "Expired"),
        credit("CSP", "2026-03-02", 71.0, "Closed"),
        debit("BB", "2026-03-16", 95.0),   # a loser: bought back for more
        credit("CSP", "2026-04-06", 55.0, "Expired"),
        credit("CSP", "2026-05-11", 64.0, "Open"),
    ],
    # BAC: steady mid-cap CSPs
    "BAC": [
        credit("CSP", "2026-02-17", 28.0, "Expired"),
        credit("CSP", "2026-03-16", 31.0, "Closed"),
        debit("BB", "2026-03-30", 9.0),
        credit("CSP", "2026-04-20", 26.0, "Expired"),
        credit("CSP", "2026-05-18", 24.0, "Open"),
    ],
    # NIO: small, speculative, thin premiums
    "NIO": [
        credit("CSP", "2026-03-10", 12.0, "Expired"),
        credit("CSP", "2026-04-13", 14.0, "Closed"),
        debit("BB", "2026-04-27", 4.0),
        credit("CSP", "2026-05-26", 11.0, "Open"),
    ],
}

last_prices = {"F": 8.80, "T": 22.10, "PLTR": 46.30, "BAC": 41.05, "NIO": 4.85}

trades = []
for ticker, rows in book.items():
    for r in rows:
        trades.append({"ticker": ticker, **r})
trades.sort(key=lambda t: (t["date"], t["ticker"]))

out = {
    "exportedAt": "2026-06-03",
    "capitalBase": 10000.0,
    "lastPrices": last_prices,
    # SPY is public market data, fine to ship
    "spy": {"now": 754.13, "year_ago": 587.46, "year_ago_date": "2025-05-16"},
    "trades": trades,
    "_note": "Anonymized demo data. Import your own workbook on the Data page.",
}

path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "seed.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)
print(f"Wrote {len(trades)} demo trades for {len(book)} tickers -> src/data/seed.json")
