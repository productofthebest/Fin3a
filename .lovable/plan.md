# Fin3a Phase 4 — Advanced Financial Intelligence

## Goal
Extend the existing dashboard, saved AI conversations and document scanner with reliable financial intelligence. Preserve the approved dark design, navigation, email/Google/phone authentication and existing functionality. Use the existing OpenAI integration; add no paid AI provider.

## Delivery approach
Build and verify one step at a time. Accuracy foundations come first: the current assistant snapshot sums income and expenses without applying the newer financial classifications, so it must not power forecasts unchanged. Existing scanner functionality is retained and improved, not rebuilt. No production demo transactions will be added.

### 1. Shared financial calculations
- Establish one tested calculation layer for dashboard summaries, historical analysis, assistant answers and projections.
- Respect transaction classification, status, selected currency and date boundaries. Keep transfers, loans, refunds and credit-card payments distinct from ordinary income and spending.
- Separate recorded cash flow from confirmed available balance and net worth. Do not infer a bank balance from incomplete transaction history.
- Provide explicit missing-data states, calculation inputs and assumptions; exclude partial periods from historical averages unless deliberately selected.

### 2. Historical analysis
- Add weekly, monthly, quarterly, annual and custom date ranges, previous-period and year-on-year comparisons, and category comparisons.
- Provide interactive charts, summaries and drill-down to the underlying transactions.
- Add downloadable historical reports with their currency, period and actual/estimated labels.

### 3. Forecasts and what-if simulations
- Forecast spending and cash flow from recorded history, with the history window and assumptions visible.
- Require a user-confirmed starting balance for balance/runway forecasts when a reliable balance is unavailable.
- Support changes to expenses, income loss/additions, major purchases, savings contributions and budgets.
- Compare baseline and simulated outcomes for cash flow, balance, savings and runway. Handle zero spending, negative cash flow and insufficient history explicitly.

### 4. Affordability and financial goals
- Assess purchases using starting balance, historical income/spending and existing commitments without counting commitments twice.
- Explain affordable, potentially risky or unaffordable outcomes as estimates, never guarantees; return insufficient information when inputs are missing.
- Store user-owned goals with target amount/date, contribution frequency and recorded progress. Show remaining amount, suggested contribution and estimated completion where calculable.

### 5. Explainable insights
- Add a dedicated insights view covering spending increases, recurring expenses, potential duplicates, income changes, savings opportunities and cash-flow pressure.
- Each insight includes supporting figures and periods, why it matters and an action to consider. Treat duplicate matches as candidates, not automatic deletions.

### 6. Extend the existing AI assistant
- Supply trusted calculations and relevant period/category aggregates from the shared calculation layer.
- Keep saved account-scoped conversation context and voice input.
- Support the brief’s financial questions, including transportation totals, affordability, runway, rising expenses and goal contributions.
- Ask for missing inputs rather than inventing figures. Preserve the current privacy boundary: do not send raw statement files, notes or merchant descriptions to the assistant.

### 7. Improve document understanding
- Verify statements, receipts, POS/payment receipts, teller slips and cheques using the existing scanner.
- Improve document-type recognition, extraction review and duplicate-import protection while preserving the original document.
- Keep extracted records out of the ledger until reviewed and approved; distinguish document imports from manual records.

## Technical approach
- Retain TanStack Start, existing authenticated pages, bearer-verified server boundaries and the user’s server-held OpenAI key.
- Use deterministic, client-safe calculation modules with server-side user-scoped retrieval; AI explains results rather than becoming the arithmetic authority.
- Add only necessary additive schema changes. New user-owned data requires user-scoped access policies and grants; no profiles table or unverified account linking.
- Keep chosen currency consistent across calculations; do not silently combine currencies or introduce exchange-rate conversion.
- Establish date/timezone behavior from available settings and expose any missing timezone assumption before comparisons.
- Record structural decisions in AGENTS.md and maintain the existing roadmap.

## Verification and completion
- Add concrete tests for classification/status handling, date boundaries, comparisons, forecasts, scenario math, affordability, goal calculations and duplicate import behavior.
- Verify real authenticated flows against saved records, reload restoration and isolation between accounts where authorized test accounts are available.
- Exercise all example AI questions and inspect actual responses through the existing provider.
- Test document extraction/review/import/duplicate detection and desktop/mobile controls.
- Report completed steps, test evidence, outstanding issues and external configuration. Real SMS delivery remains separately unverified until a user-owned number completes verification; it will not be represented as completed by Phase 4 testing.

## First implementation milestone
Deliver Step 1 only first: shared accurate calculations, regression tests and adoption by the existing dashboard/assistant, without redesigning either. Continue with the remaining steps after this foundation is verified.