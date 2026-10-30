// Server-only: builds a compact, aggregate-only financial snapshot for the AI assistant.
// Only totals are sent to the model — no notes, descriptions, references or merchant names.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { currencySymbol } from "./fin3a";

type Client = SupabaseClient<Database>;

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function buildFinancialSnapshot(supabase: Client, userId: string) {
  const now = new Date();
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const from = fromDate.toISOString().slice(0, 10);

  const [settingsRes, txRes, allRes, billsRes] = await Promise.all([
    supabase.from("user_settings").select("currency").eq("user_id", userId).maybeSingle(),
    supabase
      .from("transactions")
      .select("type, amount, occurred_at, status, categories(name)")
      .eq("user_id", userId)
      .gte("occurred_at", from),
    supabase.from("transactions").select("type, amount, status").eq("user_id", userId),
    supabase
      .from("recurring_bills")
      .select("name, amount, frequency, next_due_date, active")
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
  const rows = (txRes.data ?? []) as unknown as {
    type: string; amount: number; occurred_at: string; status: string; categories: { name: string } | null;
  }[];
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

  let availableFunds = 0;
  let pendingExpenses = 0;
  let clearedNotSpendable = 0;
  for (const t of allRes.data ?? []) {
    const amt = Number(t.amount);
    if (t.status === "pending") { if (t.type === "expense") pendingExpenses += amt; continue; }
    if (t.status === "cleared") { clearedNotSpendable += t.type === "income" ? amt : -amt; continue; }
    availableFunds += t.type === "income" ? amt : -amt;
  }

  const monthly = [...months.entries()].map(([month, v]) => ({
    month,
    income: round(v.income),
    spending: round(v.spending),
    net: round(v.income - v.spending),
    topCategories: Object.entries(v.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, total]) => ({ name, total: round(total) })),
  }));
  const withData = monthly.filter((m) => m.income > 0 || m.spending > 0);
  // Exclude the current (partial) month from averages.
  const complete = withData.filter((m) => m.month !== now.toISOString().slice(0, 7));
  const avg = (k: "income" | "spending") =>
    complete.length ? round(complete.reduce((s, m) => s + m[k], 0) / complete.length) : null;

  return {
    today: now.toISOString().slice(0, 10),
    currency,
    currencySymbol: currencySymbol(currency),
    transactionCount: (allRes.data ?? []).length,
    availableFunds: round(availableFunds),
    pendingExpenses: round(pendingExpenses),
    clearedFundsNotYetSpendable: round(clearedNotSpendable),
    completeMonthsWithData: complete.length,
    averageMonthlyIncome: avg("income"),
    averageMonthlySpending: avg("spending"),
    monthly,
    activeRecurringBills: (billsRes.data ?? []).map((b) => ({
      name: b.name, amount: Number(b.amount), frequency: b.frequency, nextDue: b.next_due_date,
    })),
  };
}

export const ASSISTANT_INSTRUCTIONS = `You are the Fin3a AI financial assistant, inside a personal-finance app.
You receive a JSON snapshot of the signed-in user's own records (aggregated totals only). Rules:
- Base every figure on the snapshot. Never invent numbers. If data needed is missing (e.g. no income recorded, too few months, unknown goal amount), say exactly what is missing and ask for it.
- Always use the user's currency from the snapshot, formatted with currencySymbol and thousands separators (e.g. ₦12,500).
- Clearly label each figure as **Actual** (from records), **Estimate** (derived average) or **Projection** (hypothetical). Projections are never guaranteed.
- For runway, affordability, savings targets and what-if questions: show the calculation step by step and list your assumptions (e.g. which months were averaged, partial current month excluded).
- "availableFunds" = completed income minus completed expenses recorded in Fin3a; it is not necessarily the user's bank balance or net worth — say so when relevant.
- Do not treat transfers, refunds or loans as income/expense unless the user confirms.
- Keep answers concise, use short markdown sections, bullet lists and small tables.
- You are not a licensed adviser; for major decisions suggest professional advice briefly.
- Never discuss or recommend cryptocurrency, stablecoins, wallets or trading.`;
