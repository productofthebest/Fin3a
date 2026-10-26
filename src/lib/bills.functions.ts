import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecurringBill } from "./fin3a";

const CATEGORY_SELECT = "id, name, icon";

const billInput = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1_000_000_000_000),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** Advance a date by one billing cycle. */
export function advanceDueDate(iso: string, frequency: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  switch (frequency) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export const listBills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recurring_bills")
      .select(`*, categories(${CATEGORY_SELECT})`)
      .order("next_due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as RecurringBill[];
  });

export const addBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => billInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("recurring_bills")
      .insert({ ...data, user_id: context.userId })
      .select(`*, categories(${CATEGORY_SELECT})`)
      .single();
    if (error) throw new Error(error.message);
    return row as RecurringBill;
  });

export const updateBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).extend(billInput.shape).parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...values } = data;
    const { data: row, error } = await context.supabase
      .from("recurring_bills")
      .update(values)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select(`*, categories(${CATEGORY_SELECT})`)
      .single();
    if (error) throw new Error(error.message);
    return row as RecurringBill;
  });

export const deleteBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_bills")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: bill, error: billError } = await context.supabase
      .from("recurring_bills")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (billError || !bill) throw new Error(billError?.message ?? "Bill not found");

    const { error: txError } = await context.supabase.from("transactions").insert({
      user_id: context.userId,
      type: "expense",
      amount: bill.amount,
      category_id: bill.category_id,
      description: bill.name,
      occurred_at: bill.next_due_date,
      status: "completed",
      source: "manual",
      recurring_bill_id: bill.id,
    });
    if (txError) throw new Error(txError.message);

    const { error: updateError } = await context.supabase
      .from("recurring_bills")
      .update({ next_due_date: advanceDueDate(bill.next_due_date, bill.frequency) })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });

export const toggleBillActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_bills")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
