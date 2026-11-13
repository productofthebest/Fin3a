# Withdraw and PR #45 reconciliation

## Verified starting point
- GitHub main and this project both point to `4d3c239a6bc9396afa677e427c7a0de55e763b41`; the working tree is clean.
- Signed-in, phone-sized Nigeria Withdraw check: bank selector is enabled and loads 702 entries; account number and amount accept input. No payout was submitted. The final action is intentionally blocked because verified legal-identity matching is not implemented.
- PR #45 remains open and conflicting at `a61fda81f9b36ae03505467bc597f5037f0afaf2`, with comments but no approving review. Authenticated GitHub API access now works.

## Scoped repairs
1. Create `feature/port-pr45-onto-main-international-stack` from the freshly rechecked GitHub main commit, using GitHub API operations. Keep project/main untouched while preparing the branch.
2. Preserve Nigeria's form and identity restriction. Verify bank selection enables account-name confirmation without sending a payout. Do not remove identity checks or activate payments to make submission appear fixed.
3. Port only useful PR #45 improvements onto main's existing foundation: USD/GBP/EUR mapping and strict beneficiary validation, deterministic request fingerprints, F3X relay support, additional provider verification tests and an environment gate layered beneath the existing hard-disabled international gate.
4. Retain exactly one F3X webhook settlement path through `international-withdrawal.server.ts`; never import PR #45's competing settlement stack or migration.
5. Inspect remaining reservation readers and document necessary follow-up. Confirmed source-level gap: wallet overview and internal transfers read `account_ledger` only; QR and Split Bill delegate to that transfer function; USD swaps also read only that ledger. International holds live in a separate ledger. Keep withdrawals disabled; stop for separate approval before modifying shared money-moving database functions.
6. Check applied migration identities before any numbering correction. Do not rename applied migrations, recreate objects, backfill, or apply migrations. Record historical numbering conflicts and use the next free identity only if a separately approved future migration is needed.

## Intended files
- New `src/lib/international-payout-mapper.ts` and its test file.
- Existing `src/lib/international-withdrawal.server.ts` and `.server.test.ts` only for verified reconciliation improvements.
- `src/lib/withdrawal-production.ts` and focused gate tests.
- `src/lib/payout-transport.server.ts`, `payout-relay/server.mjs`, and relay tests.
- `AGENTS.md`, `roadmap.md`, `docs/master-checklist.md` for decisions, evidence and outstanding safeguards.
- No NGN payment logic, wallet-card redesign, country eligibility, secrets, production flags or schema changes.

## Verification and review
- Run relevant unit/security tests, NGN regressions and relay tests on the isolated branch's source. Report actual results and failures, not presumed success.
- GitHub CI provides branch build/type/lint results; do not claim those passed until observed.
- Open a new draft PR for independent review. Do not merge, close #45, deploy, publish or send funds.
- Report exact changed files, branch/commit/PR, checks and whether preview contains the changes (it will remain on main until explicitly synced).