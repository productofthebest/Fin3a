# Flutterwave webhook draft — verification and promotion

## Scope and status
Existing UI/wallets preserved. No new payout, bill payment, refund initiation or provider activation. No publication, real messages, funded requests, or authenticated live-provider calls were made. Secrets listing confirms FLW_SECRET_KEY and FLW_PUBLIC_KEY are configured; FLW_WEBHOOK_HASH is absent. Validity, test/live mode and merchant permissions were deliberately not inferred from secret values.

## Official contract checked
- https://developer.flutterwave.com/docs/webhooks — V3 compares `verif-hash` directly to the configured shared hash. No body HMAC/v4 fallback. Enable retries: official documentation specifies three retries at 30-minute intervals and a 60-second timeout.
- https://developer.flutterwave.com/v3.0.0/reference/get-transaction-refunds — authenticated GET `https://api.flutterwave.com/v3/refunds/{refund_id}`; `transaction_id` correlates original charge. Reference example is unwrapped; wrapped success/data is also parsed.
- https://developer.flutterwave.com/docs/refunds — custom refund notification is **unwrapped**, containing `id`, `TransactionId`, `AmountRefunded`, `status`. No invented `refund.completed` event. `completed` means initiated/pending disbursement, not settled. Final documented statuses: completed-bank-transfer, completed-momo, completed-mpgs, completed-offline, completed-preauth. Unknown statuses remain unknown/review. Custom refund URL must be configured in V3 preferences.

## Changes
- Signature rejected before body/provider/database reads. Bounded 32 KiB actual-byte JSON, Zod correlation validation; unrelated event types ignored. Provider/DB failures return 503, not acknowledged success.
- Every charge retrieves `/transactions/{id}/verify`; manual check retrieves verify_by_reference, then uses the same evidence RPC. Exact reference, provider ID, NGN currency and requested amount required.
- Refund GET plus independent original-charge verification required. Refund identity, original transaction and amount bounds checked in locked database function. Successful original charge never proves refund settled.
- Request lock + provider advisory lock + existing unique provider reference + immutable fee/revenue writes prevent repeated credit. Pending/failed never credits or downgrades credited status. Mismatches require review.
- Provider evidence, nullable amounts/charges/date, immutable idempotent event records and refund records added. Verified refund only marks review and partial/full refund provider state: no ledger debit, negative balance, history edits, or fee/revenue reversal.
- Existing fee snapshot `provider_charge`/`network_charge` are deducted quote allocations (zero deducted here), **not** assertions of actual provider cost. New nullable verified-charge fields distinguish unknown actual charges; provider app_fee/merchant_fee stored separately when returned. Charge success is not proof of merchant settlement.

## Migrations for acceptance
1. `drizzle/migrations/0041_flutterwave_verified_webhook_evidence.sql`
2. `drizzle/migrations/0042_restrict_flutterwave_evidence_writes.sql`
3. `drizzle/migrations/0043_flutterwave_snapshot_charge_evidence.sql`

Applied only to this draft's verified local backend; generated types refreshed. Every new public table has grants and RLS. Extra write grants inherited in the isolated database were discovered by an actual privilege test and explicitly revoked in 0042. Review/apply all three together; never omit 0042. Journal records acceptance migrations; draft test rows never move to the app.

## Verification evidence
- Final full suite: **348/348 tests pass across 44 files**; latest preview build OK. Webhook admission/retrieval: 20 tests; processing: 7 tests; actual isolated database: 1 multi-invariant test with concurrent delivery and stored readbacks.
- Unit admission/provider tests exercise bad/missing signatures, malformed/oversized bodies, unknown events, retry 503, refund status semantics and official retrieval shape with mocked provider responses. Mocking does not prove live provider operation.
- Actual isolated local PostgreSQL + local REST service-role RPC integration: exact ₦200 charge → ₦150 ledger + ₦50 revenue; duplicate and simultaneous duplicate delivery; same provider ID on another request; amount/currency mismatch; failed/pending; initiated/partial/full refunds and refund duplicates/over-refund/mismatched correlation. Entire ledger/fee/revenue JSON readbacks remain identical after duplicate/refund attempts. Anonymous/authenticated credit execution and authenticated event INSERT privileges denied. Test fixtures are test-runner-only, disposable local rows, not main-app data.
- `GET http://localhost:8080/api/public/flutterwave-webhook` returns version `fin3a-flw-v3-2`, `ready:false`, signature `v3-verif-hash`; unsigned POST returns 401.
- Page route metadata inspected including index; all content routes have head metadata, shared page-meta includes OG/Twitter. No UI changes.

## Main safe promotion / missing steps
1. Review these code changes and all three migration files; accept draft only after isolated checks remain green. Acceptance applies structure changes, never draft fixture rows.
2. From main, publish **all current Fin3a changes together** after review/isolated gates; do not publish this draft. Initially leave shared hash unset so POST fails closed.
3. Main must verify deployed GET marker and unsigned POST 401 at `https://picture-to-playful-interface.lovable.app/api/public/flutterwave-webhook`. This is the target URL, not a deployment verified in this draft. Confirm readiness remains false until secret setup; use the same URL for the V3 refund custom URL.
4. Only after endpoint deployment, main requests **FLW_WEBHOOK_HASH** through the secure secret form (Generate + copy, destination Flutterwave → Settings → Webhooks → secret hash). Do not create FLW_SECRET_HASH. Store identical value in Flutterwave and Fin3a, select V3 and enable retries/refund notifications. Secrets affect all drafts/app immediately; no secret requested here.
5. Check deployed health readiness and real official V3 delivery in approved environment. Callback round trip cannot reach this editor-only draft. Valid signed production callback and provider refund statuses remain unverified.
6. Separate approval/testing still required: valid test credentials/mode, merchant wallet-funding authorization, initialization and funded charge/settlement/refund, bank payout hold/settle/refund, bill merchant catalogue/permissions. Unknown provider fees and merchant settlement remain unavailable rather than simulated.

## Touched files
`src/routes/api/public/flutterwave-webhook.ts`; `src/lib/flutterwave-webhook.ts`; `src/lib/flutterwave.server.ts`; `src/lib/ngn-topup.server.ts`; `src/lib/ngn-topup.functions.ts`; `src/lib/AGENTS.md`; three migrations/journal/snapshots; regenerated integration types; `src/test/flutterwave-webhook.test.ts`; `src/test/flutterwave-processing.test.ts`; `src/test/flutterwave-db.test.ts`; `src/test/fixtures/flutterwave-db.ts`; `src/test/setup.ts` (allow node-only integration tests); `roadmap.md`; `docs/master-checklist.md`; this report.