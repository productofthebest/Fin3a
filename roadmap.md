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
- [ ] Scan/upload documents (statements, receipts, POS slips, teller receipts, cheques, transfers, invoices, bills)
- [ ] Extract dates, amounts, merchants, line items; PDF/CSV/Excel/images
- [ ] OCR, auto-categorization, duplicate detection, review-before-import screen

## Phase 3 — Financial Intelligence
- [ ] Calculation/forecasting engine; runway ("how long will my money last") with explainable assumptions
- [ ] Money states: pending / unverified / cleared / completed
- [ ] Duplicate prevention guarding balances and totals

## Phase 4 — AI Financial Assistant (chat built early: threads, saved history, snapshot-based answers)
- [x] Review uploaded Phase 4 brief and agree incremental delivery preserving existing features/design
- [x] Shared calculation foundation adopted by dashboard and assistant: classification/status/currency/date safeguards, recorded cash-flow distinction, disclosed averaging assumptions; 12 finance tests and routing test pass
- [x] Verify signed-in dashboard and live OpenAI balance-clarification answer; preview builds without errors
- [ ] Verify numeric dashboard/assistant reconciliation against nonempty authorized financial records (requesting account has no transactions; no production dummy rows added)
- [ ] Confirm currencies for legacy/imported rows without currency before including them in totals; unknown-currency records currently excluded, manual entries now save chosen currency
- [x] Historical comparisons/reports implemented: period filters, previous-period/YoY, categories, transaction drill-down and CSV export; authenticated date/filter/reload/export/mobile checks passed on the owner's empty account
- [x] Forecasting/simulator implemented: disclosed historical averages, required confirmed starting balance, baseline/scenario estimates and explicit insufficient-history state; arithmetic and input interaction tested
- [ ] Verify historical totals/category drill-down and forecasting end-to-end against nonempty authorized saved records (owner has no records; no production dummy data added)
- [ ] Remaining milestones: affordability/goals, explainable insights, assistant extensions and scanner hardening
- [ ] Chat over the signed-in user's data; backend math + AI explanation
- [ ] Analysis, runway, affordability, what-if, goals, insights

## Phase 5 — Testing, Launch, Growth
- [ ] Reports, notifications, CSV export, data deletion, QA, beta
