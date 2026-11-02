# Complete Fin3a Phase 4

## Outcome
Finish the existing financial intelligence features without rebuilding Fin3a, changing its approved appearance or replacing OpenAI, Termii or sign-in methods. Keep recorded cash flow separate from a confirmed balance and keep all calculations currency-specific.

## 1. Integrate the existing Phase 4 work
- Incorporate the ready “Phase 4 completion and isolated verification” draft, preserving newer main-app changes: direct OpenAI scanning, account-cache clearing and document security checks.
- Review and test the integrated result against the original Phase 4 brief; do not treat draft acceptance as completion.
- Keep all production financial records intact. The existing draft uses the live database, not an isolated test database; do not add synthetic accounts or records there.

## 2. Complete forecasts, simulations and affordability
- Store user-confirmed balances with currency and confirmation date; never derive them from recorded net cash flow. Disclose stale confirmations.
- Save user-owned scenarios and calculate their results on the server using eligible recorded history and at least three complete historical months.
- Support income loss/additions, expense changes, purchases, savings contributions and budget changes, with baseline/scenario cash flow, spendable balance, savings and runway.
- Separate transfers to savings from spending and distinguish earmarked savings from total funds.
- Provide an explained affordability estimate using a confirmed balance, history and explicitly confirmed additional commitments; do not count existing expenses twice. Return insufficient information when required inputs are missing.

## 3. Complete goals and explainable insights
- Add owned goals with target amount/date, contribution frequency and explicitly recorded contributions. Support editing and deletion, progress, remaining target, suggested contributions and estimated completion where calculable.
- Add an insights view for spending/income changes, recurring patterns, potential duplicates, savings opportunities and cash-flow pressure. Every insight identifies its evidence, period, assumptions and an action to consider; missing history is not proof of zero spending.
- Preserve existing navigation destinations and add only the access needed for these views.

## 4. Extend the existing assistant
- Retrieve all relevant owned records with stable pagination; eliminate truncated historical totals.
- Supply deterministic period/category comparisons, confirmed balance, goal calculations, insights and forecast results through aggregate-only context. Never send statement files, descriptions, notes or references to the assistant.
- Use owned stored conversation history rather than trusting fabricated client assistant replies.
- Exercise all seven original questions: last-month spending, largest category, ₦500,000 purchase, balance runway, annual transportation spending, increasing expenses and monthly goal savings. Verify numeric answers or the precise missing-input question, not merely successful responses.

## 5. Finish scanner integrity
- Preserve original private documents and mandatory review-before-import.
- Atomically import each reviewed draft at most once, including concurrent/repeated approval. Preserve currency and explicitly reviewed classification/category.
- Reject missing/invalid dates and currencies rather than inventing today's date or assuming the preferred currency. Keep unresolved lines pending.
- Match duplicate candidates using currency, direction, amount, date and reference/merchant evidence; never silently remove legitimate transactions.
- Expose currency/classification/category corrections, prevent edits to finalized drafts and show per-currency totals instead of combining currencies.
- Bound extraction and prevent simultaneous rescans from overwriting review work or repeating paid requests unnecessarily.

## Technical approach
- Retain TanStack Start, existing authenticated server boundaries, shared financial calculation modules and generated Cloud clients.
- Use additive schema changes with plain user UUIDs, strict owner policies/grants and no profiles table. Keep persisted balances/scenarios/goals currency-specific.
- Record architecture decisions and keep a truthful verification report and roadmap.

## Verification and completion gate
- Run existing regression tests and add concrete calculation, goal, affordability, persistence, import-idempotency and authorization tests.
- Verify signed-in create/edit/reload/delete flows, forecast/scenario comparisons, reports, insights and scanner review/import on phone, tablet and desktop screens.
- Reconcile stored transaction totals, charts, category reports and assistant outputs; verify two-account isolation and concurrent duplicate-import protection.
- Use synthetic saved records only after verifying a genuinely separate nonproduction database. The currently shared live database cannot satisfy that test gate; unit fixtures alone do not establish saved-data correctness. If isolated testing cannot be supplied, report that blocker instead of claiming Phase 4 complete.
- Real financial document extraction needs authorized financial documents; the prior nonfinancial image check does not establish statement accuracy.
- Final report separates implemented features, passing checks, failures, integration status and remaining external requirements. Real Termii delivery remains separately unverified.

## Existing security findings
The completed deep review flagged public paid chat/transcription abuse risks, phone-code disruption, client-controlled conversation roles and unreliable transaction-search filtering. Keep these in the Phase 5 remediation list; address the authenticated conversation issue during Phase 4 context work. Do not claim launch readiness or silently remove the public assistant.