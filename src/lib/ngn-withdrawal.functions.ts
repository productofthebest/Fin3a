import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withdrawalInput, withdrawalsEnabled, WITHDRAWALS_LOCKED, sameWithdrawal } from "./withdrawal-production";

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
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Fail closed before rate counting, provider resolution or any ledger reservation.
    if (!withdrawalsEnabled(process.env)) return { ok: false as const, error: WITHDRAWALS_LOCKED };
    const { data: previous, error: previousError } = await supabase.from("ngn_withdrawals")
      .select("reference, status, amount, bank_code, account_number").eq("user_id", userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    if (previousError) return { ok: false as const, error: "Withdrawal status is unavailable. No new request was sent." };
    if (previous) {
      if (!sameWithdrawal(previous, data)) return { ok: false as const, error: "This request already belongs to a different withdrawal." };
      return { ok: true as const, reference: previous.reference, status: previous.status };
    }
    const { data: allowed, error: limitErr } = await supabase.rpc("consume_rate_limit", { _bucket: "ngn_withdrawal", _limit: 10, _window_seconds: 3600 });
    if (limitErr || allowed === false) return { ok: false as const, error: "Too many withdrawals. Try again later." };
    const { resolveBankAccount, listNigerianBanks, createNgnTransfer, ProviderRejected } = await import("./flutterwave.server");
    // Re-confirm the account holder server-side; never trust a name from the browser.
    let accountName: string;
    let bankName: string;
    try {
      const bank = (await listNigerianBanks()).find(b => b.code === data.bankCode);
      if (!bank) return { ok: false as const, error: "Choose a supported Nigerian bank." };
      bankName = bank.name;
      const resolved = await resolveBankAccount(data.accountNumber, data.bankCode);
      if (resolved.accountNumber !== data.accountNumber || !resolved.accountName?.trim()) throw new Error("ACCOUNT_MISMATCH");
      accountName = resolved.accountName;
    }
    catch { return { ok: false as const, error: "We couldn't confirm this bank account." }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("reserve_ngn_withdrawal", {
      _user_id: userId, _idempotency_key: data.idempotencyKey, _amount: Math.round(data.amount * 100) / 100,
      _bank_code: data.bankCode, _bank_name: bankName, _account_number: data.accountNumber, _account_name: accountName,
    });
    if (error) { return { ok: false as const, error: "Withdrawal could not be confirmed. Check recent withdrawals before trying again." }; }
    const r = res as { status: string; reference?: string; payout?: number; available?: number };
    if (r.status === "insufficient") return { ok: false as const, error: "Not enough NGN balance for this withdrawal." };
    if (r.status === "invalid_amount") return { ok: false as const, error: "Amount must be at least ₦100 and more than the fee." };
    if (r.status === "no_account") return { ok: false as const, error: "You don't have an NGN wallet." };
    if (r.status === "existing" && r.reference) return { ok: true as const, reference: r.reference, status: "pending" };
    if (r.status !== "reserved" || !r.reference || !r.payout) return { ok: false as const, error: "Withdrawals are unavailable right now." };
    try {
      const t = await createNgnTransfer({ bankCode: data.bankCode, accountNumber: data.accountNumber, amount: r.payout, reference: r.reference });
      if (t) {
        const { applyTransfer } = await import("./ngn-withdrawal.server");
        // Create responses are acknowledgements, not settlement evidence; retrieve directly first.
        const { getTransfer } = await import("./flutterwave.server");
        await applyTransfer(await getTransfer(t.id), r.reference).catch(() => null);
      }
      return { ok: true as const, reference: r.reference, status: "pending" };
    } catch (e) {
      if (e instanceof ProviderRejected) {
        await supabaseAdmin.rpc("finish_ngn_withdrawal", { _reference: r.reference, _provider_transfer_id: null as unknown as string, _outcome: "failed", _amount: 0, _currency: "NGN" });
        return { ok: false as const, error: "The bank payout was declined. Your balance was not charged." };
      }
      // Outcome unknown: funds stay reserved until Flutterwave confirms success or failure.
      return { ok: true as const, reference: r.reference, status: "pending" };
    }
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
