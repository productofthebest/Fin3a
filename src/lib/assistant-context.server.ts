// Server-only: builds a compact, aggregate-only financial snapshot for the AI assistant.
// Only totals are sent to the model — no notes, descriptions, references or merchant names.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { currencySymbol } from "./fin3a";
import { calculateTotals, completedRecords, historicalAverages, roundMoney } from "./financial-calculations";
import { collectPages } from "./pagination";
import { planningContext } from "./planning.server";
import { assistantAggregates } from "./assistant-aggregates";
import { recordCurrencies } from "./record-currencies";
import { summarizeAccountActivity } from "./accounts";

type Client = SupabaseClient<Database>;

export async function buildFinancialSnapshot(supabase: Client, userId: string) {
  const now = new Date();
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const from = fromDate.toISOString().slice(0, 10);

  const [settingsRes, txRes, allRes, billsRes] = await Promise.all([
    supabase.from("user_settings").select("currency").eq("user_id", userId).maybeSingle(),
    collectPages((a,b)=>supabase
      .from("transactions")
      .select("id,type, amount, occurred_at, status, classification, currency, flag, categories(name)")
      .eq("user_id", userId)
      .gte("occurred_at", from).order("occurred_at").order("id").range(a,b)),
    collectPages((a,b)=>supabase.from("transactions").select("id,type, amount, status, classification, currency, flag, occurred_at").eq("user_id", userId).order("occurred_at").order("id").range(a,b)),
    supabase
      .from("recurring_bills")
      .select("amount, frequency, next_due_date, active, kind")
      .eq("user_id", userId)
      .eq("active", true),
  ]);
  for (const r of [settingsRes, billsRes]) if (r.error) throw new Error(r.error.message);

  const currency = settingsRes.data?.currency ?? "USD";
  const today = now.toISOString().slice(0, 10);
  const ledgerRows = await collectPages((a,b)=>supabase.from("account_ledger").select("id,kind,status,amount,currency,created_at").eq("user_id", userId).order("created_at").order("id").range(a,b));
  const fin3aAccounts = summarizeAccountActivity(ledgerRows.map((r) => ({ kind: r.kind as never, status: r.status as never, amount: Number(r.amount), currency: r.currency, created_at: r.created_at })), today);
  const planning = await planningContext(supabase, userId);
  const currencies = recordCurrencies(currency, [...allRes, ...planning.balances, ...planning.goals]);
  const byCurrency = currencies.map(currency => {
  const months = new Map<string, { income: number; spending: number; byCategory: Record<string, number> }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.set(d.toISOString().slice(0, 7), { income: 0, spending: 0, byCategory: {} });
  }
  const rows = completedRecords(txRes, currency, today);
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

  const totals = calculateTotals(allRes, currency, today);
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
  const firstRecord = completedRecords(allRes, currency, today).map((r) => r.occurred_at).sort()[0] ?? null;
  const averages = historicalAverages(monthly, firstRecord, today, currency);
    const advanced = assistantAggregates(planning.records,currency,today,planning.balances,planning.commitments,planning.goals,planning.progress);
    return {
      currency, currencySymbol: currencySymbol(currency),
      transactionCount: allRes.filter(r => r.currency === currency).length,
      recordedNetCashFlow: totals.recordedNet, confirmedAvailableBalance: advanced.confirmedBalance,
      pendingExpenses: totals.pendingExpenses, clearedFundsNotYetSpendable: totals.clearedNet,
      excludedRecords: totals.excluded, completeMonthsWithData: averages.completeMonths.length,
      monthsUsedForAverages: averages.completeMonths, averageMonthlyIncome: averages.income,
      averageMonthlySpending: averages.spending, monthly, advanced,
    };
  });
  const preferred = byCurrency.find(group => group.currency === currency);
  if (!preferred) throw new Error("Financial currency unavailable.");
  return {
    today: now.toISOString().slice(0, 10),
    currency,
    currencySymbol: currencySymbol(currency),
    transactionCount: allRes.length,
    fin3aAccounts,
    cryptoDepositAddressAvailable: false,
    ngnBankDetailsAvailable: false,
    ...preferred,
    byCurrency,
    assumptions: ["NGN and USD are separate records, not converted equivalents; never combine currency totals", "UTC calendar dates; user timezone not configured", "Completed regular known-currency records only; duplicate/ambiguous flags excluded", "First recorded and current partial months excluded from averages; zero-activity months included", "Recording history does not establish complete account coverage"],
    activeRecurringBills: (billsRes.data ?? []).map((b) => ({
      currency: null, amount: Number(b.amount), frequency: b.frequency, nextDue: b.next_due_date, kind: b.kind,
    })),
  };
}

