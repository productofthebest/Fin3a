# International withdrawal preparation — 8 November 2026

## Applied and verified
- Only `0050_international_withdrawal_isolated_foundation` applied via managed migration. SQL byte-identical to `docs/international-withdrawals.sql`; no backfill, no existing table/function replacement.
- `0048`/`0049` were already applied before this task (live history timestamps `1793989500000` / `1794060000000`). New migration timestamp `1794119172466`, live history ID 51.
- New withdrawal, immutable ledger/event and merchant-evidence tables contain zero rows. Database gate function body is `SELECT false`; code also stays false.
- Reserve signature: `reserve_international_withdrawal(uuid,text,uuid,bigint,jsonb) -> jsonb`; finish: `finish_international_withdrawal(text,text,text,bigint,text) -> jsonb`. Customer reserve and anonymous finish denied; service finish allowed.
- NGN withdrawal record count/hash unchanged: 2 / `4976596f262bf9557f33e3814bd05deb`. NGN ledger count/hash unchanged: 4 / `938063a394813c478722e6fbeed2a747`.
- NGN reserve/finish/rate-limit definition hashes unchanged; NGN source files, common provider client, relay transport and 0045 migration SHA256 unchanged.
- Type-only FX generic schema-input correction restores pre-existing compile errors, no FX behavior changed. Admin Users untouched.
- Signed-in Wallet entry, bank/mobile-money selection, amount input, disabled recipient and payout controls verified at 1280×1800 / 393×852; screenshots inspected, no page errors/overflow. No provider call or payout made.

## Tests
- Focused international / Flutterwave / NGN: 110 passed, 1 safely skipped (existing live-backend fixture test).
- Isolated loopback PostgreSQL: 13 passed, testing real SQL, permissions/RLS, concurrent reservations, idempotency, exact settlement, failure release, immutable terms/events, reversal review, late contradictory outcome and evidence rejection.
- Relay: 17 passed using provider fetch mocks, no network payout.
- Preview compile: build OK. Final full-suite counts are recorded in the task report.

## Not activation-ready
- Separate international reservations are NOT yet integrated into every existing non-NGN balance reader/transfer/QR/split/swap debit path. Hard-false gates deliberately prevent cross-path overspending. No international POST sender exists; protected create API rejects before funds/provider operations.
- Merchant verification records: zero. Only Ghana GHS bank/mobile-money V3 fields have an explicit bounded adapter; other candidate corridors remain preliminary and cannot be verified with the current admin RPC.
- Fixed-IP relay hosting, IP whitelist, merchant/schema confirmation, exact charges, funded isolated provider settlement/reversal tests and controlled activation approval remain required.
- Admin verification and reversal-review RPCs are protected/audited but no admin management UI added; no merchant evidence fabricated.
- Historical migration findings remain: missing 0048/0049 snapshots and unrelated unlisted 0022/0050 preflight SQL. The unlisted preflight file replaces existing rate-limit buckets and was deliberately NOT applied.
- Current surface is main; agent has no Git branch merge/sync control. Report saved local commit honestly, not an unverified GitHub-main merge SHA. No publication.