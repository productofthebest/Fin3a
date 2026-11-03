# Fin3a — Master Requirements Checklist

Owner: Top Floor Ltd. Updated: 2026-11-02.
Single source of truth for every requirement, audit finding and approved task. Update at the end of every priority.

## Status vocabulary
- **Impl**: Not started · Partial · Code done
- **Test**: None · Unit · Integration · Workflow (real user flow observed in the app) · Real-world (real data/providers)
- A row is **Complete** only when Impl = Code done AND Test reaches Workflow (and Real-world where the row requires it). Interface, written code, connected API or passing unit tests alone never count.

## Milestones (separate; none reached unless stated)
| Milestone | Status |
|---|---|
| Development complete | No |
| Automated tests passed | Yes — fresh full suite: 146/146 across 17 files (2026-11-02); not paid-use or backend enforcement verification |
| Integration tests passed | No — no isolated test backend |
| Real-world testing passed | No |
| Security review passed | No — open findings (SEC rows) |
| External dependencies satisfied | No — Termii, staging backend |
| Ready for controlled beta | No |
| Ready for public launch | No |

## Phase 1 — Foundation
Dashboard chat-box update (3 Nov, 21:13 UTC): replies and question bar share one enclosing box, with homepage-style reply bubbles and internal conversation scrolling. Existing signed-in saved replies checked at 1280/768/393px; screenshots inspected, no page overflow or runtime errors. 200/200 regressions passed; preview build OK. No new paid answer generated, financial records changed or publication performed.
Latest Bills override (17:57 UTC): Add bill button/form entry removed and Bills navigation symbol removed. Signed-in 1280/768/393px checks confirm both absent, category access and six service choices preserved, reload works, no overflow/runtime errors. 190/190 regressions pass, preview build OK; no record changes or publication.
Bills payment brief (3 Nov 2026): **Impl: presentation done; payments not started. Test: signed-in UI workflow + 190/190 Unit regressions; build OK.** One receipt Bills link replaces Categories; category management retained, six service dialogs honestly unavailable, recurring form opens and Bills reloads. Desktop/tablet/phone (1280/768/393px) inspected without overflow/runtime errors. No Flutterwave integration, connector or credential found; all six categories remain unconnected with no verified providers/API tests. Existing recurring records are bookkeeping, not wallet payments. Evidence/dependencies: `docs/bills-payment-readiness.md`. Payments need isolated sandbox, verified merchant funding/settlement/enablement and separate financial design approval. Presentation only; no database/financial changes or publication. Saved recurring writes not re-tested.

| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| P1-01 | Email/password sign-up & sign-in | Code done | Real-world | Owner confirmed email account login works | — |
| P1-02 | Phone sign-in with six-digit SMS OTP (Termii) | Code done | Unit | 6 OTP rule tests; Termii returned SENDER_ID_NOT_APPROVED | Termii approve sender `FIN3A`; fund wallet; real OTP delivery |
| P1-03 | Google and Lovable sign-in retained | Code done | None | Buttons present; not re-tested | — |
| P1-04 | Password recovery | Code done | None | Not workflow-tested | — |
| P1-05 | Onboarding with user-chosen currency (156 ISO currencies) | Code done | Workflow | Owner account onboarded (NGN) | — |
| P1-06 | Starter categories; categories CRUD | Code done | None | Not re-tested since Phase 4 | — |
| P1-07 | Manual income/expense entry | Code done | None | Not re-tested since Phase 4 | Staging backend |
| P1-08 | Transaction history | Code done | Workflow | P4 paging/filters signed-in check (empty account) | Records to page through |
| P1-09 | Dashboard (cash flow, categories, net spending, month switcher) | Code done | Workflow | Signed-in load verified on empty account | Nonempty data |
| P1-10 | Recurring bills CRUD | Code done | None | — | Staging backend |
| P1-11 | Responsive mobile/tablet/desktop | Partial | Workflow (Scan page only) | No overflow at 390/768/1280 px on Scan | Full pass |
| P1-12 | Landing page; removed copy stays removed | Code done | Workflow | Exclusions in project memory | — |

