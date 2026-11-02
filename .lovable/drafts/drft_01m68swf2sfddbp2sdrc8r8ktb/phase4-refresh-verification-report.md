# Phase 4 draft delivery and verification

## Status
Implementation is staged, **not Phase 4 complete**. Main's November 2 Phase 5 reliability work is retained under the user's explicit authorization; it does not certify Phase 4 completion.

`drafts.list` positively identified this draft as sharing the project's live database. Cloud status was healthy. Neither establishes isolation. No synthetic accounts, financial rows, document uploads, balances or messages were written to the live backend. No schema migration was executed. Fixtures exist only as test source under `src/test/fixtures`, with no seed statements in any staged migration.

## Implemented
- Dated, currency-specific user-confirmed available balances with explicit coverage; same-day confirmation required for current balance assessments. Older confirmations are retained, not rolled forward from incomplete ledger history.
- Saved scenario inputs; protected server calculations retrieve the user's eligible history. Monthly income/spending changes, income loss, one-time purchase, savings contributions, budget replacement, baseline/scenario cash flow, spendable balance, savings and runway.
- Explicit commitments with currency, due date, settlement, matched transaction and history-coverage state. Only unmatched/unsettled commitments not represented in averages are reserved once.
- Affordability estimate using confirmed cash, eligible history, explicit commitments and projected runway; missing inputs return insufficient information. No guarantees.
- Stored goals with amount/date/frequency/planned contribution and separately recorded progress. Remaining amount, contribution schedule, upward-rounded suggestion, overdue state and completion estimate.
- Dedicated evidence-backed insights for spending/income changes, category increases, recurring category evidence, duplicate flags, cash-flow pressure and potential surplus. No fabricated causal explanations.
- Aggregate-only assistant additions cover the seven original examples: last-month spending, leading category, 500,000 purchase, current runway, year-to-date transportation categories, increases and goal contribution. Existing OpenAI key/model and saved conversations retained. For other purchase amounts the assistant directs users to the protected assessment form.
- Full stable pagination for dashboard, assistant totals and analysis. Query errors reject partial totals.
- Scanner content-based document recognition through existing OpenAI, content fingerprint, no inferred spreadsheet currency, editable currency/classification, explicit review, original signed reference, concurrent scan claim, reviewed-only import eligibility and pending-only edits.
- Staged import RPC serializes each user's concurrent imports, detects exact currency/type/date/amount/reference-or-merchant candidates, preserves import identity, tracks imported transaction IDs and updates document state atomically. Duplicate candidates remain pending for review rather than being deleted or counted.

## Schema awaiting acceptance
Three staged additive migrations create confirmed_balances, financial_commitments, saved_scenarios, financial_goals and goal_progress; every table includes explicit grants, RLS and user-ownership policy. Users are plain UUIDs, no profiles or managed-auth changes. Scanner adds classification/review/import identifiers and replaces the import RPC; validation triggers guard dates/ownership/nonfinite values.

New-schema pages/assistant/scanner cannot be exercised here before acceptance. No fake preview rows or missing-table fallbacks were introduced. Planning/Goals/Insights route error states explain that acceptance is required; the existing dashboard and analysis remain usable.

## Verification performed
- **Post-refresh suite: 130 passed, 0 failed across 14 test files.** Final automated preview build: OK. The original draft's 98 checks and main's additional regressions are retained, with one added content-based document recognition check.
- All original selected tests retained.
- Added 52 financial rule tests covering confirmed/missing/stale/foreign currency balances, zero cash/spending, negative net/runway, income loss, savings allocation conservation, budget override, explicit commitment matching, all excluded classifications/statuses/currencies/flags, history insufficiency, affordability, goals and all seven assistant aggregate evidence paths, pagination and scanner recognition/review rules.
- One owned-pagination integration mock verifies 1,001 rows and UUID scope on every page with stable tie-break ordering.
- Two form interaction tests verify explicit balance/coverage submission and goal amount/date/frequency; these use in-memory server stubs and are **not** database E2E.
- Browser read-only checks: signed-out /dashboard redirects to /auth; owner's existing dashboard and /analysis load; balance caveat remains; 393px analysis has no page overflow; no browser page errors. Owner has no financial records, so numeric production reconciliation is not claimed.
- Earlier development errors: scanner syntax and missing browser ResizeObserver in form test. Both corrected and rerun successfully. Latest automated preview build check is OK.
- Read-only staged-security audit identified reverse parent/child lock deadlock risk and unchecked deletion of stale drafts. Removed the reverse parent row lock from the draft trigger and made extraction fail on draft-replacement errors. Database concurrency validation remains blocked until an isolated backend exists.

