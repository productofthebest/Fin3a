# Fin3a — Staging-first AI security and cost verification

## Scope and production boundary
Prepare an isolated staging copy, close the assistant history vulnerability, finish missing cost safeguards, and verify all requested controls with real paid requests. Preserve the current design, working sign-in, financial accuracy and existing user records. No application, database, price or AI-switch changes in production until a separate production proposal is approved.

## Current findings
- All 146 existing automated tests pass across 17 files; paid-use enforcement has not been verified.
- Daily AI requests and daily/monthly scans have admission logic, but monthly AI request caps are missing.
- Budget checks count finalized estimated cost only; simultaneous in-flight calls can pass without reserved cost. Unknown pricing/usage is not safely covered.
- Daily warnings are emitted; monthly warnings and visible delivery across all features need verification.
- Assistant model input trusts browser-supplied prior turns. Persisted messages are also directly writable by their account owner, so loading those rows alone would not fix provenance.
- Separate staging backend/auth/key remain unverified. A draft previously shared production; no test data was written.

## 1. Establish isolation — blocking gate
The owner creates **Fin3a Staging** through the project menu and mentions it here or continues in its chat. Independently verify its backend, storage and auth differ from production before any writes. Configure staging-only auth callbacks, email confirmation and a separate securely saved OpenAI project key. Never copy production users, records, sessions or keys. Stop on ambiguous isolation.

The staging setup guide includes exact pricing entry instructions and the real-use test matrix. Correct text/cached/output rates come from the official pricing page; voice requires its actual modality units, not a guessed blended rate.

## 2. Assistant history security fix — staging first
- Accept only a bounded new user turn as authoritative input; ignore browser-supplied prior context, preserving the chat client's transport compatibility.
- Retrieve bounded, ordered, owned history with verified server provenance; keep server instructions separate.
- Prevent direct client creation/editing of assistant or system messages and prevent message-ID collisions from rewriting a different turn. Authorize ownership before privileged server writes.
- Treat legacy history conservatively: display existing conversations without rewriting user financial records, but exclude unverifiable old turns from authoritative model context. Inform the owner of this compatibility limitation before promotion.
- Test forged roles/history, direct database writes, cross-account threads, retries, stream persistence and normal multi-turn conversation.

## 3. Finish cost safeguards — staging first
- Add default and per-account monthly request caps and admin controls, without guessing a production default. Retain existing daily and scan controls.
- Deliver the 80% warning for daily and monthly request/scan dimensions to the relevant page.
- Introduce globally atomic budget admission with conservative per-call cost reservations and per-user atomic quota admission. Price each endpoint/modality correctly and fail closed for missing required prices.
- Bound provider work/output, reconcile real reported usage, retain uncertain liabilities for unknown outcomes, and test safe stale-request recovery. Do not equate an expired request with no provider charge.
- Preserve failed-scan quota behavior while accounting for any actual provider cost. A multi-part scan remains one document quota unit but reserves enough for all paid parts.
- Define effective shutdown/suspension as blocking new admissions; already-dispatched calls may finish and remain billable. Report the cutoff explicitly.

## 4. Real-use verification after staging is operational
Use low caps of 5 to test success at the limit, rejection beyond it, and warning at 4/5 (80%). Test daily/monthly requests and scans independently; daily/monthly budgets; account pause/restore; global shutdown/restore; duplicates, failed/aborted calls; 10 competing requests with one slot left; and competing accounts near the global budget. Verify blocked calls never reach OpenAI. Read results back through the UI and usage records and compare provider usage.

Resume document verification only after the isolation gate: representative anonymised statements, receipts, invoices and deposit slips; long PDFs, reconciliation, duplicate boundaries, all-or-nothing failures and review/import ownership. Synthetic staging samples supplement tests but never certify real-document accuracy.

Run the full existing automated suite and affected regression workflows after every implementation batch. Keep implementation status, unit/integration/workflow/real-world evidence and dependencies separate in the master checklist.

## Assumptions and decisions requiring approval
- Quota windows remain UTC calendar days/months; actual rollover is verified separately from a low-cap test.
- Short nonfinancial prompts and low staging limits minimize test spend. No paid tests run until staging identity and a safe total test-spend ceiling are verified.
- Exact production monthly defaults, hard-budget reservation policy and any acceptable overshoot require an explicit financial-risk decision before promotion; never silently choose them.
- Voice budget accuracy is blocked on correct modality accounting; price entry alone does not fix it.
- Approval of this plan authorizes preparation and implementation in confirmed isolated staging only. Production promotion needs its own reviewed diff, migration/rollback proposal and approval.

## Technical details
Change targets: `src/routes/api/chat.ts`, shared assistant history validation/storage, chat-message write grants/policies, AI settings/usage RPCs and shared admission helpers, modality-aware usage accounting, Admin and warning consumers. Use additive reviewed migrations in staging, authenticated ownership checks, server-only OpenAI keys and bounded Worker-compatible handlers. Do not edit generated integration files or seed test rows into migrations. Test fixtures stay test-runner-only.

## Deliverable and remaining dependencies
Provide evidence for each of the twelve requested priorities and an updated master checklist; cost management stays incomplete until real-use verification passes. Dependencies: owner-created independent staging project, staging-specific OpenAI key, official rates, representative anonymised documents, and approved test-spend ceiling. Nothing will be deployed by this plan.