# Fin3a AI — Roadmap

Product: AI-first personal finance platform under Top Floor.
Crypto and payment processing reinstated by owner 3 Nov 2026 (Accounts page with NGN/USD ledgers, crypto deposit addresses, Breet planned). Still excluded: trading/exchange features. Never fake addresses or simulated transactions.

## Phase 1 — Foundation (current)
- [x] Strict country wallet visibility: Nigeria NGN/USD, Ghana GHS/USD, US USD only. Signed-in Settings switching, Wallet, Deposit/Withdrawal, Transfer and Swap checked on desktop/phone; original US setting restored. NGN card/balance/activity unchanged on return; 42 related tests pass, build OK. Funded restoration covered only by pure tests (real wallet is empty); no financial writes or publication. Unsupported local payment rails remain disabled.
- [x] Dashboard opens without automatically focusing the assistant field or shifting scroll; signed-in phone/desktop entry and tap-to-type verified, two related tests pass, build OK. Physical-phone keyboard not directly tested; no paid requests or publication.
- [x] Send to contact implemented across Transfer, Share Payment and Split Bill: phone-picker with manual fallback, account-scoped saved IDs on this device, authenticated relookup, explicit save/remove. Real recipient lookup → save → Split Bill readback/relookup verified; mobile/desktop inspected, no page errors/overflow; 309 tests pass, build OK. No financial/database writes or publication.
- [ ] Contact verification remaining: physical-device address-book permission and successful funded payments are unverified; native contact access varies by browser and preview frame. Saved recipients do not sync between devices.
- [x] Accounts organization and Settings UI: removed combined action entry; Deposit/Withdrawal each offer NGN/USD; single-recipient Fin3a Transfer reuses existing authorized operation; Settings replaces Phone with name, email-change confirmation and existing verified phone flow. Signed-in desktop/phone navigation, currency switches, unavailable payment gates, zero-balance transfer guard and email review/cancel verified; no page errors/overflow. 302 tests pass, build OK; no contact changes, messages, financial writes or publication.
- [ ] Settings verification completion: actual name persistence and email/phone change delivery/readback remain untested to avoid changing the owner's account or sending messages. Hosted secure-email-change settings unverified. KYC submission waits for approved requirements/provider; funded internal transfer remains blocked on real deposits.
- [x] Admin messaging preparation: Messages menu, real recipient lookup, one/all-user choices, push/email/SMS composer and preview. 300/300 tests pass, build OK; signed-in recipient/preview/all-users and desktop/phone verified without errors, sends, financial writes or publication.
- [ ] Admin message sending: blocked on Firebase setup (declined), owned email sender domain, marketing provider for promotional/broadcast email, Termii sender approval/funding, consent registration and audited idempotent execution. Real delivery, device permission/background push and isolated security verification remain unverified; no sends authorized in testing yet.
- [x] Nov 4 22:40 clarification: original AI Admin controls, sidebar and overview restored; assistant remains no-tool and own-user-only. Admin-information prompts rejected before snapshot/research/inference on all three chat endpoints, including when signed in as Admin. 294/294 tests pass, build OK; signed-in AI Admin/Overview desktop/phone and actual 403 responses verified; no paid calls, settings changes, financial writes or publication. Prompt detection is conservative, not comprehensive anonymisation/security certification.
- [x] Nov 4 22:36 approved Admin/AI separation: AI cards/sidebar/control screen retired, `/admin` redirects to Overview, Admin exit goes to Accounts. Personal and guest final-answer calls explicitly have no executable tools; own-user aggregate reads retained. Live ledger policy check shows authenticated SELECT-only ownership policy. 285/285 regressions pass, build OK; signed-in old address, Overview, Users, Accounts and local account-help link checked without page errors or paid calls. No database/financial writes or publication; adversarial isolated security certification remains unverified.
- [x] Dashboard module-load recovery: one tab-guarded reload for asset failures, manual full-page retry, no financial-request retries. Signed-in phone/desktop Dashboard verified after an injected preload failure; 278/278 tests pass, build OK. One live viewer confirms Dashboard content; another viewer still times out, so the original tab failure is not conclusively reproduced. No paid calls, financial writes or publication.
- [x] Nov 4 22:20 safe QR/account-help increment: checksum-validated BTC, EVM/ERC20, TRON, LTC and DOGE recognition with local QR image upload/review; protected auth-styled account page reuses real balances, USDC/USDT-only withdrawal selection, honest unavailable rates/instructions. Dashboard/homepage account prompts offer fixed secure navigation without paid calls or collecting details in chat. 272/272 tests; build OK; signed-in desktop/mobile, Bitcoin QR image decoding, USDT selection and Dashboard help link verified; guest redirected to sign-in; no errors/overflow, financial writes or publication.
- [ ] Crypto deposit/withdrawal execution, saved destinations and fresh payment authorization remain blocked on verified provider integration and isolated funded/security tests; physical-device camera scanning remains unverified. Recognition never certifies token/network support or address ownership.
- [x] Nov 4 20:31: Accounts says “Rate” with neutral unavailable-swap message, no Breet name in customer page. Dashboard scanner loads only on demand; signed-in network check confirms scanner module absent before opening, fetched on click and closes correctly. Desktop/phone Swap verified, no overflow/page errors; 256 regressions pass, build OK. Fee/quote gates unchanged; no paid calls or financial writes. Actual AI model latency not measured or changed.
- [x] Nov 4 20:28: restored Accounts Swap with amount/direction inputs, 0.1% fee disclosure and explicit unavailable Breet quote/charges; confirmation disabled, legacy fixed-rate execution not wired. Signed-in desktop/phone inputs verified, no overflow/errors; 52 related tests pass, build OK. No financial/settings writes.
- [ ] Actual Breet swap quote, monetary fee/net amount and settlement: blocked on missing provider integration, supported settlement rights and isolated funded verification; no legacy-rate substitution.
- [x] Nov 4 20:10: removed user/Admin NGN↔USD conversion controls; signed-in Accounts/Admin desktop and phone checks preserve both balance cards with no overflow/errors. Existing crypto swap default 0.1% confirmed on Admin and by exact arithmetic tests. Homepage now acknowledges questions before session lookup, with regression test. 256/256 tests pass, build OK; no settings/financial writes, paid AI calls or publication. Provider swap activation and actual model-response speed remain unverified.
- [x] Per-deposit currency cleanup (20:00 UTC): retired account-wide selector, read and server setter; marked legacy field deprecated without deleting records. Signed-in desktop/phone Accounts verified, Deposit remains disabled, two balance cards intact, no overflow/errors; 254 regressions passed, build OK.
- [ ] Actual asset/network/amount/per-deposit receiving-currency quote and settlement flow: blocked on missing Breet credentials/adapter, account-supported settlement options and isolated funded verification; no simulated rates/addresses or deposits.
- [x] Fee/revenue foundation and Admin reporting (4 Nov approved plan): exact fee calculator, versioned settings/audit, immutable quotes/revenue lifecycle guards, separate NGN/USD reports, CSV/Excel controls, corrected account pagination; 254 unit/regression tests and signed-in read/confirmation/CSV verified. No fee settings or financial records changed in verification.
- [ ] Fee/revenue completion: actual Breet/Flutterwave adapters, per-deposit NGN/USD instructions, confirmed quotes/crediting, commission agreement settings/reconciliation, detailed crypto/network/status reports, consolidated recorded-rate exports and isolated saved-admin/lifecycle/security tests remain blocked on provider access, agreements and isolated funded sandbox. No live collection or publication.
- [x] Two-currency display: original currency in Activity, NGN/USD selectors in Spending/Analysis/Insights/Planning/Goals; assistant carries separate aggregate summaries. Signed-in switches/reload checked on six pages; real protected assistant answer returned separate NGN/USD totals; 204/204 tests, build OK. No financial writes/publication. Current account has no transactions; nonempty live reconciliation and saving USD planning inputs remain unverified.
- [x] Removed Dashboard chat-history selector, preserving saved conversations, active replies and New; homepage has no history selector. Signed-in browser check passed, 200/200 tests pass, preview build OK.
- [x] Dashboard replies inside the question-bar chat box like the homepage: saved signed-in conversation verified at 1280/768/393px, no page overflow or runtime errors; 200/200 tests pass, preview build OK. No paid requests, financial writes or publication.
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

## Split Bill QR add (2026-11-04)
- Scan button beside Add on /accounts/split; reuses QrScanner + parseScannedQr; fin3a_profile codes feed lookupRecipient, request/external codes rejected with a toast.

- [x] Admin User Statistics & User Management (manual verification, 100-day active window, two-admin adjustments, logged profile views)

## Flutterwave (live keys; owner chose all features)
- [ ] Webhook connection (Nov 5): V3 architecture/signature inspected; shared FLW_WEBHOOK_HASH missing. Harden verification/retries/exact amounts, persist verified statuses without editing history, test duplicate credits/refunds in isolation, deploy and check exact HTTPS URL, request shared secret after deployment. Owner approved publishing all current app changes after isolated checks; verified refunds held for Admin review with no automatic balance deductions. No claim of deployed/ready until public endpoint and required secret verified.
- [x] Bank list + account-name check in Transfer
- [ ] NGN bank transfer sending: wallet hold, payout, webhook-verified settle/refund (needs webhook secret + owner small real test)
- [x] NGN bank top-up via dynamic one-time virtual accounts (owner real ₦ test pending)
- [ ] Bill payments (after payouts verified)
