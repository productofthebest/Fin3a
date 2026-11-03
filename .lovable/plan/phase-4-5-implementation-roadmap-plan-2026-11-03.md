# Phase 4 & 5 Implementation Roadmap — Plan

## Current state (verified against the codebase)

Phase 4 is largely implemented already: forecasting and what-if scenarios (`forecast-simulator.tsx`, `planning-calculations.ts`), money runway with explainable assumptions, affordability analysis, savings goals with progress, savings projections, evidence-backed insights, and assistant aggregates that answer runway/affordability/goal questions from real records. Remaining Phase 4 work is mostly verification hardening, not new features.

Phase 5 (proactive intelligence) is not built: no alerts, no unusual-transaction detection, no monthly reviews, no health overview, no upcoming-expense reminders, no notifications table.

## Guiding rules (from the brief + existing project rules)

- All financial figures come from deterministic backend calculations; OpenAI only explains calculated results, never invents numbers.
- Actual vs estimated vs simulated figures are always labelled distinctly.
- Simulations never write to transactions, balances, or ledger tables.
- Everything user-scoped with RLS; no cross-user exposure; no new external AI API for deterministic math.
- In-app notifications only (no push/SMS) — consistent with earlier reminders decision.
- No synthetic rows in the live database; detectors tested as pure functions with test-runner-only fixtures.
- Existing pages, navigation, design system, and features preserved.

## Increment 1 — Phase 4 completion hardening

1. Weekly projection option alongside monthly in the forecast simulator (same disclosed-average engine).
2. Recurring income/expense identification surfaced in the forecast assumptions (already detected internally; make it visible).
3. Close the known duplicate-review import bug (import rechecks candidates the user marked separate) — fix in the import RPC, add regression test.
4. Extend pure-function tests: missing/incomplete histories, irregular income, currency isolation, zero-balance runway (partially done; fill gaps).

## Increment 2 — Alerts engine (Phase 5.1, 5.2, 5.5)

1. New migration `0027_proactive_intelligence.sql`: `financial_alerts` table (kind, title, body, evidence JSONB, currency, created_at, read_at, dismissed_at; user-scoped RLS, grants) and `alert_preferences` columns on `user_settings` (enable/disable per kind, spending-increase threshold).
2. Pure deterministic detectors in `src/lib/proactive-intelligence.ts`:
   - Spending increase vs trailing average (category + total, configurable threshold, default 30%).
   - Unusual transactions (amount beyond a multiple of the user's typical category spend; flagged as "worth a look", never labelled fraud).
   - Upcoming recurring bills due within N days with estimated monthly obligation total.
3. Server function generates alerts on read (idempotent: one alert per kind+period+evidence hash), never on a schedule that could duplicate.
4. Alerts UI: bell indicator in the app shell with unread count + an Alerts section on the Insights page; each alert shows its evidence and reasoning.

## Increment 3 — Monthly reviews & health overview (Phase 5.3, 5.6)

1. `monthly_reviews` table: deterministic snapshot per user per completed UTC month (income, spending, category breakdown, change vs previous month, recurring total, runway, savings progress) — generated on first view, stored, immutable.
2. Monthly review page section (on Analysis or its own route) with drill-down to underlying records.
3. Financial health overview on Insights: transparent labelled indicators (income stability, spending trend, cash flow, runway, goal progress, obligations) — each with its explanation, never an unexplained single score.

## Increment 4 — Recommendations & assistant integration (Phase 5.4, 5.7)

1. Evidence-based recommendations generated from the same detectors (each cites its evidence and reasoning; no generic advice).
2. Assistant context extended with active alerts, latest monthly review, and health indicators (aggregate figures only, same privacy rules as today) so users can ask "why did I get this alert?" and get a calculation-backed explanation.
3. The assistant never executes payments/transfers — enforced in the system prompt and by the absence of any such tool.

## Increment 5 — Verification & report

1. Pure-function tests for every detector, review generator, and health indicator (currencies, missing data, irregular income, cross-user isolation via RLS policy review).
2. Signed-in browser verification of each new screen on desktop/tablet/phone.
3. Full regression suite + build after each increment.
4. Update roadmap.md, docs/master-checklist.md, AGENTS.md, and memory; final report listing what is verified vs outstanding.

## Assumptions (flagging for awareness, not blocking)

- Alerts and reviews are generated lazily on page view (no cron) — no background jobs, no cost, no duplicates.
- Monthly reviews are deterministic; AI explanation happens only when the user asks the assistant (controls OpenAI cost).
- Alert thresholds have sensible defaults (30% spending increase, 3× typical category amount) and are user-adjustable.
- The brief's "Phase 5" (proactive intelligence) maps to the proactive items here; the older Phase 5 launch/QA items in roadmap.md remain separately tracked.

## Out of scope (per the brief)

- Future items: user-to-user bills expansion, QR expansion, multi-bank statement imports, automated categorisation across bank formats.
- No bill payment processing (still blocked on Flutterwave), no push/SMS, no production data changes.
