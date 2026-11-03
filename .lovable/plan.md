# Replace Categories navigation with Bills payment

## Verified starting point
Fin3a already has a Bills page for recurring bill tracking, but Flutterwave is **not connected**. No Flutterwave credentials or connector are configured. All six requested payment categories are unconnected; no merchant providers or API calls have been tested. Existing NGN ledger balances do not prove provider funding.

The current baseline is **190/190 automated tests passed**. No customer records or application behaviour have changed.

## 1. Bills page and navigation — first approved increment
- Replace Categories in main navigation with a receipt-icon Bills entry, with only one Bills link.
- Preserve all other navigation, Dashboard layout, theme, account cards and category records. Keep category management accessible from Bills.
- Add selectable Airtime, Data, Electricity, Cable TV, Internet and Tax cards consistent with the current design.
- Show an honest unavailable state until merchant support is verified; no invented providers, fake purchases or money deductions.
- Preserve recurring bill tracking as a separate section. Distinguish manual expense recording from paying through Flutterwave.
- Check signed-in navigation and category/recurring tracking access on desktop, tablet and phone; run the full regression suite and update the checklist.

Approval covers this presentation increment only, on the live-connected project. No publication, schema changes or payment activation.

## 2. Merchant and sandbox verification — prerequisite to payments
- Configure credentials securely for an isolated test environment; do not copy production users, records or keys.
- Confirm bill activation, KYC, actual funded source balance, settlement route, fees, limits, server IP requirements and service-specific sandbox availability with Flutterwave.
- Verify current official API contracts before implementation. Retrieve merchant categories, billers and packages rather than hardcoding desired provider names.
- Report supported/unsupported categories and customer validation requirements, including prepaid tokens, cable/data packages and tax references.

This step is blocked on merchant access and an isolated sandbox. If a category has no verified sandbox path, report it as blocked rather than treating other payment tests as sufficient.

## 3. Wallet payment implementation — separately approved financial increment
- Reuse the existing NGN wallet and ledger; review and approve the funding/reservation/reconciliation design before database or money-processing changes.
- Authenticate all operations, validate customer details server-side and require explicit review/confirmation.
- Use a stable unique reference and idempotent processing, with atomic wallet availability/reservation handling to prevent concurrent overspending.
- Finalise only verified provider outcomes; safely reconcile pending, successful, failed and reversed states. Keep ambiguous timeouts unresolved without a second charge.
- Verify callbacks where supported and independently reconcile status; frontend success is never payment authority.
- Add masked payment history and downloadable verified receipts, with securely displayed prepaid tokens when delivered.
- Extend assistant aggregate bill understanding and upcoming reminders without giving AI payment authority.

## 4. Required completion evidence
Sandbox-test each enabled category, invalid customers, insufficient funds, explicit confirmation, retries, concurrency, unknown timeouts, delivery failure, reversal, verified receipts and user isolation. Verify that outcomes and balances read back correctly through the app.

Report implementation, automated tests, sandbox tests, real-world verification and merchant dependencies separately. Production payment activation requires a further explicit approval; nothing is published by this plan.

## Technical approach
Use existing authenticated TanStack server functions and ledger infrastructure. Add only the provider adapter and durable payment/reconciliation structures required by verified contracts; never create a duplicate wallet/integration. Keep server secrets out of browser code and generated integration files untouched. Preserve recurring commitments as distinct from settled utility payments and avoid double-counting financial aggregates.

Readiness report: `docs/bills-payment-readiness.md`.