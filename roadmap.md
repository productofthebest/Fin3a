# Fin3a AI — Roadmap

Product: AI-first personal finance platform under Top Floor.
Excluded forever: stablecoins, crypto, wallets, trading, payment processing.

## Phase 1 — Foundation (current)
- [x] Dual phone/email authentication screens, registration, recovery and responsive validation tests
- [ ] Enable Phone in Cloud Auth settings and configure SMS delivery; verify real six-digit OTP sign-in end-to-end (blocked on owner configuration)
- [x] Lovable Cloud connected; email/password + Google + Lovable sign-in enabled
- [x] Schema: user_settings, categories, transactions, recurring_bills (RLS, user-scoped)
- [x] Dark premium design system (reference dashboard image)
- [x] Public landing page + auth page (sign in / sign up)
- [x] Onboarding (currency picker, starter categories)
- [x] Dashboard: cash flow chart, activity summary, net spending, month switcher
- [x] Manual income/expense entry, transaction history
- [x] Categories management
- [x] Recurring bills CRUD
- [ ] Mobile + desktop responsive pass; E2E verification (core flows verified in preview; responsive polish pass pending)

## Phase 2 — Universal Financial Scanner
- [x] Connect document vision extraction directly to the existing OpenAI key; 11 automated checks and signed-in upload/scan/reload verified with a user-uploaded nonfinancial image, then deleted; real financial document accuracy remains unverified
- [ ] Scan/upload documents (statements, receipts, POS slips, teller receipts, cheques, transfers, invoices, bills)
- [ ] Extract dates, amounts, merchants, line items; PDF/CSV/Excel/images
- [ ] OCR, auto-categorization, duplicate detection, review-before-import screen

## Phase 3 — Financial Intelligence
- [ ] Calculation/forecasting engine; runway ("how long will my money last") with explainable assumptions
- [ ] Money states: pending / unverified / cleared / completed
- [ ] Duplicate prevention guarding balances and totals

## Phase 4 — AI Financial Assistant (chat built early: threads, saved history, snapshot-based answers)
- [x] Implemented draft code: dated confirmed balances, saved server-calculated scenarios, savings/budgets, affordability, goals/progress, evidence-backed insights, seven original assistant prompts/aggregates, scanner currency/classification review and idempotent import RPC
- [ ] Isolated synthetic E2E gate: BLOCKED — this draft shares the live backend; no synthetic account or financial rows may be created here
- [x] Staged additive schema changes with RLS/grants and ownership/date validation; no schema changes or synthetic rows applied to live
- [x] In-memory synthetic rule tests and form/pagination regressions; existing signed-in dashboard/analysis and signed-out guard checked without financial writes
- [ ] Verify staged migrations, ownership policies, concurrent/retry scanner imports, saved reload and full seven-question OpenAI answers on an isolated backend
- [ ] Remaining verification: affordability/goals, explainable insights, assistant extensions and scanner hardening against isolated saved records; not Phase 4 complete
- [ ] Complete Phase 4 at the user's November 2 request: integrate remaining forecasts, affordability, goals, insights, assistant context and scanner safeguards; verify before certifying completion
- [x] Review and approve the Phase 4 completion plan; acceptance of the existing ready draft is queued, preserving newer main-app protections; integrated verification waits on acceptance
- [x] Review uploaded Phase 4 brief and agree incremental delivery preserving existing features/design
- [x] Shared calculation foundation adopted by dashboard and assistant: classification/status/currency/date safeguards, recorded cash-flow distinction, disclosed averaging assumptions; 12 finance tests and routing test pass
- [x] Verify signed-in dashboard and live OpenAI balance-clarification answer; preview builds without errors
- [ ] Verify numeric dashboard/assistant reconciliation against nonempty authorized financial records (requesting account has no transactions; no production dummy rows added)
- [ ] Confirm currencies for legacy/imported rows without currency before including them in totals; unknown-currency records currently excluded, manual entries now save chosen currency
- [x] Historical comparisons/reports implemented: period filters, previous-period/YoY, categories, transaction drill-down and CSV export; authenticated date/filter/reload/export/mobile checks passed on the owner's empty account
- [x] Forecasting/simulator implemented: disclosed historical averages, required confirmed starting balance, baseline/scenario estimates and explicit insufficient-history state; arithmetic and input interaction tested
- [ ] Verify historical totals/category drill-down and forecasting end-to-end against nonempty authorized saved records (owner has no records; no production dummy data added)
- [ ] Affordability and saved goals with contribution/progress calculations
- [ ] Explainable insights with evidence and actions
- [ ] Backend-persisted confirmed balances and scenarios; server-calculated estimates
- [ ] Assistant extensions with aggregate-only historical/category/goal context
- [ ] Scanner hardening, duplicate-import safeguards and classification/currency review
- [ ] End-to-end financial verification with authorized real financial data deferred at the user's request; do not seed synthetic records into live accounts
- [x] Add realistic test-runner-only synthetic history and reconcile recorded totals, category/chart totals, averages, confirmed-balance scenario and 1205-row pure calculations; 33 selected tests pass
- [x] Add annual transportation, quarterly totals, missing year-on-year data, KWD projection precision, zero-balance runway and currency-isolation checks; 39 selected tests pass
- [ ] Remaining feature implementation delegated to the separate Phase 4 draft; its saved-data changes require review/acceptance, and its live-connected database must not receive synthetic records
- [ ] Finish and integrate the full Phase 4 draft into the main app when ready; real-data verification remains deferred, not an implementation blocker
- [ ] Detailed test breakdown and final Phase 4 completion report; Phase 5 started at the user's explicit request, without claiming this gate passed
- [ ] Chat over the signed-in user's data; backend math + AI explanation
- [ ] Analysis, runway, affordability, what-if, goals, insights

## Phase 5 — Testing, Launch, Growth
- [x] Start Phase 5 incrementally at the user's explicit request: 65-check baseline, basic security scan, deep scan started; first account-cache/document-validation/deletion fixes; 74 regression checks and signed-in upload rejection/logout/responsive checks passed; this does not certify Phase 4 completion
- [x] Review uploaded Phase 5 security/optimization and performance/QA/deployment specifications; queue after Phase 4 completion gate
- [ ] Backend reliability and financial indexes; consistent error handling and pagination
- [ ] Authentication/security review, user isolation and sensitive endpoint protections
- [ ] Private document security, upload validation, deletion and appropriate audit logging
- [ ] Comprehensive financial validation and mobile/tablet/desktop accessibility/performance checks
- [ ] In-app relevant notifications and user preferences
- [ ] Account/privacy settings, data-copy requests and account deletion without introducing profiles
- [ ] AI/document performance, caching, monitoring and logging review
- [ ] Full end-to-end QA and critical/high-priority remediation
- [ ] Deployment/environment/HTTPS/redirect/provider/storage/backup checks and operational documentation
- [ ] Truthful Phase 5 completion report; do not declare readiness with critical unresolved issues
- [ ] Reports, notifications, CSV export, data deletion, QA, beta