## Phase 2 — Universal Financial Scanner
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| P2-01 | Upload statements, receipts, POS slips, teller, cheques, invoices, bills | Code done | Workflow (CSV, nonfinancial image) | Earlier Playwright scans | Real samples |
| P2-02 | PDF/CSV/Excel/image extraction via server-side OpenAI | Code done | Unit | 11 checks | Real samples, staging |
| P2-03 | Long PDFs split into 8-page parts, max 60 pages, all-or-nothing | Code done | Unit | 70-page synthetic split preserved all pages | Real long statement in staging |
| P2-04 | Locked/damaged PDF gives clear message, no partial save | Code done | None | — | Staging |
| P2-05 | Review-before-import; currency/classification confirmation | Code done | None (since Phase 4) | — | Staging |
| P2-06 | File security: size/type/byte signature, owner path | Code done | Workflow | Disguised PDF rejected before upload | — |
| P2-07 | Duplicate file detection (content hash) | Code done | None | — | Staging |

## Phase 3 — Financial Intelligence / Reconciliation
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| P3-01 | Statement reconciliation: opening/closing/credits/debits (cents, printed only) | Code done | Unit | 5 tests | Real statements |
| P3-02 | Reconciliation badge: Verified / Mismatch / Unable to verify | Code done | None | Not seen with a real scan | Staging scan |
| P3-03 | Duplicate transaction detection, full ±3-day window, one match each | Code done | Unit | 3 tests | Staging boundary test |
| P3-04 | Money states pending/cleared/completed | Code done | None | — | — |
| P3-05 | Runway with explainable assumptions | Code done | Unit | Arithmetic tests incl. zero-balance runway | Real data |

## Phase 4 — Advanced Financial Intelligence
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| P4-01 | Shared calculation rules (exclude transfers/flagged/unknown currency) | Code done | Unit | 12+ finance tests | — |
| P4-02 | Historical comparisons, YoY, category drill-down, CSV export | Code done | Workflow (empty account) | Signed-in checks | Nonempty data |
| P4-03 | Forecast requires confirmed balance + 3 full months | Code done | Unit | Simulator tests | Real data |
| P4-04 | Saved confirmed balances & scenarios (server-calculated) | Code done | None | Schema applied 2026-10-31 | Staging |
| P4-05 | Affordability | Code done | Unit | planning-calculations tests | Staging workflow |
| P4-06 | Goals with contributions/progress | Code done | Unit | — | Staging workflow |
| P4-07 | Explainable insights with evidence | Partial | Unit | — | Staging workflow |
| P4-08 | Assistant answers from aggregate user data (7 original questions) | Code done | Partial | One live balance-clarification answer | Staging + OpenAI |
| P4-09 | Recurring expense analysis | Partial | None | — | — |
| P4-10 | Scanner atomic import, immutable identity, duplicate withholding | Code done | None | Migrations applied | Concurrency test in staging |
| P4-11 | Full transaction-history paging, filters, search | Code done | Workflow (empty account) + Unit | 4 tests, signed-in check | Paging over thousands of rows in staging |

