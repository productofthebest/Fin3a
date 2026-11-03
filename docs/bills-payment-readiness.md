# Bills payment readiness — 3 November 2026

## Current implementation
- Approved presentation increment implemented: one receipt-icon Bills entry replaces Categories in main navigation; category management remains accessible from Bills. Six service cards open an honest unavailable dialog. Existing recurring bill form/tracking retained, with manual recording labelled separately from real payments.
- Existing `/bills` manages recurring commitments and manually records expenses. It does not purchase utilities, debit the NGN wallet or verify delivery. Preserve this feature separately from provider payments.
- Navigation contains both Categories and Bills. Replace the Categories entry with a receipt-labelled Bills entry without creating duplicate Bills links; retain category data and category management access.
- No Flutterwave integration was found in application source, migrations or configured connectors. Configured secret names contain no Flutterwave credential. No credentials were read and no provider requests were sent.
- Existing NGN/USD balances are derived from account ledger entries. These do not prove Flutterwave funds or settlement availability. Reuse the wallet; do not create a second balance authority.

## Requested category report
| Category | Connected | Verified merchant providers/packages | API workflow tested |
|---|---|---|---|
| Airtime | No | None | No |
| Data | No | None | No |
| Electricity | No | None | No |
| Cable TV | No | None | No |
| Internet | No | None | No |
| Tax | No | None | No |

Named networks, utilities and cable providers in the brief are desired coverage, not verified merchant availability. Do not publish them as available until the authenticated catalog confirms them.

## Documentation evidence, not merchant verification
Official guide: https://developer.flutterwave.com/docs/bill-payment

The guide describes categories → billers → items/packages, customer validation, initiation and status verification. It lists Nigerian billers, completed profile/KYC, a funded source balance and server IP whitelisting. Tax/internet coverage is catalog-dependent. Exact API version, endpoint contracts, bill-specific webhook events and bill-specific sandbox coverage still require verification before code is written.

General references: https://developer.flutterwave.com/docs/webhooks and https://developer.flutterwave.com/docs/testing . General payment testing/webhooks do not establish bill-specific support.

## Required approvals and dependencies
1. Owner approved the scoped navigation/Bills presentation change; implemented without publication or payment activation.
2. A confirmed isolated backend and Flutterwave sandbox credentials supplied through secure secret configuration. Existing staging deferral does not verify payment safety.
3. Merchant evidence: bill enablement, KYC, source balance, real funding route, fees/limits, settlement terms, deployment IP requirements and sandbox coverage for each service. Customer wallet liabilities must map to actual eligible provider funds.
4. Approval of the financial state machine and ledger reservation/reconciliation design before migrations or live money operations. Never hold a database transaction open across an external provider call; ambiguous delivery must remain unresolved rather than be retried with a new payment identity.
5. Verified customer validation, explicit confirmation, idempotent purchase/status checks, webhook authentication where supported, safe timeout/retry/reversal handling and receipts containing only verified outcomes.
6. AI extensions use verified aggregate records; recurring commitments remain distinct from settled payments. AI must not execute payment.

## Verification evidence
- Baseline regression suite: 190/190 tests across 24 files passed on 3 November 2026.
- Post-change regression suite: 190/190 tests passed; latest preview build OK.
- Signed-in Bills workflow: all six service dialogs confirm no processing/charge, category management opens, recurring bill creation form opens without saving, and Bills reload succeeds. Desktop/tablet/phone at 1280/768/393px inspected with no horizontal page overflow or runtime errors.
- Application presentation changed only. No database changes, customer record writes, Flutterwave calls, paid AI calls or publication.
- Existing account has no recurring bills; saved recurring record operations were preserved but not re-tested with writes. Sandbox payments, funded-wallet success, provider notifications, concurrent deductions, reversals and receipt outputs remain unverified. This is not payment implementation completion.