import { HISTORY_MAX_PAGE_SIZE, HISTORY_PAGE_SIZE, pageRange, sanitizeHistorySearch } from "./transaction-history";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  monthLabel,
  monthRange,
  type Category,
  type RecurringBill,
  type Transaction,
} from "./fin3a";
import { calculateTotals, completedRecords, roundMoney, validFinancialDate } from "./financial-calculations";
import { recordCurrencies } from "./record-currencies";
import { ownedFinancialRecords } from "./financial-records.server";

const CATEGORY_SELECT = "id, name, icon";

function monthStart(offset: number): string {
  return monthRange(offset).start;
}

export interface DashboardData {
  currency: string;
  currencies: string[];
  months: { key: string; label: string; income: number; spending: number }[];
  selectedMonth: { key: string; label: string; income: number; spending: number; offset: number };
  categoryBreakdown: { name: string; icon: string; total: number }[];
  dailySpending: { day: number; cumulative: number }[];
  availableFunds: number;
  pendingAmount: number;
  excludedRecords: Record<string, number>;
  upcomingBills: (RecurringBill & { category?: { id: string; name: string; icon: string } | null })[];
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ offset: z.number().int().min(-24).max(0).default(0), currency: z.string().regex(/^[A-Z]{3}$/).optional() }).parse(input))
  .handler(async ({ data, context }): Promise<DashboardData> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    // Nine-month window ending at the selected month.
    const from = monthStart(data.offset - 8);
    const { start, end } = monthRange(data.offset);

    const [allTransactions, { data: settings, error: settingsError }, { data: bills, error: billsError }] =
      await Promise.all([
        ownedFinancialRecords(supabase,userId),
        supabase.from("user_settings").select("currency").eq("user_id", userId).maybeSingle(),
        supabase
          .from("recurring_bills")
          .select("*")
          .eq("user_id", userId)
          .eq("active", true)
          .gte("next_due_date", start)
          .lt("next_due_date", end)
          .order("next_due_date", { ascending: true }),
      ]);
    if (settingsError) throw new Error(settingsError.message);
    if (billsError) throw new Error(billsError.message);

    const currencies = recordCurrencies(settings?.currency ?? "USD", allTransactions);
    const currency = data.currency ?? settings?.currency ?? "USD";
    if (!currencies.includes(currency)) throw new Error("Choose an available record currency.");
    const transactions = completedRecords(allTransactions.filter(t=>t.occurred_at>=from && t.occurred_at<end), currency, today);

    // Monthly cash-flow buckets for the nine-month window.
    const months: DashboardData["months"] = [];
    for (let i = data.offset - 8; i <= data.offset; i++) {
      const { year, month } = monthLabel(i);
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      months.push({ key, label: key, income: 0, spending: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const tx of transactions) {
      const key = tx.occurred_at.slice(0, 7);
      const bucket = byKey.get(key);
      if (!bucket) continue;
      if (tx.type === "expense") bucket.spending += Number(tx.amount);
      else bucket.income += Number(tx.amount);
    }

    const lastMonth = months[months.length - 1];
    if (!lastMonth) throw new Error("Failed to build month buckets");
    const selectedKey = lastMonth.key;
    const selectedMonth = { ...lastMonth, label: selectedKey, offset: data.offset };

    // Selected-month category breakdown (expenses).
    const catMap = new Map<string, { name: string; icon: string; total: number }>();
    let cumulative = 0;
    const dailyMap = new Map<number, number>();
    for (const tx of transactions) {
      if (tx.occurred_at.slice(0, 7) !== selectedKey) continue;
      if (tx.type === "expense") {
        const day = Number(tx.occurred_at.slice(8, 10));
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(tx.amount));
        const name = tx.categories?.name ?? "Uncategorized";
        const icon = tx.categories?.icon ?? "💠";
        const entry = catMap.get(name) ?? { name, icon, total: 0 };
        entry.total = roundMoney(entry.total + Number(tx.amount), currency);
        catMap.set(name, entry);
      }
    }
    const dailySpending: DashboardData["dailySpending"] = [];
    const lastDay = new Date(Date.UTC(
      Number(selectedKey.slice(0, 4)),
      Number(selectedKey.slice(5, 7)),
      0,
    )).getUTCDate();
    for (let day = 1; day <= lastDay; day++) {
      cumulative = roundMoney(cumulative + (dailyMap.get(day) ?? 0), currency);
      dailySpending.push({ day, cumulative });
    }

    // Lifetime available funds: completed money in minus money out.
    const financialTotals = calculateTotals(allTransactions, currency, today);

    const categoryBreakdown = [...catMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    return {
      currency,
      currencies,
      months: months.map((m) => ({ ...m, income: roundMoney(m.income, currency), spending: roundMoney(m.spending, currency), label: m.key.slice(5) })),
      selectedMonth: { ...selectedMonth, income: roundMoney(selectedMonth.income, currency), spending: roundMoney(selectedMonth.spending, currency) },
      categoryBreakdown,
      dailySpending,
      availableFunds: financialTotals.recordedNet,
      pendingAmount: financialTotals.pendingExpenses,
      excludedRecords: financialTotals.excluded,
      upcomingBills: (bills ?? []) as DashboardData["upcomingBills"],
    };
  });

const txInput = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().max(1_000_000_000_000),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(300).optional(),
  merchant: z.string().trim().max(120).optional(),
  occurred_at: z.string().refine(validFinancialDate, "Enter a valid date."),
  status: z.enum(["pending", "cleared", "completed"]).default("completed"),
  notes: z.string().trim().max(2000).optional(),
  recurring_bill_id: z.string().uuid().nullable().optional(),
});