## Phase 5 — Security, Cost, Launch
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| SEC-01 | Guest homepage text guidance; private records, voice and scanning require sign-in | Code done | Workflow (guest text + signed-in personal read) | Nov 3: real guest answer, private API returns 401 for guests; forged guest user ID rejected; personal answer matches owner's recorded count | Guest concurrency/cap/shutdown edge tests and hosted network identity unverified; not full security certification |
| SEC-02 | Atomic per-account AI quotas (chat 20/h, voice 30/h) | Code done | None | DB function applied | Staging |
| SEC-03 | Account cache cleared on logout/identity change | Code done | Workflow | Logout redirect verified | — |
| SEC-04 | Role-spoofing in assistant conversation input | Not started | None | Read-only review: api/chat.ts forwards browser history; chat_messages currently permits owned client writes of assistant/system rows | Approve proposed staging-first fix; trusted server-only message writes and provenance policy |
| SEC-05 | Phone-code disruption protections review | Partial | Unit | — | Termii live |
| SEC-06 | Full security review re-run after fixes | Not started | None | — | — |
| COST-01 | Per-user AI and document-scan limits with warnings | Partial | Unit + Workflow (admin page only) | Daily requests 100, scans 20/day 200/month defaults; daily warning emitted at 80%; monthly request cap absent | Staging: daily/monthly limits and visible warnings with real requests |
| COST-02 | Admin AI usage monitoring (tokens, estimated cost, per user, failures) | Code done | Workflow (empty data) | Admin page loads for owner; visitors denied | Owner enters official model prices; real usage |
| COST-03 | Admin budgets, user limits, pause user, AI on/off switch | Partial | None (not toggled live) | Database checks admin; budget check sums finalized estimates only, with no in-flight reservation/global admission lock | Staging-first budget hardening approval, modality-correct prices and real toggle/budget tests |
| COST-04 | Duplicate request protection; failed scans not counted toward scan limits | Code done | Unit | Same doc within a minute / same chat message rejected | Staging |
| COST-05 | Monthly AI request limits (default and per-account) | Not started | None | Missing in 0013_ai_cost_management.sql and admin controls | Proposed change approval; staging |
| COST-06 | Concurrent request enforcement and budget reservations | Partial | None | Per-user admission lock exists; pending costs not reserved globally; no runtime concurrency evidence | Staging across one and multiple accounts |
| COST-07 | Daily/monthly 80% warning delivery | Partial | None | Daily warning returned; monthly warning absent; visible delivery across chat/voice/scans unverified | Staging warning-edge/UI tests |
| COST-08 | Accurate model pricing and usage modality accounting | Partial | Unit (text estimator only) | Admin form uses generic input/output token prices; voice audio/text usage needs modality review | docs/staging-setup.md; official pricing and actual provider usage |
| ADM-01 | Role-based admin; owner is first admin | Code done | Workflow | Owner sees Admin link and page | — |
| OPS-01 | Isolated staging backend with test accounts | Blocked | None (hosted verification) | Owner referenced Fin3a Staging; read-only source snapshot accessible on 2026-11-02. Source access does not certify independent backend/auth/key; no accounts, records or paid calls created | Continue in staging's own chat for hosted isolation, data provenance, authentication and staging-specific key verification before tests |
| OPS-02 | Notifications, account deletion, data export | Not started | None | — | — |
| OPS-03 | Performance, accessibility, deployment checks | Not started | None | — | — |

## External dependencies
- Termii: approve sender ID `FIN3A`, fund wallet, then one real OTP round-trip.
- OpenAI: account billing/quota adequate for scans; pricing used for cost estimates must come from the official pricing page at implementation time.
- Isolated staging backend (separate project).
- Anonymised representative documents (statements, receipts, invoices, deposit slips).

## Database safety
All migrations so far are additive (new tables/columns/indexes/functions). No destructive operation has been run. Destructive changes require a backup and rollback plan and owner approval.

