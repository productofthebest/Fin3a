# Fin3a AI — Roadmap

Product: AI-first personal finance platform under Top Floor.
Crypto and payment processing reinstated by owner 3 Nov 2026 (Accounts page with NGN/USD ledgers, crypto deposit addresses, Breet planned). Still excluded: trading/exchange features. Never fake addresses or simulated transactions.

## Phase 1 — Foundation (current)
- [ ] Dashboard replies inside the question-bar chat box like the homepage: presentation implemented; verify existing signed-in conversation and regressions.
- [x] Company identity integration (3 Nov): assistant answers ownership/Top Floor questions from server-retrieved topfloorr.com content (6h cache, home + 4 pages) across dashboard, signed-in homepage and guest chat; verified owner-stated facts only, no paid web search, no fabricated corporate details; site retrieval confirmed live.
- [x] Bills cleanup (17:57 UTC): removed Add bill control and currency-style Bills navigation icon; signed-in desktop/tablet/phone checks pass, 190/190 regressions and preview build OK; records unchanged.
- [x] Nov 3 Bills presentation increment approved: Categories removed from main navigation, one receipt-icon Bills entry, category management retained on Bills, six selectable service cards with unavailable states and distinct recurring tracking. Verification recorded in docs/bills-payment-readiness.md; no backend or financial changes.
- [ ] Bills payment processing, merchant catalog, verified history/receipts and AI payment-history extensions: blocked on absent Flutterwave credentials/integration, merchant prefunding/settlement verification, isolated sandbox and separate financial design approval; no live debits or publication authorized.
- [x] Fin3a Admin audit and five-stage plan approved; Phase 1 verification contract prepared in docs/admin-phase1-verification.md; 170/170 baseline tests passed, no customer changes.
- [x] Staging-deferred admin increment: separate read-only overview and shell using existing AI admin permissions, preserving AI controls; 170/170 tests, build OK, signed-in owner refresh/sidebar/navigation and guest redirect verified on desktop/tablet. No financial writes, settings changes or publication.
- [ ] Fin3a Admin Phase 1 remaining: separate sign-in, five-role authorization, audit evidence, customer/wallet reads and isolated security/financial verification; blocked on approved permission/financial rollout and isolated verification. Provider phases need real enabled services; no money movements enabled.
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
- [x] Assistant web access (Nov 3): OpenAI web search tool enabled on the chat endpoint (low context size); instructions forbid user financial data in search queries and require **Web** labelling with sources; replies render source links. Not verified with a real paid request — needs staging
- [ ] Analysis, runway, affordability, what-if, goals, insights

## Launch-readiness priorities (approved Nov 2; one at a time, report and wait between)
- [x] Extend Dashboard research to general public topics with sources (09:52 UTC request; scoped live plan approved): shared public-question checks and general research mode enabled; 165/165 tests passed. Signed-in photosynthesis answer returned 200 with 8 sources, retained after reload; desktop/mobile checked without overflow or page errors. Normal paid usage and one test conversation saved; no financial writes or publication. Existing history-trust and cost-edge gaps remain open.
- [x] Broaden homepage AI web answers beyond finance (09:46 UTC request; scoped live plan approved): general public questions use bounded sensitive-input checks; private-record questions avoid research. Guest NASA news and signed-in photosynthesis questions returned 200 with 8 sources each; private credential input rejected before paid admission (400); 165/165 tests passed, build OK, desktop/mobile sources checked without overflow. Fees/caps preserved, Dashboard unchanged, no financial writes or publication. Detection is conservative, not guaranteed anonymisation; broader budget/concurrency gates remain open.
- [x] Nov 3 bounded web access on guest/signed-in homepage and Dashboard: approved scoped live plan implemented; literal public templates for exchange rates, tax and economic news keep personal context out of searches; separate research step with one maximum search, two-stage $0.22 reservations, HTTPS sources and unknown-cost retention. Real guest, personal homepage and Dashboard answers returned 200 with sources; Dashboard sources survive reload; desktop/390px mobile checks passed; 160/160 tests passed, build clean. Financial counts unchanged (96 transactions, 106 categories, 2 documents). No publication. Open limits: arbitrary-topic searching intentionally unsupported; full concurrent-budget/shutdown/limit edges and pre-existing browser-history trust remain unverified.
- [x] Nov 3 homepage guest text chat: owner deleted staging and approved direct live implementation; isolated guest endpoint with no financial reads, atomic shared admission, hashed-network daily limits, fixed guest spending reservations and global shutdown check. Real guest question answered; signed-in homepage redirects to personal assistant and protected homepage API answered the owner's actual transaction count while ignoring forged assistant history. 156/156 tests passed; desktop/mobile checked. No financial writes or publication. Not a full cost/security completion: cap/concurrency/shutdown edges and hosted edge network headers remain unverified; existing account budget concurrency gap persists.
- [x] Guest-chat preparation: approved plan saved; staging snapshot bd176e6c checked (read-only, no guest handler found); current regression suite 152/152 passed. No production code/database changes or paid calls; staging implementation remains open above.
- [ ] Test and save the latest approved staging release (owner request 2026-11-02 15:36 UTC): snapshot 2e8fc512 rechecked; 14 staging duplicate/reconciliation tests and 146 current regression tests passed. Promotion remains blocked: import SQL still ignores confirmed_separate and its content identity prevents identical legitimate repeats. Correct and workflow-test in staging; obtain approval for additional import-function scope before promotion. Copy no data/users/secrets.
- [ ] November 2 next priorities: prepare isolated staging, close assistant history trust vulnerability, implement missing monthly request caps and concurrency-safe budgets, then verify real requests/scans, 80% warnings, suspension/shutdown and concurrent enforcement. Production changes require a proposed-change report and explicit approval; no live financial records may be modified.
- [x] P1: Homepage AI chat and voice-to-text require sign-in; atomic per-account hourly limits in the database (chat 20/h, voice 30/h), output cap; old public endpoints removed. Signed-out blocking verified; signed-in use not exercised (would spend OpenAI credit and write live rows)
- [x] P2 (code): long PDFs split into 8-page parts (max 60 pages), locked/damaged PDF message, all-or-nothing scan. Real documents not yet verified — needs staging + sample files
- [x] P3 (code): printed opening/closing/credit/debit totals checked in cents; duplicate window fixed (full ±3 days, one match per transaction). Reconciliation result not yet shown as its own badge on the Scan page
- [ ] Final directive (Nov 2): complete Phases 1–5, staging environment, full test matrix, final report — do not declare launch-ready
- [x] P4: Activity page pages through full history (50/page, no cap) with date range, category, type and safe search; history index added; signed-in check on owner account
- [x] Statement totals badge on Scan page (Verified / Mismatch / Unable to verify)
- [x] OpenAI cost-management initial implementation (daily request and daily/monthly scan limits, monitoring, budgets, switches, estimated costs); 146 automated tests pass. NOT fully complete: monthly request caps absent, budget reservations absent, real-use verification blocked on staging.
- [ ] Isolated staging: owner referenced Fin3a Staging; read-only snapshot accessible. Verify hosted backend/auth/key isolation in staging's own chat before test accounts, financial rows or paid calls; this chat cannot modify that project.
- [ ] P5: Verify spending, affordability, goals, runway calculations
- [ ] Termii ready for FIN3A approval + wallet funding (not operational until a real OTP is verified)
- [ ] Phase 4 full completion with documented assumptions (approved; follows priorities)
- [ ] Isolated staging backend for test data (needed for real end-to-end tests)

