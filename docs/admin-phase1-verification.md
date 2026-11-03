# Fin3a Admin Phase 1 — preparation and verification contract

Status: owner deferred staging on 3 November. A separate admin shell and read-only overview now reuse the existing AI administration access and report; existing AI controls remain unchanged. No new financial reads, roles, schema, audit writes, provider calls or money operations are introduced. Workflow checks and full regression results are recorded separately below.

## Staging-deferred increment evidence

- Implementation: `/admin-overview` and shared admin sidebar; `/admin` retains existing AI controls and URL. Financial/customer/provider metrics remain unavailable, not invented zeros. The existing AI RPC rechecks admin authorization in the database; no broader privilege is introduced.
- Automated: 170/170 tests across 22 files passed; preview build OK.
- Workflow: guest redirected to sign-in; requesting owner restored through managed authentication and loaded the real AI report, refreshed, collapsed/restored sidebar and opened existing AI controls without changing settings. Desktop and 768px tablet screenshots checked; no tablet overflow or page errors.
- Evidence: `/tmp/browser/admin-overview/check_admin.py` and desktop/tablet captures (temporary); observed 5 requests today, 10 this month, 7 unpriced requests and $0.0472 partial estimated spend. Estimates are not full provider invoices; guest/search fee coverage remains uncertified.
- Deferred: separate admin sign-in, five delegated roles, append-only audit, customer directory, full-history wallet totals, role/cross-account security testing and provider/financial operations. These are not certified complete. No production financial records, schema, settings or credentials changed; no paid calls or publication.

## Isolation check (3 November 2026)

The surface inventory reports the current main project and an existing draft called `Fin3a staging tests`. That draft explicitly uses **the project's live database**. It is not an isolated test environment and must not receive test users, role assignments, audit rows or financial records.

The previously referenced separate Fin3a Staging project was deleted. Create a fresh remix through project Settings → Remix this project. In its own chat, verify distinct backend, authentication and storage before running this contract. Do not copy production users, sessions, files, records or secrets; configure independent test credentials. A remix's source or name alone is not isolation evidence.

## Remaining Phase 1 scope (not implemented in the staging-deferred increment)

- Separate admin sign-in entry and admin shell, preserving customer screens and the existing `/admin` entry.
- Backend permission records for the five requested admin roles and deny-by-default authorization helpers.
- Read-only customer counts and financial coverage overview from authoritative sources; unsupported values are unavailable.
- Append-only administrative action evidence, including actor, action, target, timestamp, outcome and reason; never secrets or unnecessary raw payloads.
- Existing AI controls retained; no change to budgets, prices, switches or current user roles in this preparation.

Initial administrator mapping, audit retention and sensitive-operation reauthentication must be documented before the release approval. Do not automatically broaden the current AI administrator's privileges.

## Required isolated test matrix

| Case | Expected outcome | Evidence required |
|---|---|---|
| Guest opens admin or calls protected function directly | No private content; request denied | UI and direct endpoint result |
| Customer signs in through admin entry | Admin access denied; no role assignment | UI, role readback and endpoint denial |
| Super Admin | Approved administrative permissions only | Role-scoped endpoint tests |
| Finance Admin | Treasury/reconciliation/reports/savings monitoring; other operations denied | Positive and negative permission tests |
| Operations Admin | Approved payment investigation/operations only | Positive and negative permission tests |
| Compliance Admin | KYC/risk/restrictions only as authorized | Positive and negative permission tests |
| Customer Support | Customer/profile/history reads; financial writes denied | Positive and negative permission tests |
| Forged user metadata, browser role or target ID | No elevation or cross-scope access | Endpoint and database policy tests |
| Sensitive administrative action | Fresh verification and authorized reason; immutable audit evidence | Action and audit readback |
| Edit/delete audit evidence as customer or admin | Denied; correction is a new event | Actual database permission tests |
| Sign out and change identity | Queries canceled/cache cleared; protected data not restored by Back | Two-account browser test |
| Overview counts | Match authoritative reads; unavailable sources not represented as zero | Readback and arithmetic comparison |
| Desktop/tablet | Sidebar collapses/restores; tables scroll without hiding controls | Screenshots and interaction checks |
| Customer regressions | Sign-in, assistant, spending, scanning and account screens preserved | Full automated suite and scoped workflows |

No paid AI/provider call or financial test may run until isolated credentials and authorization are verified. Provider tests are blocked until real test-mode integrations exist. Automated tests alone never close these rows.

## Current evidence

- 170 automated tests passed across 22 files during the read-only audit.
- Schema, ownership policies and effective table privileges inspected read-only.
- Existing draft isolation check failed: it shares live data.
- No admin code, migration, role assignment, provider request, financial write or publication performed.

Next dependency: verified isolated remix, then Phase 1 implementation and the above tests; production promotion requires a separate exact-change approval.