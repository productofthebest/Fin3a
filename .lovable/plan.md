# Admin → Users all-fiat holdings: safe minimal deployment

## Inspection findings (read-only, nothing applied)

- Live database: 48 migrations recorded, last is `0047_activity_history_retention`. `0048` and `0049` are both unapplied.
- **0048 is not needed by 0049.** 0048 only adds new international-deposit objects (`international_deposit_intents`, `flw_international_deposit_events`, a trigger, and `apply_flw_international_deposit`). 0049 references none of them.
- **None of 0048's objects exist yet.** Nothing is half-applied: no tables, trigger, or function.
- **Everything 0049 depends on already exists live:**
  - `admin_require() -> void`, security definer
  - `admin_balance(_user_id uuid, _currency text, _completed_only boolean) -> numeric`, security definer
  - `accounts.user_id`, `accounts.currency`
  - `account_ledger.user_id`, `.currency`, `.status`
- **0049 matches the app.** It creates `admin_list_user_fiat_balances(_user_ids uuid[]) -> jsonb`: read-only, admin-checked, executable by signed-in users only. Admin → Users calls it with `{ _user_ids }`, the same shape, in both the user list and the user profile.
- **0049 only reads.** It creates no accounts and writes no ledger rows, and it doesn't change any deposit, withdrawal, transfer, or balance.
- **Ordering risk.** The update tool runs saved updates in date order and skips any older update once a newer one is recorded. If 0049 is applied alone, 0048 may be skipped later.
- **Side note.** The Flutterwave webhook already imports the international-deposit code. Until 0048 is applied, only that international path can fail. NGN top-ups don't use it.

## Execution plan (needs your approval)

1. Apply only `0049_admin_all_fiat_holdings`, using its saved text exactly as written. No 0048 tables or functions get created.
2. Keep 0048 for later. When international deposits are approved, apply it as a new, separately recorded update. That way it can't be skipped because of the ordering, and the saved SQL stays the same.
3. Check after applying, reading only:
   - the function exists with the right inputs
   - signed-in users can run it, anonymous visitors can't
   - a non-admin call is refused
   - an admin call returns balances that match the existing NGN/USD figures for the same users
4. Open Admin → Users signed in as admin. Confirm each user shows every currency they hold, and that the profile balances still match what they were before.
5. Re-run the migration-history check and report what was applied and what's still pending (0048).

## Safety

- No data changes, no deletions, no edits to existing functions, tables, or ledger rows.
- Undo if needed: drop only the new read-only function. Wallet data isn't touched.
- Publishing isn't needed for the database part. One backend serves both preview and live.

## Your decision

- Option A (recommended): apply 0049 only now, and keep 0048 until international deposits are approved.
- Option B: apply both. This switches on the international-deposit foundation, which hasn't been tested with real payments.
