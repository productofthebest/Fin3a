# Fin3a transaction fees, revenue and deposit currencies

## Outcome
Build the centralized fee and revenue system from both briefs without changing customer balances, existing internal payments, card dimensions or Dashboard layout. Preserve the current lavender/white/violet design; the brief’s black/white/gold references will not trigger an unrelated redesign.

Approval covers incremental development and additive financial schema work described here, not publication or activation of real provider charges. Financial/security verification requires an isolated funded sandbox before live activation.

## Findings and blockers
- Breet and Flutterwave are **not integrated** in the current application. A key-presence flag is not proof of connectivity. External deposits, withdrawals and bill payments remain disabled.
- Existing NGN/USD accounts, ledger references, internal transfers, Split Bill and QR payments can be reused. The current deposit currency setting is only a preference, not a verified deposit route.
- Official Breet documentation describes NGN/USD wallet currencies, crypto deposits and stablecoin withdrawals. Account-specific eligibility still needs verification. Crypto-to-crypto swaps, revenue-sharing terms and webhook signature verification remain unconfirmed.
- Account overview currently calculates balances from at most 200 recent ledger rows. Correct this read path before any fee-enabled workflow relies on displayed available funds; retain database-authoritative checks.

## Fee rules
| Service | Launch Fin3a fee |
|---|---|
| All supported crypto deposits, into NGN or USD | 0% |
| USDT/USDC selling and withdrawals below USD 5,000 | 1% |
| USDT/USDC selling and withdrawals at/above USD 5,000 | 0.5% |
| Provider-supported USDT/USDC crypto swaps | 0.1%, disabled until support is confirmed |
| Successful NGN withdrawal | Flat NGN 50 |
| Internal transfer, Share Payment, Bill Split and internal QR | Free |
| Bill payments | Actual agreed provider commission; no automatic extra user fee |

**Your withdrawal choice:** deduct Fin3a fees from the payout, not as an extra wallet debit. A NGN 5,000 withdrawal pays NGN 4,950 before separately disclosed provider charges. Reject requests with no positive net payout. Selling fees also reduce the quoted payout as required by the brief.

Existing owner-rate NGN↔USD account swaps remain unchanged; the 0.1% rule applies to supported crypto swaps, not these internal currency swaps. Never alter Breet’s quote or add hidden exchange-rate markup.

## Incremental delivery
### 1. Fee foundation and safe accounting
- Add a single precise fee calculator with versioned launch settings; no frontend-authoritative fees.
- Store immutable transaction quote/fee snapshots, currency/asset/network, USD tier valuation, original and final amounts, provider/network charges, reference and settlement status alongside existing payment records.
- Add restricted fee configuration and append-only audit history with old/new values and administrator identity. Require confirmation; changes affect new transactions only. Free-service rules remain protected.
- Separate estimated commission, pending revenue, earned revenue and settlement. Never treat payment volume or customer balances as company revenue.
- Record verified refunds/reversals as linked accounting events rather than rewriting history; prevent duplicate fees, credits and provider requests.

### 2. Admin fee management and reports
- Add clear revenue overview, Crypto Revenue, NGN withdrawals, Bill Commissions and free internal-payment usage sections using existing AdminShell and server-side administrator checks.
- Show NGN and USD separately, with today/7-day/30-day/month/custom filters, provider/service breakdowns, trend charts and CSV/Excel exports.
- Display unavailable metrics honestly while integrations are absent. Estimated agreed commissions remain labelled until reconciled.
- Combined-currency reports are optional explicit conversions with a recorded report rate, never summed raw currencies or used to change balances.

### 3. Verified provider adapters and deposit choices
- Once approved credentials, business capabilities and sandbox are available, implement actual Breet/Flutterwave calls; no fabricated assets, networks, addresses, prices, commissions or status.
- Per deposit: choose supported asset, network and NGN/USD receiving currency; show supported quote details and a confirmation summary before instructions.
- Bind receiving currency immutably to that deposit’s provider instructions/reference. Later changes to the user preference must not redirect an existing deposit.
- Credit only after independently verified provider settlement, once, through the existing ledger. If authentic event verification cannot be established, automatic crediting remains blocked.
- Restrict on-chain withdrawals server-side to supported USDT/USDC networks. Keep NGN and crypto withdrawal fee rules separate. Leave unsupported swaps/services unavailable.
- Enable education/flight bill categories only when an actual provider agreement/catalog supports them.

### 4. Verification and rollout
- Add concrete tests for every fee rule: USD 999.99/1,000/4,999.99/5,000/above, 0.1% swaps, NGN 50 deductions, free deposits/internal services, unsupported assets, rounding and insufficient net payout.
- Verify admin authorization, immutable setting snapshots/history, duplicate requests/events, failures/timeouts/reversals, actual commission reconciliation and separate NGN/USD reporting in an isolated backend.
- Test real supported NGN/USD deposit routes, quote expiry, fees, withdrawals and final ledger balances end-to-end in the funded sandbox. Preserve existing customer records; no synthetic production rows.
- Regression-test transfers, Share Payment, Split Bill, QR, Accounts and existing Admin controls; check desktop/tablet/mobile.
- Update the master checklist and issue an implementation report separating code, unit tests, integration tests, real-world evidence, unsupported capabilities and remaining launch requirements.
- Seek a separate explicit approval before production financial activation or publication.

## Technical safeguards
- Reuse the existing accounts/ledger and transaction identities; use additive migrations with explicit grants and RLS. No duplicate wallets, direct balance edits or role expansion.
- Use authenticated TanStack server functions for internal administration and quotes. Provider callbacks use verified public server handlers; privileged clients load only after authorization.
- Use integer minor units or exact decimal arithmetic with explicit currency/network precision and rounding. Fee tiers use verified quote valuation, never client-provided USD values.
- Confirm what provider fee fields actually mean before treating them as Fin3a commission; prevent double charging when the agreed commission is already included.
- Keep credentials server-only and exclude sensitive customer details from admin exports beyond authorized scope.

## Required external inputs
Approved Breet/Flutterwave business access, verified enabled services and settlement currencies, authentic webhook verification specifications, commercial commission terms and an isolated funded sandbox. Missing inputs block those integrations, not the fee/reporting foundation.