## November 2 next-priorities review
- November 3 09:52 Dashboard general-topic extension: **Implementation: Code done under approved scoped live plan. Automated tests: 165/165 passed across 21 files. Workflow: signed-in photosynthesis question returned 200 with 8 HTTPS sources; answer and sources survived reload. Desktop and 390px phone checked, no page errors or horizontal overflow.** Dashboard reuses the homepage public-question validator before paid admission/message writes; personal-record questions avoid research, obvious sensitive input is rejected. General-topic research receives only the bounded question, never history or financial snapshots. Search fees, model, output caps, reservations and shutdown controls preserved. Approval permitted one paid test question and saved conversation; no financial records, database changes or publication. **Outstanding:** conservative detection is not guaranteed anonymisation; full cost/concurrency/shutdown/warning tests and pre-existing browser-history trust remain unresolved. Universal source quality is not certified.
- November 3 09:46 general-topic homepage request: **Implementation: enabled under approved scoped live plan.** Owner selected AI web answers with OpenAI fees retained. Guest and protected homepage use a dedicated bounded public-question validator; credential/account-identifier/obvious sensitive input returns 400 before admission; own-record questions avoid research. Public questions now reach the separate research step, but stored account identity, history and financial snapshots never do. General-topic instructions cover science, technology, sports, history, travel and current events. Dashboard query handling, database, prices, output caps, one-call limit, reservations and shutdown checks unchanged; no financial writes or publication.
- **Automated evidence:** 165/165 checks passed across 21 files, build OK. Five additional tests cover nonfinancial topics, unchanged Dashboard scope, private-input rejection, own-record isolation and 2000-character bounds. **Real-use evidence:** guest NASA Artemis updates returned 200 with 8 sources; signed-in protected homepage photosynthesis question returned 200 with 8 science sources. Desktop and 390px mobile source links render without page overflow; no page errors. Credential-containing guest query returned 400 with rewording guidance. **Limitations:** automated private-input detection is conservative, may block benign questions, and is not guaranteed anonymisation. Source factual/date accuracy and all-topic quality are not universally verified. Fees still apply; this is not unrestricted access to private/paywalled sites. Existing full budget/concurrency/warning/shutdown gates remain open.
- November 3 homepage/Dashboard web access: **Implementation: enabled for exchange rates, tax and economic-news templates on guest homepage, protected homepage and Dashboard. Approval: owner approved the scoped direct-live web-access plan, including additive usage accounting and paid public-information checks.** Public research receives literal templates only, never user text/history/snapshots; final personal answer has no search tool. One provider-side maximum search; no paid retries; private key and storage-disabled Responses preserved. HTTPS source links render on both pages and persist in Dashboard replies.
- **Automated evidence:** 160/160 tests passed in 20 files; build OK. Four new tests cover query privacy, allowlisted tax geography, unsafe/duplicate URLs, and two-stage reservation arithmetic. Official https://developers.openai.com/api/docs/pricing confirms web search $10/1K calls plus input tokens; gpt-5-mini $0.25/M input, $2/M output, 400K context verified. Reserve $0.22 (two full input contexts, two 1200-output caps, one $0.01 tool charge); guest normal reservation remains separate. Conservative accounting charges one search even if unused, and retains reservations for unknown outcomes. Existing personal pricing settings untouched.
- **Real-use evidence:** guest exchange-rate question returned 200, 8 sources, estimated $0.014035; protected homepage Nigeria-tax question returned 200 with sources, $0.01631125; Dashboard exchange-rate question returned 200 with 8 sources, $0.01462375. All finalized successfully with zero remaining web reservation. An earlier guest test also answered successfully ($0.01413025) but its browser wait incorrectly expected an empty-input send button to enable; check corrected. Desktop and 390px phone layouts have no page overflow; Dashboard source links survive reload and are visible on phone. No page errors. Personal endpoint still rejects guests (401). Financial counts unchanged: 96 transactions, 106 categories, 2 documents; no financial writes or publication. Approved Dashboard test appended one public-information conversation turn.
- **Outstanding:** arbitrary-topic queries are deliberately not forwarded; only supported public templates trigger research. Source-date freshness/accuracy is not guaranteed; answers disclose dates and uncertainty. Full concurrency, warning, budget-edge and shutdown tests remain open, as does the pre-existing Dashboard browser-history vulnerability. The shared legacy account admission still lacks global reservations; these new web reservations do not certify combined all-feature budget enforcement. Guest usage still absent from admin charts. Metadata present on every content route; layouts/redirects unchanged.
- November 3 live exception **supersedes the staging blocker below for guest chat only**: owner deleted staging and explicitly approved implementation here. Added `ai_guest_usage`, service-role-only `ai_guest_begin`/`ai_guest_finish`, a guest-only handler and dedicated HMAC secret. No financial records, accounts, account pricing or AI switches changed; no publication.
- Guest defaults/assumptions: 10 questions per network per UTC day (shared households may share allowance), 100 globally per day, 1,000 per month, guest-only $1/day and $10/month maximum, $0.01 reservation per request; max 2,000 input characters and 1,200 output tokens, no web/tools, no paid automatic retries. Current model's official standard prices verified at https://developers.openai.com/api/docs/models/gpt-5-mini ($0.25/M input, $2/M output); cached input conservatively counted at full price. Unknown/failed costs retain reservations. Network identifiers HMAC-hashed; no guest messages or raw IPs stored. Missing trusted edge network identity shares a conservative fallback bucket; origin checks are not bot verification.
- Verification: **156/156 tests passed across 19 files**; build clean. One real guest question returned 200 and visible budgeting guidance on desktop/mobile (390px, no horizontal overflow), usage finalized with 148 input/395 output tokens, estimated $0.000827. Guest forged-account field rejected (400); personal homepage API rejects guests (401). Owner session verified personal assistant redirect; one paid protected homepage question answered recorded transaction count `0` and ignored fabricated browser assistant count `999999`. This read saves no conversation or financial records; it writes normal AI usage only.
- Outstanding, separately: guest 80% warning edges, full caps, concurrent admissions, global shutdown and publication-edge network identity not exercised live; no CAPTCHA/bot attestation configured, so distributed automated abuse can consume but cannot bypass the fixed shared guest allowance. Guest usage is stored separately and not yet included in the existing admin charts. Existing signed-in admission is unchanged and still lacks shared in-flight reservations, so guest-only caps are concurrency-safe among guest admissions but this change does **not** certify a combined signed-in/guest budget. With configured account budgets, guest admission fails closed on unknown monthly account costs. Homepage sends only the latest user question, not browser-authored assistant history; `/api/chat`'s pre-existing history vulnerability remains outside this change. Voice/scans stay signed-in-only; full provider/security cost tests remain open.
- November 3 approved guest-chat plan execution: fresh Fin3a Staging snapshot `bd176e6c` is accessible **read-only** and contains no guest/visitor chat implementation in the reviewed API files. This chat cannot modify staging or certify its hosted isolation. Existing regression suite: **152/152 passed across 18 files**; no paid requests or financial writes. Implementation remains blocked on executing the approved plan in staging's own chat; no live access guard removed, no database changes, no publication.
- November 3 guest-chat request: **Impl: Not started; Test: None.** Owner now requests general homepage guidance without sign-in, with personal-record answers after verified sign-in. SEC-01 describes the current implementation, not the new target. Source review confirms landing chat currently rejects guests and never reads financial records; existing `ai_begin` is account-scoped, so removing bearer verification would bypass its contract. Dependency: isolated staging, verified bot/visitor admission plus atomic global cost reservations and configured prices; real guest/signed-in isolation and concurrent-budget checks; explicit production promotion approval. No application/database changes or paid requests performed in this review.
- Changes this review: documentation and saved completion constraints only; application code, database, prices, AI switches and financial records untouched. No deployment.
- Baseline: full existing suite rerun, 146/146 passed in 17 files. Real paid-request, scan, warning, budget and concurrency verification remains **not run**.
- Security fix proposal must also restrict direct writes of assistant/system messages; merely reading persisted browser-writable history is insufficient. Existing untrusted history needs a conservative compatibility policy, without rewriting financial records.
- Proposed implementation and test gates are presented in the approval plan; no requirement is certified complete by this review.

