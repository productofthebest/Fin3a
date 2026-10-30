# Fin3a AI — Roadmap

Product: AI-first personal finance platform under Top Floor.
Excluded forever: stablecoins, crypto, wallets, trading, payment processing.

## Phase 1 — Foundation (current)
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
- [ ] Chat over the signed-in user's data; backend math + AI explanation
- [ ] Analysis, runway, affordability, what-if, goals, insights

## Phase 5 — Testing, Launch, Growth
- [ ] Reports, notifications, CSV export, data deletion, QA, beta
