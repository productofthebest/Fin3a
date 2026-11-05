import { verifyPaymentByReference } from "./flutterwave.server";

/** Verifies with Flutterwave, then credits once through the database function. */
export async function settleTopup(txRef: string) {
  const paid = await verifyPaymentByReference(txRef);
  if (!paid) return { status: "awaiting" as const };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("credit_ngn_topup", { _tx_ref: txRef, _provider_tx_id: paid.providerTxId, _amount_paid: paid.amount });
  if (error) { console.error("credit_ngn_topup failed", error.message); throw new Error("CREDIT_FAILED"); }
  return data as { status: string; credited?: number };
}
