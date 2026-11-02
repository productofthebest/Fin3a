# Fin3a staging (isolated test project)

Goal: a remixed copy of Fin3a with its OWN database, storage, auth users and secrets. No test record may reach production.

## Owner steps
1. Project name (top left) → Settings → "Remix this project". Name it "Fin3a Staging".
2. In the remix, enable Lovable Cloud (it creates a new, separate backend).
3. Add secrets in the remix only: `OPENAI_API_KEY` (ideally a separate OpenAI project key with a low monthly cap set in OpenAI's dashboard). Do not add `TERMII_API_KEY` unless SMS testing is intended.
4. Tell the agent in the remix chat to start staging verification.

## Separation checks the agent must pass before any test
- The remix's backend project reference differs from production's.
- `auth.users` in the remix contains only staging test accounts.
- The documents storage bucket is empty before tests.
- In the remix's admin page: set a daily budget, enter model prices, and low per-user limits.

## Test plan (from owner brief)
Long statements (20–60 pages, 8-page parts) · opening/closing balances · total money in/out · duplicates at ±3/4-day boundaries · failed/interrupted scans leave no drafts · receipts · invoices · deposit slips · per-account isolation.
Label every document as **Synthetic fixture** (generated) or **Anonymised real sample** (owner-supplied). Synthetic results never certify real-document accuracy.
