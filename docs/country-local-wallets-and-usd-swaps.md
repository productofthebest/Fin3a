# Country-local wallet deposits and local-currency/USD swaps

## Product behaviour
- A user's wallet is provisioned from their verified ISO country setting.
- Countries whose national currency is USD (including the US) see one USD wallet only.
- Every other country sees exactly two fiat wallets: its local currency first and USD second.
- A local-currency deposit credits only the local wallet. A USD deposit credits only USD. Never silently convert a deposit.
- The swap screen offers local-to-USD and USD-to-local directions for every non-USD local currency.
- The US has no duplicate local/USD wallet and no same-currency swap.

## Current implementation audit (2026-11-06)
- `src/lib/country-currency.ts` already contains a broad ISO country-to-currency map and `accountCurrencies()` provisions local + USD (USD-only where local currency is USD).
- `getAccountsOverview()` creates the expected accounts idempotently and displays them in local-first order.
- `src/lib/accounts.ts` still restricts `AccountCurrency` and the swap calculator to NGN/USD.
- `executeSwap()` calls a database RPC that accepts only NGN/USD.
- `drizzle/migrations/0028_currency_swap_fx_rate.sql` stores only one admin-managed NGN/USD rate. It cannot safely price other currency pairs.
- The wallet swap dialog is explicitly disabled and shows an NGN-only limitation.
- The current deposit flow is not a generic international fiat deposit adapter. PR #5 adds country capability metadata only; it does not yet charge or settle foreign-currency wallet deposits.
- Existing tests cover NGN/GHS/USD wallet visibility but not a generic multi-currency swap or deposit settlement.

## Required implementation

### 1. Currency and account model
- Keep the country-to-currency map as the single source for local wallet provisioning.
- Validate and normalize country/currency codes on the server. Do not fall back an unknown country to NGN for a money movement operation; require a valid country/currency or keep payment actions unavailable.
- Preserve existing account IDs, balances, ledger rows, transfers, split bills, QR flows, and user history.
- Provision accounts idempotently by (user_id, currency). Never create a second USD wallet for USD-local countries.

### 2. International deposits
- Resolve the user's country and local currency server-side; the client must not choose an arbitrary credit currency.
- Build a provider capability lookup that independently verifies country, collection method, presentment currency, settlement currency, merchant enablement, limits, and KYC eligibility. Collection support alone is not proof that a merchant can settle in that local currency.
- Create a pending deposit intent with immutable currency, country, provider, provider reference, exact amount, fees, and idempotency key.
- Send the provider charge request only for a verified supported combination. If unavailable, do not show a working deposit method.
- Verify the provider event independently (signature/authenticity, amount, currency, merchant/account, reference, final settled status) before one-time ledger credit.
- Credit the wallet matching the verified deposit currency only. Never trust a browser redirect or client-supplied status. Make webhook processing idempotent and reconcile charge/settlement/refund/reversal states.
- Keep unsupported currencies visible as wallet balances if desired, but disable deposits with a clear explanation until a real rail is enabled.

### 3. Generic FX quotes and swaps
- Replace the single NGN/USD assumption with a server-owned currency-pair quote model. A quote must identify source currency, destination currency, rate, source amount, fee, destination amount, provider/source, quote ID, creation/expiry, and rounding precision.
- Obtain executable rates from an approved FX/liquidity source or an explicitly managed and audited rate feed. Do not derive rates from a hardcoded default, the user's display currency, or stale values.
- Quote endpoint must authenticate the user, enforce pair allow-lists and limits, and calculate fees/rounding server-side. Client may display but never set the rate or destination amount.
- Confirmation must submit a quote ID and idempotency key. Server revalidates ownership, expiry, available source balance, fee, limits, and provider liquidity.
- Execute source debit and destination credit atomically in one database transaction with immutable quote/fee snapshot and paired ledger entries. Lock both accounts in a deterministic order to prevent concurrent double-spend/deadlock.
- Reject stale/expired quotes, unsupported pairs, zero-rounded output, insufficient funds, unavailable liquidity, and repeated/invalid requests. A failed swap must not debit funds.
- Do not enable a pair until provider settlement, reconciliation, refund/reversal, and failure paths are verified in sandbox.

