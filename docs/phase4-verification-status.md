# Phase 4 verification status

This is an interim report, not a completion certificate. Phase 5 is blocked until Phase 4 implementation and verification are complete.

## Baseline test count

The previously reported **13 tests** were **12 financial tests and one homepage route-match test**. The four classification cases each count as a separate test.

| # | Rule verified | Expected result |
|---|---|---|
| 1–4 | Transfers, refunds, loans and credit-card payments excluded from regular income/spending | ₦500,000 classified inflow contributes zero income; ordinary expense remains ₦12,500 |
| 5 | Completed, pending, cleared and unverified states separated | Income 1,000; spending 200; recorded net 800; pending 50; cleared 300; one unverified exclusion |
| 6 | Currency isolation | NGN spending 200; USD and missing currency excluded |
| 7 | Date validity | Future and impossible dates excluded; leap day eligible |
| 8 | Duplicate/ambiguous review flags | Only unflagged spending of 100 included |
| 9 | Decimal accumulation | 0.1 + 0.2 = 0.3 |
| 10 | Currency precision | KWD 1.234 + 2.345 = 3.579 |
| 11 | Average coverage | First/current months excluded, zero month included; income 500, spending 100 |
| 12 | Missing history | Average is null, not invented |
| 13 | Homepage routing | Homepage matches a content page |

The later baseline contained **29 passing selected tests**: 12 financial, 15 historical/forecast, one simulator interaction and one route-match test. A route-match test does not prove financial functionality or authentication.

Latest main-project selected run: **33 passed, 0 failed** across five test files, including four realistic synthetic arithmetic checks. These are unit/component tests, not database-backed synthetic-account end-to-end tests. The latest preview check reports build OK.
Additional period/runway checks bring the latest selected run to **39 passed, 0 failed** across six files: annual transportation spending 180,000; quarterly income 1,350,000/spending 870,000/net 480,000; missing year-on-year data yields no invented percentage; KWD precision, zero-balance runway and currency isolation pass. Real saved-record verification is deferred at the user's request; implementation must continue without production seeding.

## Implemented before continuation

- Shared transaction eligibility and currency-specific arithmetic used by dashboard and assistant.
- Actual recorded cash-flow labels distinct from confirmed account balance.
- Historical weekly/monthly/quarterly/annual/custom filters; previous equal-duration and year-on-year comparisons.
- Category comparisons, transaction drill-down, chart summaries and downloadable CSV.
- Historical-average forecasting and local, ephemeral what-if inputs, with insufficient-history safeguards.
- Account-scoped saved AI conversations and voice transcription.
- Existing document extraction, editable draft review, private source documents and import path.

## Outstanding implementation/verification

- Persisted confirmed balances and scenarios with server-side calculations.
- Savings/budget scenario changes and dedicated affordability assessment.
- User-owned saved goals and contribution/progress/completion calculations.
- Evidence-backed insights and expanded trusted assistant aggregates.
- Scanner idempotency, duplicate protection and currency/classification review.
- Full database, account-isolation and AI-question end-to-end verification.

## Synthetic numerical fixture

Fixtures are confined to the test runner. They are not real authentication accounts, database rows, or substitutes for database-backed end-to-end verification.

The synthetic NGN household has April initial income of 300,000; May–October monthly income of 450,000; monthly rent 150,000, food 90,000 (October 120,000), transport 30,000 and utilities 20,000. Additional transfer/refund/loan/card-payment, pending/cleared/unverified, flagged, foreign-currency and future records exercise exclusions.

Expected reconciliation:
- Lifetime completed regular income: 3,000,000; spending: 1,770,000; recorded net: 1,230,000.
- October income: 450,000; spending: 320,000; net: 130,000.
- Five complete months averaged: May–September; income 450,000; spending 290,000.
- Separately supplied confirmed balance: 1,200,000 (not the 1,230,000 recorded net).
- Income-loss scenario plus 500,000 purchase: starting balance 700,000, deficit 290,000/month, estimated runway 2.4 months; six-month projected shortfall 1,040,000.

## Isolation blocker

The current project and the newly created Phase 4 draft both use the project's live database. No synthetic accounts or sample records may be inserted there. A genuinely separate non-production backend is required before the requested stored-record/account-isolation tests can run. Pure-engine fixtures test arithmetic only.

## Completion gate

Do not mark Phase 4 complete until all original specification items are implemented, connected to authenticated backend/database paths, and tested against isolated saved synthetic records. The final report must distinguish completed/pending features, passed/failed checks, numeric reconciliation, integration status and external blockers.