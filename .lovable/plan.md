# International withdrawals — audit and phased plan

## Audit findings (current code, read-only)

1. **Customer UI and API wiring: missing.** Transfer has an "international" option for non-Nigerian users, but its bank and account fields are disabled placeholders ("coming soon"). No server function, route or Flutterwave call exists for international or mobile-money payouts.
2. **Ledger reservations: NGN only.** `ngn_withdrawals`, `reserve_ngn_withdrawal` and `finish_ngn_withdrawal` (migration 0045) give an atomic hold, idempotency key, release on failure and webhook completion, but they are fixed to NGN, 10-digit NUBAN numbers and Nigerian bank codes. Nothing handles other currencies, mobile money, FX-quoted payouts or reconciliation of partial or reversed settlement.
3. **Beneficiary validation: missing.** `withdrawalInput` only accepts NGN bank fields. Nothing validates IBAN/SWIFT/sort code/routing numbers, mobile-money MSISDN and network, or recipient address/KYC fields, and nothing ties the destination country and currency to the user's wallet country.
4. **Capability checks: documentation only.** `flutterwave-capabilities.ts` lists Flutterwave's published payout countries, but its own comments say merchant approval is not verified. No live check confirms your merchant account is enabled for each route.
5. **Shared blockers (from earlier work):** the `withdrawalsEnabled` lock (fixed-IP relay, IP whitelist, production verification) also blocks all payouts. Non-NGN wallets cannot be funded yet (0048 international deposits is still unapplied), so no balance exists to withdraw.
6. **Tests:** existing tests cover NGN withdrawals, Flutterwave processing, the webhook and capabilities. There are no tests for international payouts.

## Phased plan (no live payouts, no funds moved)

**Phase A — rules and validation (pure code + tests)**
- Route table: country, currency, method (bank or mobile money), required fields and limits. A route is used only if it is both documented and verified for your merchant account.
- Per-route beneficiary validators (IBAN, SWIFT, US routing, UK sort code, GH/KE/UG mobile money, etc.) and a check that the destination currency matches the wallet.
- Unit tests for each validator and for rejection when country and currency don't match.

**Phase B — database (additive migration, needs your approval)**
- New `international_withdrawals` table plus `reserve_international_withdrawal` and `finish_international_withdrawal`. They lock the row, check the balance per currency, enforce the idempotency key, add a hold to the ledger, release it on failure, and keep the history immutable.
- Reconciliation states: pending, successful, failed and reversed. A reversal after success creates a new credit entry for Admin review and never edits existing history.
- The NGN tables and functions stay untouched.

**Phase C — capability verification**
- Admin-only, read-only check of which routes your merchant account allows, saved with a timestamp. Routes that fail or are unchecked stay hidden from customers.

**Phase D — server and UI wiring (stays locked)**
- A protected server function built like the NGN flow: lock first, rate limit, validate, reserve, then send through the payout relay. The webhook gains a separate international branch that re-checks each transfer with Flutterwave.
- The Transfer dialog gets real fields per route, a review screen, the fee and quote shown, and a "temporarily unavailable" state while locked.

**Phase E — verification before activation**
- Flutterwave sandbox tests from start to finish, plus simulated webhook duplicates and failures. Then your approval, fixed-IP hosting and a small live payout per route.

## Decisions needed from you
- Which countries and methods come first (e.g. Ghana mobile money, Kenya M-Pesa, US/UK/EU bank).
- Fees for international payouts.
- Whether 0048 (funding non-NGN wallets) is applied first, since withdrawals need funded balances.

## Technical details
- Keep `withdrawalsEnabled` as the single global lock and add a per-route lock `isRouteVerified(country, method)`.
- Amounts are integer minor units. Currency exponents come from one table (e.g. XOF/XAF/UGX/RWF have 0 decimals).
- Webhook idempotency key per transfer ID, kept apart from NGN events.
- Deployment dependencies: payout relay with fixed IP, `FLW_*` verification flags, whitelisted IP, Flutterwave merchant enablement per corridor, beneficiary KYC rules, and the migration approval.
