import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopupView = { txRef: string; amount: number; fee: number; bankName: string; accountNumber: string; expiresAt: string; status: string; credited: number | null };

const toView = (r: { tx_ref: string; requested_amount: number; fin3a_fee: number; bank_name: string; account_number: string; expires_at: string; status: string; credited_amount: number | null }): TopupView => ({
  txRef: r.tx_ref, amount: Number(r.requested_amount), fee: Number(r.fin3a_fee), bankName: r.bank_name, accountNumber: r.account_number, expiresAt: r.expires_at, status: r.status, credited: r.credited_amount == null ? null : Number(r.credited_amount),
});

export const getLatestTopup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("ngn_topup_requests").select("tx_ref, requested_amount, fin3a_fee, bank_name, account_number, expires_at, status, credited_amount").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? toView(data) : null;
  });

export const createNgnTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ amount: z.number().min(100).max(5000000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: allowed, error: limitErr } = await supabase.rpc("consume_rate_limit", { _bucket: "ngn_topup", _limit: 5, _window_seconds: 3600 });
    if (limitErr || allowed === false) throw new Error("Too many top-up requests. Try again later.");
    const { data: account } = await supabase.from("accounts").select("id").eq("user_id", userId).eq("currency", "NGN").maybeSingle();
    if (!account) throw new Error("You don't have an NGN wallet.");
    const { data: schedule } = await supabase.rpc("current_fee_schedule");
    const fee = (schedule as { service: string; id: string | null; flat_ngn: number }[] | null)?.find(s => s.service === "ngn_deposit");
    if (!fee) throw new Error("Top-up is unavailable right now.");
    const amount = Math.round(data.amount * 100) / 100;
    if (amount <= Number(fee.flat_ngn)) throw new Error("Amount must be more than the fee.");
    const txRef = `F3T-${crypto.randomUUID()}`;
    // Flutterwave requires an email; phone-only accounts use a non-mailed reference address.
    const email = typeof claims.email === "string" && claims.email ? claims.email : `${userId}@wallet.fin3a.invalid`;
    const { createDynamicVirtualAccount } = await import("./flutterwave.server");
    let va;
    try { va = await createDynamicVirtualAccount({ email, amount, txRef }); }
    catch { throw new Error("We couldn't create a bank account number right now. Please try again."); }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(va.expiresAt);
    const row = { user_id: userId, account_id: account.id, tx_ref: txRef, requested_amount: amount, fin3a_fee: Number(fee.flat_ngn), fee_version_id: fee.id, bank_name: va.bankName, account_number: va.accountNumber, expires_at: Number.isNaN(expires.getTime()) ? new Date(Date.now() + 3600_000).toISOString() : expires.toISOString() };
    const { data: saved, error } = await supabaseAdmin.from("ngn_topup_requests").insert(row).select("tx_ref, requested_amount, fin3a_fee, bank_name, account_number, expires_at, status, credited_amount").single();
    if (error) { console.error("topup insert failed", error.message); throw new Error("Top-up could not be saved. Do not send money; try again."); }
    return toView(saved);
  });

export const checkNgnTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ txRef: z.string().regex(/^F3T-[0-9a-f-]{36}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase.from("ngn_topup_requests").select("status").eq("tx_ref", data.txRef).eq("user_id", context.userId).maybeSingle();
    if (!own) throw new Error("Top-up not found.");
    if (own.status !== "awaiting") return { status: own.status };
    const { settleTopup } = await import("./ngn-topup.server");
    try { return await settleTopup(data.txRef); }
    catch { throw new Error("We couldn't confirm the payment yet. Please try again shortly."); }
  });
