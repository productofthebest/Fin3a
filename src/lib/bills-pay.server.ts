// Server-only: applies Flutterwave-verified bill payment outcomes. Never trust request bodies for status/amount.
import { getBillStatus, type VerifiedBillStatus } from "./flutterwave.server";

function outcome(status: string): "successful" | "failed" | "pending" {
  const s = status.toLowerCase();
  if (s === "successful" || s === "success") return "successful";
  if (s === "failed" || s === "reversed" || s === "cancelled") return "failed";
  return "pending";
}

export async function applyBillStatus(status: VerifiedBillStatus, expectedReference: string) {
  if (status.customer_reference !== expectedReference) throw new Error("REFERENCE_MISMATCH");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("finish_bill_payment", {
    _reference: expectedReference, _provider_tx_id: status.tx_ref, _outcome: outcome(status.status), _amount: status.amount, _currency: status.currency,
  });
  if (error) { console.error("finish_bill_payment failed", error.message); throw new Error("SETTLE_FAILED"); }
  return data as { status: string };
}

/** Re-checks a pending bill payment with Flutterwave. Unknown results leave it pending. */
export async function refreshBillPayment(reference: string, providerTxId: string | null) {
  if (!providerTxId) return { status: "pending" };
  return applyBillStatus(await getBillStatus(providerTxId), reference);
}
