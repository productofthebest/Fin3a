import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BILL_CATEGORIES = ["airtime", "data", "electricity", "cable", "internet", "tax"] as const;
export type BillCategory = (typeof BILL_CATEGORIES)[number];
const CATEGORY_QUERY: Record<BillCategory, string> = {
  airtime: "airtime=1",
  data: "data_bundle=1",
  electricity: "power=1",
  cable: "cables=1",
  internet: "internet=1",
  tax: "tax=1",
};

export type BillBillerView = { billerCode: string; itemCode: string; name: string; shortName: string | null; amount: number | null; labelName: string | null };

// Biller lists change rarely; cache per category for 6 hours in the worker.
const billerCache = new Map<string, { at: number; rows: BillBillerView[] }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

export const getBillBillers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ category: z.enum(BILL_CATEGORIES) }).parse(input))
  .handler(async ({ data }) => {
    const cached = billerCache.get(data.category);
    if (cached && Date.now() - cached.at < CACHE_MS) return { billers: cached.rows, error: null as string | null };
    const { getBillCategories } = await import("./flutterwave.server");
    try {
      const rows = (await getBillCategories(CATEGORY_QUERY[data.category])).map(b => ({
        billerCode: b.biller_code, itemCode: b.item_code, name: b.name, shortName: b.short_name ?? null, amount: b.amount ?? null, labelName: b.label_name ?? null,
      }));
      billerCache.set(data.category, { at: Date.now(), rows });
      return { billers: rows, error: null as string | null };
    } catch {
      return { billers: [] as BillBillerView[], error: "Billers could not be loaded. Please try again." };
    }
  });

export const validateBillCustomerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({
    billerCode: z.string().min(1).max(80),
    itemCode: z.string().min(1).max(80),
    customer: z.string().min(4).max(120),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: limitErr } = await context.supabase.rpc("consume_rate_limit", { _bucket: "bill_validate", _limit: 30, _window_seconds: 600 });
    if (limitErr || allowed === false) return { valid: false as const, customerName: null as string | null, error: "Too many checks. Please wait a few minutes." };
    const { validateBillCustomer } = await import("./flutterwave.server");
    try {
      const r = await validateBillCustomer(data.billerCode, data.itemCode, data.customer);
      return { valid: r.valid, customerName: r.customerName, error: r.valid ? null : "We couldn't confirm this customer with the biller." };
    } catch {
      return { valid: false as const, customerName: null as string | null, error: "We couldn't confirm this customer with the biller." };
    }
  });

export const payBillFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({
    category: z.enum(BILL_CATEGORIES),
    billerCode: z.string().min(1).max(80),
    billerName: z.string().min(1).max(160),
    itemCode: z.string().min(1).max(80),
    customer: z.string().min(4).max(120),
    amount: z.number().min(50).max(5000000),
    idempotencyKey: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed, error: limitErr } = await supabase.rpc("consume_rate_limit", { _bucket: "bill_payment", _limit: 10, _window_seconds: 3600 });
    if (limitErr || allowed === false) {
      return {
        ok: false as const,
        retrySameAttempt: true as const,
        error: "Too many bill payment attempts. Retry this same payment later or check Bills history.",
      };
    }
    const { payBill, ProviderRejected } = await import("./flutterwave.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("reserve_bill_payment", {
      _user_id: userId, _idempotency_key: data.idempotencyKey, _amount: Math.round(data.amount * 100) / 100,
      _category: data.category, _biller_code: data.billerCode, _biller_name: data.billerName, _item_code: data.itemCode,
      _customer: data.customer, _customer_name: null as unknown as string,
    });
    if (error) {
      console.error("bill reserve outcome is uncertain", error.message);
      return {
        ok: false as const,
        retrySameAttempt: true as const,
        error: "We couldn't confirm whether this payment was reserved. Retry this same payment; don't start another one.",
      };
    }
    const r = res as { status: string; reference?: string; available?: number };
    if (r.status === "insufficient") return { ok: false as const, retrySameAttempt: false as const, error: "Not enough NGN balance for this payment." };
    if (r.status === "invalid_amount") return { ok: false as const, retrySameAttempt: false as const, error: "Amount must be at least ₦50." };
    if (r.status === "no_account") return { ok: false as const, retrySameAttempt: false as const, error: "You don't have an NGN wallet." };
    if (r.status === "existing") return { ok: true as const, reference: r.reference!, status: "pending" };
    if (r.status !== "reserved" || !r.reference) return { ok: false as const, retrySameAttempt: false as const, error: "Bill payments are unavailable right now." };
    try {
      const amount = Math.round(data.amount * 100) / 100;
      const t = await payBill({ billerCode: data.billerCode, itemCode: data.itemCode, customer: data.customer, amount, reference: r.reference });
      // Persist Flutterwave's bill tx_ref before polling. If the status endpoint is
      // temporarily unavailable, the user can safely check again without re-initiating.
      let referenceSaved = false;
      for (let attempt = 0; attempt < 3 && !referenceSaved; attempt++) {
        const { error: referenceError } = await supabaseAdmin.rpc("finish_bill_payment", {
          _reference: r.reference,
          _provider_tx_id: t.tx_ref,
          _outcome: "pending",
          _amount: amount,
          _currency: "NGN",
        });
        referenceSaved = !referenceError;
        if (referenceError) {
          console.error("bill provider reference persistence attempt failed", { attempt: attempt + 1, message: referenceError.message });
        }
      }
      if (referenceSaved) {
        const { refreshBillPayment } = await import("./bills-pay.server");
        await refreshBillPayment(r.reference, t.tx_ref, amount, new Date().toISOString()).catch(() => null);
      } else {
        // Keep the debit reserved. The customer's Check Status action can recover
        // the provider tx_ref from Flutterwave bill history using this F3B reference.
        console.error("bill provider reference requires history reconciliation", { reference: r.reference });
      }
      return { ok: true as const, reference: r.reference, status: "pending" };
    } catch (e) {
      if (e instanceof ProviderRejected) {
        await supabaseAdmin.rpc("finish_bill_payment", { _reference: r.reference, _provider_tx_id: null as unknown as string, _outcome: "failed", _amount: 0, _currency: "NGN" });
        return { ok: false as const, retrySameAttempt: false as const, error: "The biller declined this payment. Your balance was not charged." };
      }
      // Outcome unknown: funds stay reserved until Flutterwave confirms success or failure.
      return { ok: true as const, reference: r.reference, status: "pending" };
    }
  });

export const checkBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ reference: z.string().regex(/^F3B-[0-9a-f-]{36}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("bill_payments").select("reference, status, provider_tx_id, amount, created_at").eq("user_id", context.userId).eq("reference", data.reference).maybeSingle();
    if (!row) throw new Error("Payment not found.");
    if (row.status !== "pending") return { status: row.status };
    const { refreshBillPayment } = await import("./bills-pay.server");
    try { return await refreshBillPayment(row.reference, row.provider_tx_id, Number(row.amount), row.created_at); }
    catch { return { status: "pending" }; }
  });

export type BillPaymentView = { reference: string; category: string; billerName: string; customer: string; amount: number; status: string; createdAt: string };
export const getBillPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("bill_payments").select("reference, category, biller_name, customer, amount, status, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(10);
    if (error) throw new Error("Bill payment history is unavailable. Please try again.");
    return (data ?? []).map(r => ({ reference: r.reference, category: r.category, billerName: r.biller_name, customer: r.customer, amount: Number(r.amount), status: r.status, createdAt: r.created_at }) satisfies BillPaymentView);
  });
