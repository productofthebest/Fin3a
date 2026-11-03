# Fin3a Admin — audit and staged implementation

## What the audit established

- The current `/admin` page manages **AI usage, prices, limits and switches**, not financial operations. Its sensitive actions already validate the administrator in the database.
- Customer sign-in and session-cache cleanup already exist. There is no separate admin sign-in, five-role permission model, customer directory, or immutable administrative audit trail.
- The live schema has accounts, account activity and crypto address records with ownership policies. It has no provider events, treasury, settlement, KYC, operational savings or revenue records.
- **Breet and Flutterwave are not integrated.** No API calls, verified payment webhooks or provider settlement readers were found. A saved-key presence check is not proof of connectivity.
- Account balances currently use a maximum of 200 activity entries; this cannot establish a full-history balance. The account activity structure is **not double-entry accounting**. These limitations must be corrected and verified before publishing financial administration totals.
- Personal spending records, confirmed planning balances and savings goals are not payment transactions, provider treasury or interest-bearing savings. Keep them separate.
- Read-only live checks confirmed ownership policies and effective grants. Broad table privileges exist, with RLS restricting customer access; inspect and minimize privileges when introducing admin access. A schema review does not certify actual permission enforcement.
- Audit baseline: **170 automated tests passed across 22 files**. No application code, production settings, customer records, provider requests or paid AI calls were changed. Real admin/provider workflow tests were not performed.

## Boundaries and approvals

- Build a separate Fin3a Admin experience using the existing lavender, white and violet theme, professional tables/charts and a collapsible sidebar. Do not alter customer navigation, screens or working features.
- Retain the existing AI cost controls in the admin workspace and keep the old admin URL working. Do not create new customer profile tables or duplicate wallets, financial records or competing ledgers.
- Display real, currency-specific recorded values with coverage and timestamps. Missing information reads **Unavailable / Not connected**, never invented zeros. Customer liabilities, company funds, treasury and revenue remain distinct; no guessed currency conversions.
- Never directly edit wallet balances. Posting financial adjustments requires authorized, balanced, immutable journal evidence, reason, approvals and retry safety.
- The request mentions crypto conversions, but the saved product scope excludes exchange/trading features. Monitoring externally recorded events may be considered; enabling conversion operations requires separate explicit approval.
- Staging was deleted. This plan does **not** authorize privileged security or payment tests against production. Establish and verify an isolated test environment before security/financial changes; use the current Cloud project for the final approved release, not a replacement production backend.
- Approval of this plan starts Phase 1 preparation and isolated verification. Present the exact proposed production changes and request separate approval before each release. No publication, user role assignments, restrictions or money movement without the applicable approval.

## Phase 1 — admin access and executive overview

1. Add a separate admin sign-in entry using existing account authentication; no public admin registration. Preserve all existing customer sign-in methods and session handling.
2. Introduce server-enforced permissions for **Super Admin, Finance Admin, Operations Admin, Compliance Admin and Customer Support** in protected role records. Map the existing administrator only after an approved rollout decision; never derive roles from editable identity fields.
3. Create the independent sidebar workspace, overview and retained AI usage section. Overview starts with verified registrations and ledger coverage; active/verified/suspended definitions are explicit. KYC, savings, crypto holdings, provider health and treasury remain unavailable until authoritative sources exist.
4. Add append-only audit evidence for sensitive actions, request validation and authorization before privileged reads/writes. Customer support has read-only financial access; delegated roles have only relevant permissions. Sensitive role/configuration changes require fresh verification and audit evidence.
5. Verify guest/customer denial, direct endpoint authorization, each role, logout/cache isolation and admin sign-in on desktop/tablet. Baseline/full regression tests run after each batch.

**Gate:** verified isolated permission and admin workflows plus approved production release; interface creation alone is not completion.

## Phase 2 — customers and wallets

- Paginated customer search by existing display name, email and verified phone; detailed registration, activity and ledger records. Fetch managed identity information only after server permission checks.
- NGN/USD wallet ownership and complete-history balances; correct truncation and verify currency/precision/ownership invariants before trusting totals. Separate spending tracker history from provider payment history.
- Crypto addresses display only real issued addresses and supported networks. Holdings/pending balances require authoritative data, not address existence.
- Account restrictions need an explicit restriction model, reason, audit and enforcement across relevant server actions. Existing AI pause is not whole-account suspension. No restriction controls until those paths are enforced and tested.

