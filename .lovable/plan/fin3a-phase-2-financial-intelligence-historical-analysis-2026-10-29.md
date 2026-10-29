# Fin3a Phase 2 — Financial Intelligence & Historical Analysis

## Inspection findings
- Schema: `transactions`, `categories`, `recurring_bills`, `user_settings` live; `documents` + `transaction_drafts` tables, `documents` storage bucket, AI SDK and `xlsx` are already in place from the paused build — but no pages, no AI extraction, no import UI. The document pipeline must be finished first; Phase 2 features depend on it.
- Dashboard/activity exist but are month-offset only: no custom ranges, no previous-period comparison, no historical view, no insights, no classification.
- Calculations currently use plain numbers against `numeric` columns; page boundaries are UTC.

## Step 0 — Finish the Phase 1 document pipeline (foundation)
- `documents.tsx` page: upload (statement, receipt, POS slip, bill, teller/cheque doc; PDF/CSV/Excel/image, 15 MB cap), document list with status badges, delete.
- Server extraction (`documents.functions.ts`): parse CSV/Excel deterministically; images/PDFs via Lovable AI vision (structured output: date, merchant, amount, currency, type, reference, payment method, line items). AI never computes totals — amounts come from rows, sums verified in code.
- Review screen: drafts shown per document with extracted fields, confidence, duplicate warning (fingerprint + amount/date/reference match), edit-before-confirm, import in bulk via the existing `import_document_drafts` function. Duplicates flagged, never auto-deleted.
- Activity/dashboard: Imported vs Manual labels, document counts.

## Step 1 — Schema additions (one additive migration)
- `transactions`: `classification text default 'regular'` (`transfer` | `refund` | `loan` | `credit_card_payment` | `regular`), `flag text` (`duplicate` | `unusual` | `ambiguous`), `flag_note text`. Transfers/refunds excluded from income/expense totals.
- `recurring_bills`: `kind text default 'expense'` so recurring income is detectable.
- New table `merchant_rules` (user_id, merchant_key, category_id, unique) — persists category corrections and improves future auto-categorization.
- GRANTs + RLS policies for every new table/column in the same migration; regenerate types.

## Step 2 — Period filters & dashboard extension
- Replace month-offset with a period selector: this month, last month, last 3/6 months, this year, last year, custom range. Boundaries computed client-side in the user's local timezone; server fns take explicit start/end dates.
- Dashboard gains: income, expenses, net cash flow for the period; category breakdown; change vs the equivalent previous period; savings rate only when income > 0; data-coverage note (first/last activity month, imported documents) instead of invented history.
- Available balance stays lifetime completed cash flow — no account/balance records exist, so no fabricated balance (limitation noted to users in-UI).

## Step 3 — Historical analysis (`/history`)
- Month-by-month income/expense/net table + chart; year-over-year where ≥ 2 years exist, otherwise an honest "not enough data" state.
- Trends by category and merchant; recurring income/expenses from recurring bills; largest transactions; biggest category swings vs the prior period.
- All numbers from deterministic code in a new pure `src/lib/analytics.ts` engine fed by one server fn pulling the user's transactions — no AI in any calculation.

## Step 4 — Transaction intelligence
- Add/edit transactions: classification picker (income/expense/transfer/refund/loan/credit-card payment) that changes what totals include; corrections persist and write merchant rules.
- Duplicate detection on manual entry (same amount within ±3 days, matching merchant/reference) — warns and offers to flag, never deletes.
- Review queue on `/activity`: uncategorized, unusual (>3× that category's median), ambiguous, flagged-duplicate transactions, with inline fix. Chart/table entries drill through to filtered transaction lists.

## Step 5 — Insights (`/insights`)
- Rules-based, traceable statements: "Transport spending rose 25% vs last month", "Rent is 40% of recorded monthly spending", "Income was below expenses in September". Every insight names its comparison period and links to the underlying transactions. Insufficient-data cases say so plainly.

## Step 6 — Tests & verification
- Unit tests for the analytics engine: date-range filters, category totals, previous-period deltas, savings rate guard (no division by zero / missing income), classification exclusions, duplicate matcher, month/year boundaries, multi-currency separation.
- E2E in preview: upload a sample statement → review → import → totals update; Phase 1 flows (sign-in, manual entry, bills, categories) still work.
- Report features, schema changes, test results, and known limitations at the end.

## Out of scope (documented limitations)
- No multi-account/balance records, so account balance and net worth are not fabricated; transfers are user-classified, not auto-detected.
- No FX conversion: each currency totals separately (user's chosen currency is primary).
