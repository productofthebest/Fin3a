import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withdrawalInput, withdrawalsEnabled } from "./withdrawal-production";

export type WithdrawalView = { reference: string; amount: number; fee: number; payout: number; bankName: string; accountNumber: string; accountName: string; status: string; createdAt: string };
type Row = { reference: string; amount: number; fin3a_fee: number; payout: number; bank_name: string; account_number: string; account_name: string; status: string; created_at: string };
const COLS = "reference, amount, fin3a_fee, payout, bank_name, account_number, account_name, status, created_at";
const toView = (r: Row): WithdrawalView => ({ reference: r.reference, amount: Number(r.amount), fee: Number(r.fin3a_fee), payout: Number(r.payout), bankName: r.bank_name, accountNumber: r.account_number, accountName: r.account_name, status: r.status, createdAt: r.created_at });

export const getWithdrawalAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ enabled: withdrawalsEnabled(process.env) }));

export const getRecentWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("ngn_withdrawals").select(COLS).eq("user_id", context.userId).order("created_at", { ascending: false }).limit(5);
    if (error) throw new Error("Withdrawals are unavailable. Please try again.");
    return (data ?? []).map(toView);
  });

export const createNgnWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => withdrawalInput.parse(input))
  .handler(async () => {
    // Fin3a does not yet store a verified legal identity that can be compared
    // with Flutterwave's resolved bank-account holder. A display name or
    // client-supplied assertion is not proof of ownership. Keep this endpoint
    // locked so third-party beneficiary accounts cannot receive withdrawals.
    return { ok: false as const, error: "Withdrawals are unavailable until your bank account can be matched to your verified Fin3a identity." };
  });

export const checkNgnWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ reference: z.string().regex(/^F3W-[0-9a-f-]{36}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("ngn_withdrawals").select("reference, status, provider_transfer_id").eq("user_id", context.userId).eq("reference", data.reference).maybeSingle();
    if (!row) throw new Error("Withdrawal not found.");
    if (row.status !== "pending") return { status: row.status };
    const { refreshWithdrawal } = await import("./ngn-withdrawal.server");
    try { return await refreshWithdrawal(row.reference, row.provider_transfer_id); }
    catch { return { status: "pending" }; }
  });
