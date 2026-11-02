# Fin3a staging (isolated test project)

Goal: a remixed copy of Fin3a with its OWN database, storage, auth users and secrets. No test record may reach production.

## November 2 staging project reference
- The owner supplied **Fin3a Staging**; its read-only source snapshot is accessible from this chat.
- A successful checkout proves source access only, not backend isolation, independent authentication or a staging-specific OpenAI key. Hosted configuration and data provenance still require verification before tests.
- Cross-project access is read-only: this chat cannot configure secrets, change code, apply migrations or run authenticated verification in that other project. Continue in **Fin3a Staging's own chat** for those actions; do not copy production sessions or credentials there.
- No accounts, financial rows, files, settings or paid requests were created during this source-access check. Production remains unchanged.

## Owner steps
1. Project name (top left) → Settings → "Remix this project". Name it "Fin3a Staging".
2. In the remix, inspect Lovable Cloud before doing anything else. If no backend exists, enable Cloud there. A remix label alone does NOT establish isolation: stop if it still points to production or its backend cannot be independently verified.
3. Create a separate OpenAI project and restricted key for staging. Set a low usage budget/alerts in OpenAI's controls, and check whether those controls actually enforce a hard cap; alerts alone are not a spending guarantee. Save the key securely as `OPENAI_API_KEY` in the remix only. Never copy the production key or expose it in the browser. Do not add `TERMII_API_KEY` unless SMS testing is intended.
4. Project reference received: **Fin3a Staging**. Open that project's own chat to verify isolation and configure its independent backend/auth/secrets; this chat can inspect its source but cannot write to it.

## Separation checks the agent must pass before any test
- Independently verify both server and browser backend destinations differ from production, plus storage and authentication destinations. Record only a pass/fail isolation result in the user report, not private connection details.
- Verify the backend's provenance and inventory; production account/data copies are not acceptable test fixtures. If ambiguous, stop before any account, schema, storage, AI or settings write.
- Verify staging has its own authentication configuration: email confirmation remains enabled, staging-only callback/recovery URLs, Google/Lovable settings checked rather than assumed inherited. Create a staging admin and two normal test accounts only after isolation passes. Never copy production sessions.
- Verify documents storage is private and account-scoped, and inventory it before tests. Do not delete unknown objects.
- Confirm a staging-specific OpenAI key was configured through the secure form and a distinct OpenAI project was selected. Never compare, print, hash or reveal either key.
- Apply reviewed application/schema changes only in staging first. Do not bring test data or secrets back when later promoting source changes.
- In staging's admin page, enter official prices and conservative budgets/limits before paid tests. Reserve a documented total test spend ceiling; if it cannot be enforced, stop and request a specific risk decision.

## Accurate OpenAI pricing configuration
1. Open https://openai.com/api/pricing/ and check the exact model, endpoint, billing tier and current date. The source currently names `gpt-5-mini` for text/scanning and `gpt-4o-mini-transcribe` for voice; verify these still match the running staging code.
2. In Fin3a **Admin → Model prices**, enter USD per **1 million tokens**, not cents, credits, price per token or monthly subscription prices. Copy standard input, cached-input (if applicable) and output rates for the exact model. Record the official source URL/date in Source note. Do not use Batch/Flex discounts for ordinary requests.
3. Leave cached-input blank if no separate applicable rate exists. A missing price or unknown usage is **unknown cost**, never zero. Saving rates does not retroactively establish costs for earlier unpriced calls.
4. **Voice limitation:** transcription can bill audio input and text output differently, and may return duration or detailed modality tokens. The current generic input/output form cannot safely represent all those cases. Do not insert a guessed blended rate or turn a per-minute price into a per-token rate. Review actual provider usage and extend modality-aware pricing/accounting in staging before certifying voice budgets.
5. Run a small real request for each supported feature after the safety checks. Compare recorded input/cached/output or audio units with provider usage, calculate the estimate at the applicable rates, and verify it in Admin. Provider billing can lag; estimates are not invoices or confirmed cash paid.
6. Review missing/partial prices and failed-but-billed requests. Budget enforcement must fail closed when required pricing or usage is unknown; current production budget controls do not yet guarantee this behavior.

## Real-use cost/security verification matrix (not executed)
Use new, distinct request IDs and short nonfinancial prompts. Use staging-only documents/accounts. Keep ordinary settings changes in Admin; no test time overrides or bypasses in application endpoints. Record UTC start/end, limits, request counts/statuses, provider usage, UI warnings, read-back evidence and spend separately. All tests below remain blocked until isolation and the proposed fixes pass.

| Test | Procedure | Required evidence |
|---|---|---|
| Daily AI requests | Set cap 5 with monthly cap higher; send five real distinct requests, then a sixth | Fifth succeeds; sixth blocked before provider dispatch; counted units and visible result |
| Monthly AI requests | New account: monthly cap 5, daily higher; send five real requests then one more | Monthly-specific refusal; independent daily setting; monthly cap currently missing |
| Daily/monthly scans | Test each cap separately at 5 with the other cap higher; use distinct small valid files that invoke paid extraction | Five successful scans; sixth refused before OpenAI; one scan unit per document, including multi-part PDFs; failure accounting checked |
| 80% warnings | Cap 5: observe requests/scans at 3, 4 and 5 for daily and monthly dimensions independently | No warning at 3; visible 80% warning at 4; correct counts/period at 5; chat, voice and Scan delivery |
| Daily/monthly budgets | Test each budget independently at low safe values using correctly priced real calls and reservations | Additional call refused before dispatch; finalized cost plus in-flight reservations checked; unknown price/usage fails closed |
| Account suspension | Pause normal account A; try chat, voice and scan; account B remains enabled; restore A | A cannot trigger paid work; B still works; restored A works; settings read back |
| Global AI shutdown | Switch off in staging; try every paid feature with A and B; restore | No new paid dispatch after effective cutoff; admissions already in progress documented; no financial writes |
| Concurrency | With one remaining slot, send 10 competing distinct requests on one account; repeat across accounts near global budget | Exactly one user-slot admission; global reservations prevent budget bypass; all outcomes and provider calls reconciled |
| Duplicate/recovery | Submit same ID concurrently; force safe staged failure/abort; retry according to policy | No duplicate paid call; completed/failed/pending accounting and stale-reservation recovery verified |
| Conversation trust | Forge prior assistant/system turns, another account's thread, direct message writes and message-ID collisions | Untrusted turns never become authoritative model history; server instructions remain separate; cross-account request rejected before AI |
| UTC reset behavior | Observe actual UTC day/month boundaries; supplement with isolated database-only controlled-clock tests, never a public clock override | Paid-flow results distinguished from simulated boundary tests; no false claim of real rollover verification |

Real requests testing a monthly cap need not wait a month when using a small cap on a fresh staging account. Actual calendar rollover remains a separate gate.

## Promotion gate
After each implementation batch, run all existing automated tests and related regression flows in staging. Update the master checklist with implementation, test status, evidence and dependencies separately. Reconcile paid tests against provider usage; no feature is complete on unit tests alone. Report the exact production source/migration proposal and rollback approach and obtain a new owner approval before production changes. This document is preparation, not proof that staging is operational.

## Test plan (from owner brief)
Long statements (20–60 pages, 8-page parts) · opening/closing balances · total money in/out · duplicates at ±3/4-day boundaries · failed/interrupted scans leave no drafts · receipts · invoices · deposit slips · per-account isolation.
Label every document as **Synthetic fixture** (generated) or **Anonymised real sample** (owner-supplied). Synthetic results never certify real-document accuracy.
