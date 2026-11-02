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
| SEC-01 | Homepage chat & voice require sign-in | Code done | Workflow (signed-out) | 401s; sign-in prompt shown | Signed-in use by owner |
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