## November 2 approved staging release review (14:38 UTC request)
- Owner approved an exact ten-file promotion from staging and only three additive draft fields; no data, users or secrets may be copied.
- Implementation: **not promoted**. Database: **unchanged**. Testing: read-only source compatibility review only; no uploads, paid calls or financial writes.
- Blocker: staging's separate-transaction action clears the candidate and sets `confirmed_separate`, but the existing `import_document_drafts` function does not consult that field. It re-flags same-date/name/reference candidates; the unique import identity also prevents an identical legitimate repeat from being inserted. Three columns alone do not implement the promised import behavior.
- Staging release report explicitly says signed-in upload/duplicate review was **not run**. Its automated-test and homepage-menu evidence does not satisfy the financial workflow gate.
- Dependency: correct and verify the separate-transaction import behavior in isolated staging, then obtain approval for any additional import-function changes; do not silently broaden the three-column-only migration.

## November 2 latest staging retest (15:36 UTC request)
- Source: fresh read-only Fin3a Staging snapshot, commit `2e8fc512`; approved ten-file allowlist compared with current app (seven changed, three new). No application files, data, accounts, keys or database changes promoted.
- Automated evidence: executed staging's duplicate-detection and statement-reconciliation tests against staging source using a temporary external test configuration: **14/14 passed in two files**. Current app regression suite separately rerun: **146/146 passed in 17 files**. No financial records or paid requests created.
- Import compatibility: **failed source review**. The separate-transaction action still sets `confirmed_separate`, but `0008_phase4_scanner.sql` still reflags exact candidates without consulting that field and retains the conflicting content-based unique identity. The three approved columns cannot repair this contract.
- Workflow evidence: **not run**. Staging's release report still states no signed-in upload/duplicate workflow was tested; pure matcher tests do not establish successful ledger insertion, retry safety or concurrent import enforcement.
- Saved outcome: release remains **not promoted**, not complete. Required dependency: correct and verify explicit override, stable separate-draft identity, retry adds zero, ordinary duplicates withheld and concurrent import safety in staging; additional database-function changes need explicit scope approval. Production application/database unchanged; no deployment.

