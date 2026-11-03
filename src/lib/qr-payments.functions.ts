import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface QrRequestDetails {
  status: "open" | "paid" | "cancelled" | "expired" | "invalid";
  requestId?: string;
  recipientName?: string;
  recipientFin3aId?: string;
  amount?: number | null;
  currency?: string;
  description?: string | null;
  expiresAt?: string | null;
  isOwn?: boolean;
}

export const createQrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { amount: number | null; currency: "NGN" | "USD"; description?: string; expiresInMinutes?: number | null }) => input,
  )
  .handler(async ({ data, context }) => {
    if (data.amount !== null && (!Number.isFinite(data.amount) || data.amount <= 0)) {
      throw new Error("Enter a valid amount");
    }
    const { data: id, error } = await context.supabase.rpc("create_qr_request", {
      // SQL accepts NULL (payer chooses amount); the generated type marks it required.
      _amount: data.amount as number,
      _currency: data.currency,
      ...(data.description?.trim() ? { _description: data.description.trim() } : {}),
      ...(data.expiresInMinutes ? { _expires_in_minutes: data.expiresInMinutes } : {}),
    });
    if (error) throw new Error(error.message);
    return { requestId: id as string };
  });

export const resolveQrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("resolve_qr_request", { _request_id: data.requestId });
    if (error) throw new Error(error.message);
    return result as unknown as QrRequestDetails;
  });

export const payQrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; amount?: number | null }) => input)
  .handler(async ({ data, context }) => {
    if (data.amount != null && (!Number.isFinite(data.amount) || data.amount <= 0)) {
      throw new Error("Enter a valid amount");
    }
    const { data: result, error } = await context.supabase.rpc("pay_qr_request", {
      _request_id: data.requestId,
      // SQL accepts NULL for fixed-amount requests; the generated type marks it required.
      _amount: (data.amount ?? null) as number,
      _idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    const outcome = result as { id: string; status: string; reason?: string };
    if (outcome.status !== "completed") throw new Error(outcome.reason ?? "Payment failed");
    return { transferId: outcome.id };
  });

export const cancelQrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("qr_payment_requests")
      .update({ status: "cancelled" })
      .eq("id", data.requestId)
      .eq("owner_user_id", context.userId)
      .eq("status", "open");
    if (error) throw new Error(error.message);
    return { cancelled: true };
  });

export const getMyQrRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("qr_payment_requests")
      .select("id, amount, currency, description, expires_at, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

export const logQrScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "fin3a_profile" | "external" | "invalid"; detail?: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase.rpc("log_qr_scan", { _kind: data.kind, ...(data.detail ? { _detail: data.detail } : {}) });
    return { logged: true };
  });
