// Server-only: builds a compact, aggregate-only financial snapshot for the AI assistant.
// Only totals are sent to the model — no notes, descriptions, references or merchant names.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { currencySymbol } from "./fin3a";
import { calculateTotals, completedRecords, historicalAverages, roundMoney } from "./financial-calculations";

type Client = SupabaseClient<Database>;

export async function buildFinancialSnapshot(supabase: Client, userId: string) {
  const now = new Date();
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const from = fromDate.toISOString().slice(0, 10);

  const [settingsRes, txRes, allRes, billsRes] = await Promise.all([
    supabase.from("user_settings").select("currency").eq("user_id", userId).maybeSingle(),
    supabase
      .from("transactions")
      .select("type, amount, occurred_at, status, classification, currency, flag, categories(name)")
      .eq("user_id", userId)
      .gte("occurred_at", from),
    supabase.from("transactions").select("type, amount, status, classification, currency, flag, occurred_at").eq("user_id", userId),
    supabase
      .from("recurring_bills")
      .select("amount, frequency, next_due_date, active, kind")
      .eq("user_id", userId)
      .eq("active", true),
  ]);
  for (const r of [settingsRes, txRes, allRes, billsRes]) if (r.error) throw new Error(r.error.message);

  const currency = settingsRes.data?.currency ?? "USD";
  const months = new Map<string, { income: number; spending: number; byCategory: Record<string, number> }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.set(d.toISOString().slice(0, 7), { income: 0, spending: 0, byCategory: {} });
  }
  const today = now.toISOString().slice(0, 10);
  const rows = completedRecords(txRes.data ?? [], currency, today);
  for (const t of rows) {
    const m = months.get(t.occurred_at.slice(0, 7));
    if (!m) continue;
    const amt = Number(t.amount);
    if (t.type === "income") m.income += amt;
    else {
      m.spending += amt;
      const c = t.categories?.name ?? "Uncategorized";
      m.byCategory[c] = (m.byCategory[c] ?? 0) + amt;
    }
  }

  const totals = calculateTotals(allRes.data ?? [], currency, today);
  const money = (value: number) => roundMoney(value, currency);

  const monthly = [...months.entries()].map(([month, v]) => ({
    month,
    income: money(v.income),
    spending: money(v.spending),
    net: money(v.income - v.spending),
    topCategories: Object.entries(v.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, total]) => ({ name, total: money(total) })),
  }));
  const firstRecord = completedRecords(allRes.data ?? [], currency, today).map((r) => r.occurred_at).sort()[0] ?? null;
  const averages = historicalAverages(monthly, firstRecord, today, currency);

  return {
    today: now.toISOString().slice(0, 10),
    currency,
    currencySymbol: currencySymbol(currency),
    transactionCount: (allRes.data ?? []).length,
    recordedNetCashFlow: totals.recordedNet,
    confirmedAvailableBalance: null,
    pendingExpenses: totals.pendingExpenses,
    clearedFundsNotYetSpendable: totals.clearedNet,
    excludedRecords: totals.excluded,
    completeMonthsWithData: averages.completeMonths.length,
    monthsUsedForAverages: averages.completeMonths,
    averageMonthlyIncome: averages.income,
    averageMonthlySpending: averages.spending,
    assumptions: ["UTC calendar dates; user timezone not configured", "Completed, regular, known-currency records only; duplicate/ambiguous flags excluded", "Unknown and other currencies excluded; no conversion", "First recorded month and current partial month excluded from averages; zero-activity months included", "Recording history does not establish complete account coverage"],
    monthly,
    activeRecurringBills: (billsRes.data ?? []).map((b) => ({
      amount: Number(b.amount), frequency: b.frequency, nextDue: b.next_due_date, kind: b.kind,
    })),
  };
}

export const ASSISTANT_INSTRUCTIONS = `You are the Fin3a AI financial assistant, inside a personal-finance app.
You receive a JSON snapshot of the signed-in user's own records (aggregated totals only). Rules:
- Base every figure on the snapshot. Never invent numbers. If data needed is missing (e.g. no income recorded, too few months, unknown goal amount), say exactly what is missing and ask for it.
- Always use the user's currency from the snapshot, formatted with currencySymbol and thousands separators (e.g. ₦12,500).
- Clearly label each figure as **Actual** (from records), **Estimate** (derived average) or **Projection** (hypothetical). Projections are never guaranteed.
- For runway, affordability, savings targets and what-if questions: show the calculation step by step and list your assumptions (e.g. which months were averaged, partial current month excluded).
- "recordedNetCashFlow" = eligible completed income minus eligible completed expenses recorded in Fin3a. It is NOT a confirmed available balance, bank balance or net worth. confirmedAvailableBalance is unknown: ask the user for a confirmed starting balance before balance-based affordability/runway calculations.
- Explain excluded records and averaging assumptions when relevant. Missing-currency records must be reviewed, not assumed to use the selected currency. Recurring commitments have no confirmed currency or payment matching: do not silently add them to spending or double count them.
- Do not treat transfers, refunds or loans as income/expense unless the user confirms.
- Keep answers concise, use short markdown sections, bullet lists and small tables.
- You are not a licensed adviser; for major decisions suggest professional advice briefly.
- Never discuss or recommend cryptocurrency, stablecoins, wallets or trading.`;