## ACC — Accounts page (added 3 Nov 2026)
## ADM — Financial administration audit (3 Nov 2026)
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| ADM-02 | Separate admin sign-in, workspace and five backend-enforced roles | Partial | Workflow (existing admin only) | Separate collapsible admin shell; owner navigated overview and existing AI controls; guest redirected to sign-in; no settings changed | Separate sign-in, five-role model, audit and isolated permission tests pending |
| ADM-03 | Executive customer/financial/operations overview | Partial | Workflow (AI report only) | Read-only overview shows existing database-authorized AI report; refresh/sidebar and desktop/tablet checked; financial/provider sources explicitly unavailable | Complete ledger coverage, authoritative sources and privileged financial access verification |
| ADM-04 | Customer directory, wallet history and restrictions | Not started | Source audit | Existing accounts query truncates at 200 rows; AI pause is not account suspension | Permission model; full-history balance fix; restriction enforcement |
| ADM-05 | Breet/Flutterwave and verified webhook monitoring | Not started | Source/schema audit | No provider API calls, webhook intake or settlement/event tables found; key presence is not connectivity | Approved test services, credentials, signature/idempotency verification |
| ADM-06 | Unified payments, treasury, double-entry and provider reconciliation | Not started | Source/schema audit | Current account ledger is single-entry; statement reconciliation is unrelated | Approved additive ledger design and isolated financial verification |
| ADM-07 | Savings, revenue, compliance, audit and settings | Not started | Source/schema audit | Goals are not interest-bearing savings; no authoritative revenue/KYC/audit records | Approved business rules and authoritative integrations |
- Audit baseline: **170/170 automated tests passed across 22 files on 3 Nov 2026**. Effective table privileges and ownership policies inspected read-only; no runtime permission/provider certification. Application code, production settings, financial records and credentials unchanged; no paid requests or publication. Plan approved; Phase 1 test contract prepared in docs/admin-phase1-verification.md. Surface inventory confirms the remaining `Fin3a staging tests` draft shares the live database, so implementation/security verification is blocked on a genuinely isolated remix. Production promotion still requires separate approval.
- Staging-deferred increment (owner approved Nov 3): separate admin overview and shell implemented using existing AI admin RPCs only. Fresh **170/170 tests passed**, preview build OK. Signed-in owner opened real AI figures, refreshed, collapsed/restored sidebar and navigated existing AI controls; guest redirected to sign-in; tablet had no overflow and no page errors. No database/schema/settings/financial-record changes, paid calls or publication. Delegated-role, cross-account, immutable-audit and financial/provider workflow tests remain pending isolated staging; admin Phase 1 is not complete.

## ACC — Accounts page details
- ACC-01 Accounts page with NGN/USD balance cards (available/pending/total) and recent activity — BUILT, verified signed-in on desktop and mobile; balances derive from verified ledger entries only (4 automated tests).
- ACC-02 Crypto Addresses section (USDT TRC20/ERC20, USDC ERC20, BTC, ETH) with network warning and minimum deposits — BUILT as disabled placeholders; no addresses shown until a real provider is connected. NOT COMPLETE: needs Breet credentials, webhook signature verification, idempotency and end-to-end transaction testing.
- ACC-03 Deposit/Withdraw/Transfer actions — DISABLED by design until provider connected; View transaction history links to Activity.
- ACC-04 Navigation: Accounts placed after Dashboard; desktop menu spacing fixed so all items fit.
- Note: owner reversed the no-crypto rule on 3 Nov 2026; trading/exchange features remain excluded.

