// Server-only: applies Flutterwave-verified bill payment outcomes. Never trust request bodies for status/amount.
import { getBillStatus, type VerifiedBillStatus } from "./flutterwave.server";

function outcome(status: string): "successful" | "failed" | "pending" {
  const s = status.toLowerCase();
  if (s === "successful" || s === "success") return "successful";
  if (s === "failed" || s === "reversed" || s === "cancelled") return "failed";
  return "pending";
}

export async function applyBillStatus(status: VerifiedBillStatus, expectedReference: string, expectedAmount: number) {
  if (status.customer_reference !== expectedReference) throw new Error("REFERENCE_MISMATCH");
  if (status.currency !== "NGN" || Math.round(status.amount * 100) !== Math.round(expectedAmount * 100)) {
    throw new Error("AMOUNT_OR_CURRENCY_MISMATCH");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("finish_bill_payment", {
    _reference: expectedReference, _provider_tx_id: status.tx_ref, _outcome: outcome(status.status), _amount: status.amount, _currency: status.currency,
  });
  if (error) { console.error("finish_bill_payment failed", error.message); throw new Error("SETTLE_FAILED"); }
  return data as { status: string };
}

/** Re-checks a pending bill payment with Flutterwave. Unknown results leave it pending. */
export async function refreshBillPayment(
  reference: string,
  providerTxId: string | null,
  expectedAmount: number,
  createdAt: string,
) {
  let resolvedTxRef = providerTxId;
  if (!resolvedTxRef) {
    // Recovery path for a successful provider call whose tx_ref could not be
    // persisted locally. Search by our unique merchant reference; never create
    // another bill payment from this path.
    const { findBillStatusByCustomerReference } = await import("./flutterwave.server");
    const from = new Date(Date.parse(createdAt) - 86_400_000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const recovered = await findBillStatusByCustomerReference(reference, from, to);
    if (!recovered) return { status: "pending" };
    if (recovered.currency !== "NGN" || Math.round(recovered.amount * 100) !== Math.round(expectedAmount * 100)) {
      throw new Error("AMOUNT_OR_CURRENCY_MISMATCH");
    }
    resolvedTxRef = recovered.tx_ref;
  }
  const status = await getBillStatus(resolvedTxRef);
  return applyBillStatus(status, reference, expectedAmount);
}