## Phase 5 — Testing, Launch, Growth
- [x] Compact reference-sized account cards (latest): smaller write-up fonts and spacing match composer (162.5px high) and Split Bill (114/134/114px high) at desktop/tablet/phone, without internal scrolling or clipping; all existing details visible. 190/190 regressions pass, build OK. Real addresses/actions and nonempty activity remain unverified; safe growth preserves content in those cases. No financial writes or publication.
- [x] Match individual balance cards to intrinsic assistant composer dimensions and crypto cards to observed Split Bill dimensions; signed-in desktop/tablet/phone exact width/height/padding/radius verified, details scroll and Split Bill link checked, no overflow or financial writes. Wallet actions still await real provider addresses.
- [x] NGN/USD account panels match assistant composer width and stack vertically; signed-in desktop (1104px) and phone (361px) verified, no overflow, 190/190 tests pass. Presentation only; balances unchanged.
- [x] Dashboard spacing and conversation controls (Nov 3): removed redundant top/side spacing; selector and New sit right-aligned above composer. Signed-in desktop and 393×706 phone verified; 190 tests pass. No paid request or financial writes.
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
- [x] Accounts page: NGN/USD ledger accounts, derived balances, crypto address section (provider not connected), nav placement after Dashboard
- [ ] Breet API integration: real credentials, webhook signature verification, idempotency, end-to-end transaction testing before claiming complete
- [ ] Enable Deposit/Withdraw/Transfer actions once provider connected
- [x] Share Account & Split Bill (Nov 3 brief; owner approved full internal transfers + lookup by phone/Fin3a ID/email on live app): Fin3a IDs, public pay page with QR, atomic internal transfers with idempotency + persisted failed-attempt audit, split bills (equal/custom, reminders, three-section dashboard), admin monitoring. Verified end-to-end signed in: participant lookup, bill creation (₦100,000 → 2×₦50,000), zero-balance payment rejected server-side, admin figures; 181 tests pass, build OK. Test bills cancelled. Open: real-money transfer between two funded accounts (needs a provider deposit first), push/SMS reminders (in-app only), mobile pass.
- [x] QR payments (Nov 3 brief): nav QR icon ("Scan or Receive Payment"), /accounts/qr with My Payment QR (download/share), Scan to Pay (live camera via @zxing/browser, rear preferred, dedupe, permission-denial handling), fixed payment requests (amount/currency/description/expiry, single-use, server-validated), public /pay/qr/$requestId confirm page with success screen + reference, AI Assistant camera QR detection (Fin3a request/profile cards with Review Payment, external URLs shown safely never auto-opened, never auto-pays), admin QR monitoring (scans, requests, paid/failed/pending, value by currency, suspicious scan activity). Verified: request creation, own-request guard, signed-out prompt, invalid-request handling, mobile no-overflow; 190 tests pass, build OK. Test request cancelled. Open: real camera scan on a physical device, successful funded QR payment (needs provider deposits), push/SMS payment notifications (in-app activity only).