## Numeric reconciliation (in-memory synthetic fixtures only)
June first partial month excluded; July–September each income 500,000 / expense 300,000 NGN. Average income 500,000, spending 300,000, net 200,000. Confirmed cash 1,000,000 → six-month baseline 2,200,000. Monthly savings 100,000 → spendable balance 1,600,000 plus savings 600,000, preserving 2,200,000 combined. A single additional 100,000 commitment reduces six-month baseline once to 2,100,000. Income loss of 500,000 gives −300,000 monthly net and 3.3-month estimate. 500,000 purchase leaves 500,000; 1,100,000 purchase is unaffordable. Goal 1,000,000 with 400,000 actual progress leaves 600,000; six monthly slots suggest 100,000 and estimated completion 2027-04-30. Year-to-date Transportation total includes June and equals 1,000,000.

## Blocked required gates
- Actual isolated backend provisioning and migration execution.
- Two synthetic authenticated accounts and live RLS denial/read-isolation tests.
- Stored transactions → dashboard/analysis/server forecasts/runway/affordability/goals, persistence/reload and currency reconciliation.
- Six document image/PDF extraction flows, duplicate detection against saved rows, concurrent/retry import RPC and original reference verification.
- All seven real OpenAI responses, stored conversation reload, voice and privacy/isolation verification.
- New saved-feature desktop/mobile rendered interaction E2E. Form mocks do not replace this gate.

These are infrastructure-dependent blockers: the available draft backend is live/shared, and the user's authorization expressly excludes live test writes. No claim of completion can override this restriction.

## Acceptance handoff to main
1. Review code and staged migrations. Accept this draft only when ready to apply real saved-feature schema; acceptance applies additive schema and code to main, not synthetic rows.
2. Do **not** manually apply staged migrations in this draft or create synthetic accounts here.
3. For the full test gate, first provide/verify an isolated nonproduction backend. Run staged schema and synthetic E2E there; fixtures must stay out of migrations and live data.
4. Keep Phase 4 pending until all blocked gates pass. After acceptance recheck real-user pages without introducing synthetic rows, then publish only on explicit instruction.

**Test data merge assurance:** only fixture source files merge as test code. No test database records exist to merge; no seeds, data copying or migrations containing sample financial rows were created.

External issues: isolated backend required; FIN3A Termii sender approval/real owner SMS flow remains separately unverified; existing OpenAI quota/key remains unchanged. No new paid provider was added.

## November 2 refresh reconciliation
All 28 draft-only paths were restored using the draft reconciliation CLI. Five overlapping files were manually combined: AGENTS.md, roadmap.md, src/lib/documents.functions.ts, src/routes/_authenticated/assistant.$threadId.tsx and src/routes/_authenticated/documents.tsx. Verification reports no dropped paths; these five hand merges require human review by design.

Main's direct OpenAI Responses helper, safe provider errors, storage-disabled requests, upload metadata/content/ownership validation, safe document deletion, account-cache isolation, assistant camera/voice controls and Phase 5 roadmap remain intact. The draft's document recognition schema now extends main's direct helper. The draft's alternative SDK extraction implementation is intentionally superseded by main's direct helper, retaining gpt-5-mini, document recognition and classification review. Main's separate post-import status write is intentionally superseded by the staged atomic import RPC, which updates document status inside the import transaction.

No database data or schema was changed during reconciliation. No synthetic rows exist to merge. Live saved-feature/scanner E2E remains blocked on the same isolated-backend and staged-schema prerequisites; the 130 passing checks are not a substitute for that gate.