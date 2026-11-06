// Server-only: applies Flutterwave-verified bill payment outcomes. Never trust request bodies for status/amount.
import { verifyPaymentById, type VerifiedCharge } from "./flutterwave.server";

function outcome(status: string): "successful" | "failed" | "pending" {
  const s = status.toLowerCase();
  if (s === "successful") return "successful";
  if (s === "failed") return "failed";
  return "pending";
}

export async function applyBillCharge(charge: VerifiedCharge, expectedReference: string) {
  if (charge.tx_ref !== expectedReference) throw new Error("REFERENCE_MISMATCH");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("finish_bill_payment", {
    _reference: charge.tx_ref, _provider_tx_id: charge.id, _outcome: outcome(charge.status), _amount: charge.amount, _currency: charge.currency,
  });
  if (error) { console.error("finish_bill_payment failed", error.message); throw new Error("SETTLE_FAILED"); }
  return data as { status: string };
}

/** Re-checks a pending bill payment with Flutterwave. Unknown results leave it pending. */
export async function refreshBillPayment(reference: string, providerTxId: string | null) {
  if (!providerTxId) return { status: "pending" };
  return applyBillCharge(await verifyPaymentById(providerTxId), reference);
}
