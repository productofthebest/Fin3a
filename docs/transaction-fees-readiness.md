# Fee and revenue implementation report — 4 November 2026

## Implemented
- Exact integer-minor-unit fee arithmetic, two-decimal fiat outputs and half-up fee rounding; reject invalid precision/nonpositive final payout. Withdrawal fees reduce payout.
- Launch defaults: crypto sell/withdraw USDT/USDC 1% below USD 5,000, 0.5% from USD 5,000; eligible crypto swap 0.1%; NGN withdrawal 50; supported deposits and internal services free. Existing owner-rate fiat swaps unchanged.
- Additive migrations 0029/0030: versioned admin settings with expected-version concurrency guard, retry keys, immutable audit history; quote snapshots with account/currency identity checks; append-only revenue events with verified-success, same-transaction adjustment, duplicate lifecycle and cumulative reversal guards. Explicit grants and RLS; no role expansion or balances changed.
- Admin Revenue & fees: NGN/USD totals, dates/provider/service filters, daily/weekly/monthly/annual chart preparation, service breakdown, versioned fee editor with review confirmation, history, CSV/Excel exports and free internal usage.
- Full paginated account ledger read replaces 200-row balance truncation; providerConnected stays false rather than treating a key as connectivity evidence.
- Revenue estimates/pending/earned/settlement remain distinct; volume is not revenue. Quote and revenue tables are empty, with no generated financial rows.

## Verification
- 254/254 tests across 30 files passed, including 41 fee/revenue tests: free deposits, tier boundaries for both assets, separate charges, zero net rejection, unsupported withdrawal asset, included commission prevention and NGN/USD accounting.
- Preview build OK after strict type fixes.
- Signed-in owner `/admin-revenue` loaded real launch defaults and empty event totals; edited NGN 50 to 51 only through review, then cancelled. No setting saved. Confirmation and CSV download verified; no runtime errors or mobile overflow. Desktop and phone screenshots inspected.
- Schema existence verified through read query. Schedule read verified through authenticated UI; an unrestricted database-tool schedule call was denied as expected by grants.
- Fee-save/readback, nonadmin RPC, concurrent saves, database lifecycle/reversal tests, nonempty accounting reconciliation, Excel file contents and real provider flows remain unverified. No isolated backend available; no test rows inserted into production.

## Unsupported/deferred work
- No Breet/Flutterwave adapter or provider API calls added. No automated credit/debit/fee collection activated.
- Per-deposit NGN/USD instructions and quote summaries await business capability validation. The account-wide selector, read and server setter were removed at the owner's 20:00 UTC follow-up. Legacy settings data is retained and marked deprecated, never used for deposit destination.
- Public Breet docs describe wallet currencies and stablecoin withdrawals; account rights, authenticated webhook verification, crypto-to-crypto swaps and commission-sharing terms remain unconfirmed.
- Agreement commission configuration/reconciliation, detailed crypto status/network/asset reports and recorded-rate consolidated exports are not implemented yet. Do not claim a complete revenue engine or all brief requirements fulfilled.
- Trusted provider writers must use the exact fee calculator and immutable snapshots, verify quote/settlement/lifecycle and atomically coordinate existing ledger writes before enabling money movement. Current schema is a protected foundation, not an operational payment authority.

## External blockers and activation gate
20:02 UTC follow-up verification: no Breet secret or connector configured; source has no provider adapter. Signed-in desktop/393px Accounts confirms no permanent currency chooser, Deposit disabled and both balance cards retained, with no page errors/overflow. All 254 tests passed; preview build OK. No financial data changed. Actual receiving-currency options/rates/instructions/settlement cannot be enabled or end-to-end tested until these provider dependencies are supplied.

Approved provider business credentials/services, actual commercial terms, authentic event verification and an isolated funded sandbox. Verify real NGN/USD deposits and withdrawals, all fee/refund/idempotency/authorization cases and receipts before separate explicit owner approval for production activation. No publication performed.

## Official references reviewed
- https://docs.breet.io/deposits
- https://docs.breet.io/withdrawals
- https://docs.breet.io/auto-settlement
- https://docs.breet.io/supported-assets
- https://docs.breet.io/webhooks
- https://docs.breet.io/api-reference/rates-and-prices/rate-calculator