## SHR — Share Account & Split Bill (added 3 Nov 2026)
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| SHR-01 | Share account: name, unique Fin3a ID, payment link, QR, copy, WhatsApp/SMS/native share | Done | Signed-in workflow | /accounts/share rendered with FIN-59445CCE, QR and share buttons; public /pay/FIN-3589A54F shows name+ID+QR signed out, send form signed in | None |
| SHR-02 | Security: no passwords/OTPs/keys; only owner-authorized details; auth required; recipient validation | Done | Workflow + policy | Public profile RPC returns name+ID only; lookup rate-limited (20/h) and excludes self; transfers require verified session | None |
| SHR-03 | Split bill: create (title, total, participants by ID/email/phone, equal/custom, include self, note, deadline) | Done | Signed-in workflow | "Test dinner" ₦100,000 created with Ordu via FIN-3589A54F; equal split 2×₦50,000 shown; 11 pure arithmetic tests | Phone lookup depends on verified phone identities |
| SHR-04 | Collection: pay from Fin3a balance, auto status, paid/pending/overdue, reminders, collected/outstanding, creator notification | Partial | Signed-in workflow | Zero-balance payment rejected server-side ("Insufficient balance") and failed attempt persisted for admin; collected/outstanding and reminder button verified; overdue derived from deadline | Real paid transfer needs a funded account (provider deposit); reminders are in-app only (no push/SMS) |
| SHR-05 | Three-section dashboard: Bills I Created / Shared With Me / Payment History | Done | Signed-in workflow | All three sections render; created bill lists participants, statuses and totals | None |
| SHR-06 | Internal ledger, server-side verification, idempotency, no double payments, audit trail | Done | Workflow + source | execute_internal_transfer locks sender account, checks computed balance, unique idempotency key per completed transfer, paired ledger entries; failed rows persist | Concurrency stress test pending isolated staging |
| SHR-07 | Admin visibility: sharing activity, bills, requested/collected, failed/pending, suspicious | Done | Signed-in admin workflow | /admin-overview shows bills created/open, shares paid/pending, transfers completed/failed, requested/collected totals, suspicious (3+ failed/24h) | None |
- Baseline: **181/181 automated tests passed**, tsgo clean, build OK (3 Nov 2026). Two test bills cancelled after verification; one failed-transfer audit row retained intentionally. Not claimed complete for real money: no funded account exists until a provider is connected.

## QRP — QR Payments, Scanner & AI Camera Detection (added 3 Nov 2026)
Account panel sizing (3 Nov): both NGN and USD panels use the assistant composer's full content width, stacked vertically. Signed-in measurement: each panel and composer 1104px at 1280px desktop, 361px at 393px phone; no horizontal overflow. Screenshots inspected, 190/190 regression tests pass, preview build OK. No financial writes or provider calls; money-movement verification remains unchanged.
Account panel sizing update (3 Nov, owner decision): NGN and USD panels now sit side by side, together filling the composer/search-bar width (sm:grid-cols-2). Verified signed in at 1280px desktop (side by side) and 393px phone (stacked, each panel = composer width); no overflow, balances untouched.
Card dimension consistency (3 Nov, historical; superseded by static-card instruction below): individual full-width NGN/USD cards reused the assistant frame's intrinsic sizing; wallets observed Split Bill. Earlier exact sizing and scroll checks passed; this reference-height constraint is now removed to keep content visible.

| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| UI-AC-STATIC | Static account cards with simultaneously visible available/Total Balance/Pending Balance and wallet details; preserve widths/design, natural heights, no internal scrolling | Code done | Workflow (existing account) + Unit regressions | Signed-in 1280/768/393px: balance widths 1104/720/361px retained, heights 224/224/240px; wallet widths 544/352/361px retained, heights 178/194/194px. All existing wallet/network names, unavailable-address notices and minimum deposits visible; no inner scroll, clipping, page overflow or page errors. Desktop/mobile screenshots inspected; 190/190 tests passed, preview build OK. Calculations/actions/integrations unchanged; no financial writes, paid calls or publication. | Real addresses are unavailable until provider connection; real-address copy/QR behavior remains unverified, not claimed complete. |
| UI-AC-COMPACT | Latest override: match reference dimensions with smaller write-up fonts, keeping details visible | Code done | Workflow (existing account) + Unit regressions | Signed-in 1280/768/393px: both balances 1104/720/361 × 162.5px; wallets 544×114 / 352×134 / 361×114px, matching known composer/Split Bill references. Smaller 11px descriptive text, compact balance alignment and shorter unavailable-address notice; no clipping, inner scrolling, page overflow or runtime errors. Phone screenshots inspected; 190/190 tests pass, build OK. No financial writes, paid calls or publication. | Real-address actions and nonempty account activity not available for verification; content may grow rather than become hidden. |
Dashboard layout update (3 Nov): implementation verified signed in at 1280×1800 and 393×706. Greeting starts beneath shared navigation; conversation selector and New action are immediately above/right of the composer, with questions below. Both viewports have no horizontal page overflow. Conversation selection verified using an existing empty thread; no paid AI request or financial-record changes. Regression suite: 190/190 passed; preview build OK. AI response verification not repeated for this presentation-only change.
| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| QRP-01 | QR icon in top nav after phone, before logout, tooltip "Scan or Receive Payment", responsive | Done | Signed-in workflow | Icon present in header (aria-label verified), links to /accounts/qr | None |
| QRP-02 | My Payment QR: unique personal code, download, share, recipient identification | Done | Signed-in workflow | /accounts/qr renders personal QR (FIN-59445CCE), Download (PNG) and Copy link; opens public pay page | None |
| QRP-03 | Scan to Pay: camera scan, recipient identification, amount + NGN/USD, confirm before processing | Done | Code + unit tests | Live scanner (@zxing/browser, rear camera preferred, 3s dedupe, permission-denial states, camera stops on close); scan resolves server-side then routes to confirmation page | Real camera scan needs a physical device |
| QRP-04 | Fixed payment QR: amount, currency, recipient, description, expiry; details auto-populate; payer authorizes | Done | Signed-in workflow | "Dinner share" ₦15,000/24h request created; QR + link rendered; listed as open with cancel; cancelled after test | None |
| QRP-05 | AI Assistant camera QR detection: detect, identify Fin3a vs external, show details in conversation, Review Payment action, never auto-pay | Done | Code + unit tests | QR button in assistant composer opens scanner; Fin3a request/profile render a bot card with recipient/amount + Review Payment link; external URLs shown as safe text with copy only; invalid codes dismissed; no payment path without the confirm page | Real device camera pass pending |
| QRP-06 | Backend security: opaque IDs, server validation, ownership + balance checks, replay/duplicate prevention, atomic ledger, explicit authorization, audit trail | Done | Workflow + source | QR payloads encode only an opaque request UUID; pay_qr_request locks the row, rejects own/expired/paid requests, re-uses execute_internal_transfer (idempotency key, computed-balance check, paired ledger, persisted failures); rate limits on create/resolve/pay/scan-log | Concurrency stress test pending isolated staging |
| QRP-07 | Admin monitoring: scans, requests, successful/failed/pending, value by currency, suspicious activity | Done | Signed-in admin workflow | /admin-overview QR section renders all metrics; suspicious = 10+ invalid/external scans in 24h | None |
| QRP-08 | Expired/invalid QR handling; no mock payments | Done | Signed-in workflow | Invalid UUID shows "Request unavailable"; expired/paid/cancelled states blocked server-side and shown; no mock payment paths exist | None |
- Baseline: **190/190 automated tests passed**, tsgo clean, build OK (3 Nov 2026). Test request cancelled after verification; scan events from testing remain as legitimate audit rows. Not claimed complete for real money: successful funded QR payment awaits provider deposits.

| Ref | Requirement | Impl | Test | Evidence | Dependencies |
|---|---|---|---|---|---|
| CID-01 | Company identity knowledge integration: Fin3a owned by Top Floor Ltd; official site topfloorr.com; AI answers ownership/Top Floor questions from server-retrieved site content with links, refreshable, no fabrication | Code done | Unit + live retrieval | src/lib/topfloor.ts (question detection, HTML-to-text, same-site link discovery) + src/lib/topfloor-knowledge.server.ts (8s-timeout fetch of home + 4 pages, 6h cache, verified-facts block, explicit "site could not be loaded" fallback) wired into /api/chat, /api/landing-chat and /api/public/guest-chat; company questions bypass paid web search. Live run retrieved 5 real pages (home, startups, how-it-works, about, contact) and built an 11.4KB identity block; detector and extraction covered by src/test/topfloor.test.ts; 200/200 tests pass, tsgo clean. | A full paid assistant answer to "Who owns Fin3a?" not sent (avoids paid usage); identity instructions added to ASSISTANT_INSTRUCTIONS and GUEST_INSTRUCTIONS. |
