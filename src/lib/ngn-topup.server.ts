import { verifyPaymentByReference, verifyPaymentById, retrieveRefund, type VerifiedCharge } from "./flutterwave.server";
import { refundState, type Notice } from "./flutterwave-webhook";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

// Generated RPC argument types omit SQL nullability; these evidence fields intentionally retain unknowns as null.
function evidenceRpc(client: SupabaseClient<Database>, name: "apply_flw_topup_evidence" | "record_flw_topup_refund", args: Record<string, string | number | boolean | null>) {
  const rpc = client.rpc.bind(client) as unknown as (name: string, args: Record<string, string | number | boolean | null>) => Promise<{ data: Json | null; error: unknown }>;
  return rpc(name, args);
}

async function recordCharge(paid: VerifiedCharge, txRef: string, noticeId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await evidenceRpc(supabaseAdmin, "apply_flw_topup_evidence", {
    _tx_ref: txRef, _provider_tx_id: paid.id, _notice_tx_id: noticeId ?? paid.id,
    _currency: paid.currency, _amount: paid.amount, _status: paid.status,
    _charged_amount: paid.charged_amount ?? null, _app_fee: paid.app_fee ?? null,
    _merchant_fee: paid.merchant_fee ?? null, _provider_date: paid.created_at ?? null,
    _reference_matches: paid.tx_ref === txRef,
  });
  if (error) throw new Error("CREDIT_FAILED");
  return data as { status: string; credited?: number };
}

/** Verifies with Flutterwave, then credits once through the database function. */
export async function settleTopup(txRef: string) {
  const paid = await verifyPaymentByReference(txRef);
  return recordCharge(paid, txRef);
}

export async function processTopupNotice(notice: Exclude<Notice, { kind: "transfer" }>) {
  if (notice.kind === "charge") {
    const paid = await verifyPaymentById(notice.id);
    return recordCharge(paid, notice.txRef, notice.id);
  }
  const refund = await retrieveRefund(notice.id);
  const charge = await verifyPaymentById(refund.transaction_id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await evidenceRpc(supabaseAdmin, "record_flw_topup_refund", {
    _refund_id: refund.id, _tx_ref: charge.tx_ref, _provider_tx_id: charge.id,
    _amount: refund.amount_refunded, _refund_status: refund.status,
    _refund_state: refundState(refund.status), _provider_date: refund.created_at ?? null,
    _charge_amount: charge.amount, _charge_currency: charge.currency, _charge_status: charge.status,
    _matches: refund.id === notice.id && refund.transaction_id === notice.transactionId && charge.id === refund.transaction_id,
  });
  if (error) throw new Error("REFUND_RECORD_FAILED");
  return data;
}
