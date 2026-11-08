import { z } from "zod";
import { payoutFetch } from "./payout-transport.server";
import { internationalOutcome, verifiedMinorAmount } from "./international-withdrawal";

const referenceSchema = z.string().regex(/^F3X-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const providerId = z.string().regex(/^[1-9]\d{0,19}$/);
const transferSchema = z.object({ id: z.union([z.number().int().positive().safe(), providerId]).transform(String),
  reference: referenceSchema, status: z.string().min(1).max(40), currency: z.string().regex(/^[A-Z]{3}$/).refine(v => v !== "NGN"), amount: z.number().finite().positive() });
type VerifiedTransfer = z.infer<typeof transferSchema>;
type Rpc = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> };

/** Caller must retrieve evidence from the authenticated provider GET endpoint.
 * Webhook contents are never passed as verified evidence to this function.
 */
export async function applyVerifiedInternationalTransfer(transfer: VerifiedTransfer, expectedReference: string, db: Rpc) {
  referenceSchema.parse(expectedReference);
  const parsed = transferSchema.parse(transfer);
  if (parsed.reference !== expectedReference) throw new Error("REFERENCE_MISMATCH");
  const { data, error } = await db.rpc("finish_international_withdrawal", {
    _reference: expectedReference, _provider_transfer_id: parsed.id, _outcome: internationalOutcome(parsed.status),
    _amount_minor: verifiedMinorAmount(parsed.amount, parsed.currency), _currency: parsed.currency,
  });
  if (error) throw new Error("INTERNATIONAL_RECONCILIATION_FAILED");
  return data;
}

export async function processInternationalTransferNotice(id: string, reference: string) {
  providerId.parse(id); referenceSchema.parse(reference);
  // Existing transport accepts numeric GET retrieval, without changing its NGN
  // reference/POST rules. No international POST sender exists in this release.
  const response = await payoutFetch(`/transfers/${id}`, { method: "GET" });
  const body: unknown = await response.json().catch(() => null);
  const envelope = z.object({ status: z.literal("success"), data: transferSchema }).safeParse(body);
  if (!response.ok || !envelope.success) throw new Error("PROVIDER_VERIFICATION_UNAVAILABLE");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return applyVerifiedInternationalTransfer(envelope.data.data, reference, supabaseAdmin as unknown as Rpc);
}