export type DashboardTxInput = z.infer<typeof txInput>;

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        offset: z.number().int().min(-24).max(0).optional(),
        type: z.enum(["income", "expense"]).optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("transactions")
      .select(`*, categories(${CATEGORY_SELECT})`)
      .eq("user_id", context.userId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.offset !== undefined) {
      const { start, end } = monthRange(data.offset);
      query = query.gte("occurred_at", start).lt("occurred_at", end);
    }
    if (data.type) query = query.eq("type", data.type);
    const term = sanitizeHistorySearch(data.search);
    if (term) query = query.or(`description.ilike.%${term}%,merchant.ilike.%${term}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Transaction[];
  });

export const listTransactionPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(1).max(100_000).default(1),
        pageSize: z.number().int().min(1).max(HISTORY_MAX_PAGE_SIZE).default(HISTORY_PAGE_SIZE),
        type: z.enum(["income", "expense"]).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
        categoryId: z.union([z.string().uuid(), z.literal("uncategorized")]).optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        search: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { from, to } = pageRange(data.page, data.pageSize);
    let query = context.supabase
      .from("transactions")
      .select(`*, categories(${CATEGORY_SELECT})`, { count: "exact" })
      .eq("user_id", context.userId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (data.type) query = query.eq("type", data.type);
    if (data.currency) query = query.eq("currency", data.currency);
    if (data.categoryId === "uncategorized") query = query.is("category_id", null);
    else if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.from) query = query.gte("occurred_at", data.from);
    if (data.to) {
      const next = new Date(`${data.to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      query = query.lt("occurred_at", next.toISOString().slice(0, 10));
    }
    const term = sanitizeHistorySearch(data.search);
    if (term) query = query.or(`description.ilike.%${term}%,merchant.ilike.%${term}%,reference.ilike.%${term}%`);
    const { data: rows, error, count } = await query;
    if (error) throw new Error("Could not load your transactions. Please try again.");
    return { rows: (rows ?? []) as Transaction[], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const addTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => txInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: settings, error: settingsError } = await context.supabase.from("user_settings").select("currency").eq("user_id", context.userId).single();
    if (settingsError || !settings) throw new Error("Choose your currency before adding transactions.");
    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: data.type,
        amount: data.amount,
        category_id: data.category_id ?? null,
        description: data.description ?? null,
        merchant: data.merchant ?? null,
        occurred_at: data.occurred_at,
        status: data.status,
        notes: data.notes ?? null,
        recurring_bill_id: data.recurring_bill_id ?? null,
        source: "manual",
        currency: settings.currency,
      })
      .select(`*, categories(${CATEGORY_SELECT})`)
      .single();
    if (error) throw new Error(error.message);
    return row as Transaction;
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).extend(txInput.shape).parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...values } = data;
    const patch = {
      type: values.type,
      amount: values.amount,
      occurred_at: values.occurred_at,
      status: values.status,
      category_id: values.category_id ?? null,
      description: values.description ?? null,
      merchant: values.merchant ?? null,
      notes: values.notes ?? null,
      recurring_bill_id: values.recurring_bill_id ?? null,
    };
    const { data: row, error } = await context.supabase
      .from("transactions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select(`*, categories(${CATEGORY_SELECT})`)
      .single();
    if (error) throw new Error(error.message);
    return row as Transaction;
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type { Category };
