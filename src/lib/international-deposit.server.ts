import { verifyPaymentById } from "./flutterwave.server";
import type { Notice } from "./flutterwave-webhook";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

function settlementRpc(client: SupabaseClient<Database>, args: Record<string, string | number | boolean | null>) {
  const rpc = client.rpc.bind(client) as unknown as (name: string, args: Record<string, string | number | boolean | null>) => Promise<{ data: Json | null; error: unknown }>;
  return rpc("apply_flw_international_deposit", args);
}

/**
 * International card/local-rail deposits use their own F3I reference namespace.
 * A webhook is only a notification: provider verification and exact intent matching
 * are required before the atomic database settlement function can credit a wallet.
 */
export async function processInternationalDepositNotice(notice: Extract<Notice, { kind: "charge" }>) {
  if (!notice.txRef.startsWith("F3I-")) throw new Error("INVALID_INTERNATIONAL_REFERENCE");
  const paid = await verifyPaymentById(notice.id);
  const referenceMatches = paid.id === notice.id && paid.tx_ref === notice.txRef;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await settlementRpc(supabaseAdmin, {
    _tx_ref: notice.txRef,
    _provider_tx_id: paid.id,
    _currency: paid.currency.toUpperCase(),
    _amount: paid.amount,
    _provider_status: paid.status.toLowerCase(),
    _reference_matches: referenceMatches,
  });
  if (error) throw new Error("INTERNATIONAL_DEPOSIT_SETTLEMENT_FAILED");
  return data;
}