**Gate:** authorized customer reads, cross-account denial, complete ledger totals, restrictions and reload verified without production financial writes.

## Phase 3 — provider and webhook monitoring

- Implement Breet and Flutterwave server integrations only against approved enabled services, verified current documentation and separately supplied test credentials. No fee, address, network or connection status guessed.
- Provider monitoring shows verified connection state, supported services, references, fees, deposits/withdrawals, settlements and failures where actually available.
- Create signature-verified, idempotent webhook intake and a sanitized event monitor with processing status, retries and duplicate detection. Never store/display secrets or raw sensitive payloads; never credit from browser claims or unverified events.

**Gate:** provider test-mode round trips, signature rejection, replay/concurrency safety and failure recovery; unavailable services remain disabled.

## Phase 4 — transactions, treasury and reconciliation

- Unified paginated payment history from verified provider events and existing ledger links. Filter by provider, currency/asset, type, status and dates. Allow only supported, authorized provider operations with confirmation and audit.
- Extend the **existing** financial ledger additively with journals and balanced postings; avoid a second wallet authority. Document legacy migration/reconciliation and obtain approval before backfills or changes to balance authority.
- Treasury distinguishes provider-held funds, liabilities, company funds, savings liabilities and unsettled items, without inferred balance ownership or conversions.
- Reconcile provider events, ledger postings and settlements; persist discrepancies, duplicate/missing/mismatched evidence and authorized resolutions. Export permission-scoped reports. Existing statement-scan reconciliation remains unchanged.

**Gate:** balanced postings, currency separation, no double-credit, retries, concurrent operations and discrepancy resolution verified with isolated representative data.

## Phase 5 — savings, analytics, compliance and reporting

- Savings administration waits for an approved real savings product and documented rate/accrual rules; current goals assume no interest and must remain unchanged. No invented interest rate or return.
- Revenue reports use explicitly recorded company fees, provider charges and operating expenses, never customer deposits or wallet balances. Charts identify incomplete coverage.
- Compliance covers authoritative KYC states, documented risk flags, authentication/security events, restrictions and immutable admin action history. Alerts are review candidates, not automatic financial actions.
- Settings control supported currencies/assets/networks, enabled services, limits/fees and notifications under permissions and audit. Rate, financial and legal changes require approved rules.

**Gate:** verified savings rules where supplied, report arithmetic, permissions, audit immutability, export safety, provider checks and full customer regression. Unsupported modules remain explicitly blocked, not certified complete.

## Technical approach

- Use TanStack Start protected admin routes with their own shell; shared root/customer experience remains unchanged. Each content route gets Fin3a-specific metadata.
- Reuse managed Cloud authentication and existing server bearer validation; every protected server handler checks permissions independently of page navigation.
- Keep roles separate from user settings. New public tables require explicit grants, RLS and policies; helper functions precede policies. Tighten privileged execution and scope reads/exports to each role.
- Use additive migrations through the existing migration tool. Do not modify generated integration files manually or managed authentication tables. Stage rollback/disable plans and compatibility checks before promotion.
- Provider logic uses server-only secrets and verified public webhook handlers. Money uses asset-appropriate exact precision, per-asset accounting, atomic transactions and unique provider event identities.
- Add focused tests for each financial/permission rule and isolated backend tests for policies, role changes, audit protection and concurrent financial actions. Unit tests never substitute for real backend/provider evidence.

## Outstanding dependencies and reporting

- Confirmed isolated backend/auth/storage and separate provider test keys; source snapshots alone do not establish isolation.
- Breet/Flutterwave credentials, approved services and documented webhook verification; provider connectivity currently unverified.
- Approval for initial role mapping, sensitive-operation authorization and double-entry rollout; savings/KYC policies and data sources before those operations.
- Keep `docs/master-checklist.md` updated per admin phase with **implementation, automated tests, backend/workflow evidence and blockers separately**. No launch-ready claim or automatic publication.