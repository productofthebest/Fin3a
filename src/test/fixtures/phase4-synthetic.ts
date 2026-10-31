import type { AnalysisRecord } from "@/lib/financial-analysis";

/** Test runner only. Never import from application code or seed into a live database. */
export const SYNTHETIC_TODAY = "2026-10-31";
export const syntheticAccounts = [
  { id: "10000000-0000-4000-8000-000000000001", label: "Synthetic NGN household", currency: "NGN", confirmedBalance: 1_200_000 },
  { id: "10000000-0000-4000-8000-000000000002", label: "Synthetic USD household", currency: "USD", confirmedBalance: 8_000 },
] as const;

export function syntheticHistory(): AnalysisRecord[] {
  const records: AnalysisRecord[] = [];
  let sequence = 0;
  const add = (patch: Partial<AnalysisRecord>) => records.push({ id: `fixture-${++sequence}`, type: "expense", amount: 100, currency: "NGN", status: "completed", classification: "regular", occurred_at: "2026-10-01", description: "Synthetic test record", source: "manual", category_id: "food", categories: { name: "Food", icon: "🍽️" }, ...patch });
  add({ occurred_at: "2026-04-15", type: "income", amount: 300_000 });
  for (const month of ["05", "06", "07", "08", "09", "10"]) {
    add({ occurred_at: `2026-${month}-01`, type: "income", amount: 450_000, category_id: "salary", categories: { name: "Salary", icon: "💼" } });
    add({ occurred_at: `2026-${month}-05`, amount: 150_000, category_id: "rent", categories: { name: "Rent", icon: "🏠" } });
    add({ occurred_at: `2026-${month}-10`, amount: month === "10" ? 120_000 : 90_000 });
    add({ occurred_at: `2026-${month}-15`, amount: 30_000, category_id: "transport", categories: { name: "Transportation", icon: "🚌" } });
    add({ occurred_at: `2026-${month}-20`, amount: 20_000, category_id: "utilities", categories: { name: "Utilities", icon: "💡" } });
  }
  add({ type: "income", amount: 500_000, classification: "transfer" });
  add({ type: "income", amount: 25_000, classification: "refund" });
  add({ type: "income", amount: 200_000, classification: "loan" });
  add({ amount: 50_000, classification: "credit_card_payment" });
  add({ amount: 12_500, status: "pending" });
  add({ type: "income", amount: 40_000, status: "cleared" });
  add({ amount: 7_000, status: "unverified" });
  add({ amount: 120_000, flag: "duplicate" });
  add({ amount: 8_000, flag: "ambiguous" });
  add({ amount: 1_000, currency: "USD" });
  add({ amount: 999_000, currency: null });
  add({ amount: 111_000, occurred_at: "2026-11-01" });
  return records;
}