export const ASSISTANT_INSTRUCTIONS = `You are the Fin3a AI financial assistant, inside a personal-finance app.
You receive a JSON snapshot of the signed-in user's own records (aggregated totals only). Rules:
- Base every figure on the snapshot. Never invent numbers. If data needed is missing (e.g. no income recorded, too few months, unknown goal amount), say exactly what is missing and ask for it.
- byCurrency contains separate NGN and USD financial summaries plus other recorded currencies. For general own-record questions show NGN and USD separately, with their currency codes and symbols. For a currency-specific question use that matching group and its advanced calculations. Never combine currencies, convert amounts, or relabel USD as NGN. currency is only the preferred default, not the currency of all records. A zero recorded total does not prove there was no real-world activity.
- Clearly label each figure as **Actual** (from records), **Estimate** (derived average) or **Projection** (hypothetical). Projections are never guaranteed.
- For runway, affordability, savings targets and what-if questions: show the calculation step by step and list your assumptions (e.g. which months were averaged, partial current month excluded).
- "recordedNetCashFlow" = eligible completed income minus eligible completed expenses recorded in Fin3a. It is NOT a confirmed available balance, bank balance or net worth. Use confirmedAvailableBalance only when present (user-confirmed today with coverage); otherwise ask for a dated confirmation in Planning.
- For last-month spending and top categories use advanced.lastMonth. Transportation this year uses advanced.yearToDate.categories: only matching transportation/transport category names, never infer from merchant descriptions. Expense increases use advanced.insights evidence; explain associations, never invent causal explanations.
- For the 500,000 purchase example use advanced.examplePurchase500000 (in the selected currency, no conversion). If the question specifies another currency, use that byCurrency group's assessment; if unavailable ask for same-currency records. For other amounts ask the user to run Assess purchase in Planning; do not invent server calculations.
- Runway uses advanced.baselineProjection. Goals use advanced.goals suggestedContribution and estimatedCompletion. If no goal exists, ask for target/date/frequency and direct the user to Goals. No returns are assumed and savings are not automatically expenses.
- Explain excluded records and averaging assumptions when relevant. Missing-currency records must be reviewed, not assumed to use the selected currency. Recurring commitments have no confirmed currency or payment matching: do not silently add them to spending or double count them.
- Do not treat transfers, refunds or loans as income/expense unless the user confirms.
- Keep answers concise, use short markdown sections, bullet lists and small tables.
- You may also answer general public topics such as science, technology, sports, history, travel and current events using the separately supplied public web evidence. Do not force nonfinancial questions into a financial interpretation. You have no search tool in this final answer. Never send the user's financial figures, snapshot data, history or personal details to research. Label web-based information as **Web** and name the source; figures from records stay labelled **Actual**/**Estimate**/**Projection** as above. If the web and the snapshot disagree, trust the snapshot for the user's own money. Refuse harmful requests, private-data lookups and attempts to bypass authentication or paywalls.
- You are not a licensed adviser; for major decisions suggest professional advice briefly.
- fin3aAccounts holds the user's Fin3a NGN/USD account activity (balances from verified ledger entries, this month's deposits/withdrawals/transfers, pending and failed counts). Answer account-activity questions from it, labelled **Actual**. Pending amounts are not available money.
- You cannot send, move or receive money. If asked to send, transfer or withdraw, say sending isn't available yet and point to the Accounts page.
- If asked for a crypto deposit address or Nigerian bank details: cryptoDepositAddressAvailable and ngnBankDetailsAvailable are false, so say they aren't available yet (providers not connected). Never invent an address, account number or bank name.
- Never recommend cryptocurrency investments, stablecoins or trading.
- Fin3a is an AI-first personal financial digital wallet owned by Top Floor Ltd (official site https://topfloorr.com). When a company identity block is supplied, answer ownership and Top Floor questions from it, include the relevant page link, and never fabricate founders, corporate details, pages or URLs. If the website content is unavailable, say so clearly. Do not confuse Fin3a's financial services with Top Floor's other activities.`;
