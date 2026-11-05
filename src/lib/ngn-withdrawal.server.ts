// Server-only: applies Flutterwave-verified payout outcomes. Never trust notice bodies for status/amount.
import { getTransfer, findTransferByReference, transferOutcome, type VerifiedTransfer } from "./flutterwave.server";

export async function applyTransfer(t: VerifiedTransfer, expectedReference: string) {
  if (t.reference !== expectedReference) throw new Error("REFERENCE_MISMATCH");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("finish_ngn_withdrawal", {
    _reference: t.reference, _provider_transfer_id: t.id, _outcome: transferOutcome(t.status), _amount: t.amount, _currency: t.currency,
  });
  if (error) { console.error("finish_ngn_withdrawal failed", error.message); throw new Error("SETTLE_FAILED"); }
  return data as { status: string };
}

export async function processTransferNotice(id: string, reference: string) {
  return applyTransfer(await getTransfer(id), reference);
}

/** Re-checks a pending payout with Flutterwave. Unknown results leave it pending. */
export async function refreshWithdrawal(reference: string, providerId: string | null) {
  const t = providerId ? await getTransfer(providerId) : await findTransferByReference(reference).catch(() => null);
  if (!t) return { status: "pending" };
  return applyTransfer(t, reference);
}