### 4. Admin and operational controls
- Admin may enable/disable each country collection rail and currency pair only after account capability is verified.
- FX source, pair rate, spread/fee, limits, quote TTL, and enablement changes require admin authorization and append-only audit records. Existing quotes retain their original snapshots.
- Admin views must show pending, completed, failed, reversed and reconciled totals by currency; never add unlike currencies into a single total without a clearly labelled conversion and rate.
- Keep secrets server-side and keep all customer balance changes in the ledger/RPC boundary.

### 5. UI
- Wallet cards: local currency first, USD second; US and any USD-local country: USD only.
- Deposit: show the currency the provider will actually charge/settle, all fees, and exact wallet to be credited before confirmation.
- Swap: local ↔ USD selector, source amount, live quote/rate, fee, provider/network charges, destination amount, expiry countdown, and explicit confirmation. Disable confirmation without a valid unexpired server quote.
- Refresh wallet balances and activity after verified settlement. Do not show uploaded statement documents as wallet activity.
- Admin country/currency settings must reflect the same server capability source; UI toggles cannot override provider or compliance restrictions.

## Acceptance tests
- Country provisioning: NG => NGN + USD; GH => GHS + USD; GB => GBP + USD; US => USD only; all currencies represented in the country map follow the same rule.
- Country changes affect wallet visibility/provisioning without deleting or rewriting existing balances/history.
- A local NGN deposit credits NGN only; a local GHS deposit credits GHS only; USD deposit credits USD only.
- Unsupported country/method/currency, mismatched amount/currency/reference, unverified webhook, pending charge, expired quote, stale quote, and duplicate webhook/confirmation never credit or debit a wallet.
- Generic pair tests cover USD/local and local/USD for at least NGN, GHS, GBP, EUR, KES, ZAR, and XOF with explicit precision and rounding.
- Concurrency tests prove no double-spend; failed swaps roll back both ledger legs; idempotent retries return the original result.
- Regression tests cover account transfers, split bills, QR, crypto deposits, existing NGN/USD customers, and USD-local users.

## Release gates
- This is not permission to move live customer funds. Keep international fiat deposits and non-NGN/USD swaps disabled until provider merchant enablement, FX/liquidity source, sandbox end-to-end evidence, reconciliation, and legal/compliance review are documented.
- Do not deploy to Railway or sync/merge into the Lovable production project as part of this work.

## Implementation progress (2026-11-06)

- Added `src/lib/flutterwave-webhook.server.ts` with exact `verif-hash` shared-secret validation using constant-time digest comparison, plus unit tests for missing, incorrect, modified, case-changed and oversized values.
- Added `src/lib/flutterwave-transaction-verification.server.ts` to verify provider transaction ID, immutable pending reference, exact amount, currency and final successful status through the authenticated fixed-origin relay, plus mismatch tests.
- Extended the server-only relay transport allowlist to permit only the fixed numeric transaction-verification path.
- This remains verification groundwork, not a live webhook route or wallet settlement. The authenticated HTTP webhook handler, pending international deposit table, atomic idempotent credit RPC, event replay protection and reconciliation are still required. No wallet is credited by these helpers.
- Added `src/lib/fx-quotes.ts` with currency-pair validation, explicit destination-per-source rate arithmetic, source-currency fee deduction, configurable decimal precision, and zero-output rejection.
- Added `src/test/fx-quotes.test.ts` for NGN, GHS, GBP, EUR, KES, ZAR and XOF examples, reverse direction, fee handling, precision and invalid inputs.
- This is calculation-only groundwork. It does not provide a live rate, quote ID/expiry, pair allow-list, liquidity check, atomic ledger execution, or deposit settlement. It must not be used to enable customer swaps until those controls are implemented and verified.
- The authenticated fixed-origin Flutterwave transaction-verification relay was merged to `main` in PR #6. PR #7 carries the webhook hash and application-side evidence-verification helpers; it remains separate from deposit settlement and does not authorize live collection.
