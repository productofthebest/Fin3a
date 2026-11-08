import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { internationalWithdrawalsEnabled } from "./withdrawal-production";
import {
  buildInternationalTransferPayload,
  type InternationalWithdrawalInput,
} from "./international-payout-settlement";
import {
  createInternationalTransfer,
  findTransferByReference,
  getTransfer,
  ProviderRejected,
  transferOutcome,
  type VerifiedTransfer,
} from "./flutterwave.server";

type RpcClient = Pick<SupabaseClient<Database>, "rpc">;

function rpc(client: RpcClient, name: string, args: Record<string, string | number | boolean | null>) {
  const call = client.rpc.bind(client) as unknown as (
    fn: string,
    params: Record<string, string | number | boolean | null>,
  ) => Promise<{ data: Json | null; error: unknown }>;
  return call(name, args);
}

/** Applies only a Flutterwave-retrieved transfer, never webhook body status. */
export async function applyInternationalTransfer(t: VerifiedTransfer, expectedReference: string) {
  if (t.reference !== expectedReference || !expectedReference.startsWith("F3X-")) {
    throw new Error("INTERNATIONAL_REFERENCE_MISMATCH");
  }
  const { data, error } = await rpc(supabaseAdmin, "finish_international_withdrawal", {
    _reference: expectedReference,
    _provider_transfer_id: t.id,
    _outcome: transferOutcome(t.status),
    _amount: t.amount,
    _currency: t.currency.toUpperCase(),
  });
  if (error) throw new Error("INTERNATIONAL_SETTLEMENT_FAILED");
  return data;
}

export async function processInternationalTransferNotice(id: string, reference: string) {
  if (!reference.startsWith("F3X-")) throw new Error("INVALID_INTERNATIONAL_REFERENCE");
  return applyInternationalTransfer(await getTransfer(id), reference);
}

export async function refreshInternationalWithdrawal(reference: string, providerId: string | null) {
  const t = providerId
    ? await getTransfer(providerId)
    : await findTransferByReference(reference).catch(() => null);
  if (!t) return { status: "pending" };
  return (await applyInternationalTransfer(t, reference)) as { status: string };
}

/**
 * Creates one international bank transfer after the atomic wallet reservation.
 * An uncertain provider result remains pending and is reconciled by reference;
 * this function never blindly retries a transfer POST.
 */
export async function submitInternationalWithdrawal(
  input: InternationalWithdrawalInput,
  userId: string,
  authenticatedClient: RpcClient,
) {
  if (!userId) return { ok: false as const, error: "wallet_context_unavailable" };
  if (!internationalWithdrawalsEnabled(process.env)) return { ok: false as const, error: "international_withdrawals_locked" };
  const allowed = await authenticatedClient.rpc("consume_rate_limit", {
    _bucket: "international_withdrawal",
    _limit: 5,
    _window_seconds: 3600,
  });
  if (allowed.error || allowed.data !== true) {
    return { ok: false as const, error: "temporarily_unavailable" };
  }

  const reference = `F3X-${randomUUID()}`;
  const built = buildInternationalTransferPayload(input, reference);
  if (!built.ok) return { ok: false as const, error: built.reason, invalidFields: built.invalidFields };

  const fingerprint = createHash("sha256").update(built.fingerprint).digest("hex");
  const reserved = await rpc(supabaseAdmin, "reserve_international_withdrawal", {
    _user_id: userId,
    _idempotency_key: input.idempotencyKey,
    _route_id: built.routeId,
    _country: input.destinationCountry.toUpperCase(),
    _currency: input.currency.toUpperCase(),
    _method: input.method,
    _amount: input.amount,
    _request_fingerprint: fingerprint,
  });
  if (reserved.error) return { ok: false as const, error: "withdrawal_reservation_unavailable" };

  const reservation = reserved.data as { status?: string; reference?: string; payout?: number; withdrawal_status?: string } | null;
  if (!reservation?.status) return { ok: false as const, error: "withdrawal_reservation_unavailable" };
  if (reservation.status === "existing" && reservation.reference) {
    // An idempotent replay reports the existing request; it never submits a second transfer.
    return { ok: true as const, reference: reservation.reference, status: (["successful", "failed", "review"].includes(reservation.withdrawal_status ?? "") ? reservation.withdrawal_status : "pending") as "pending" | "successful" | "failed" | "review" };
  }
  if (reservation.status !== "reserved" || !reservation.reference || typeof reservation.payout !== "number") {
    const messages: Record<string, string> = {
      insufficient: "insufficient_balance",
      no_account: "wallet_context_unavailable",
      wallet_country_mismatch: "wallet_country_mismatch",
      route_not_verified: "not_merchant_verified",
    };
    return { ok: false as const, error: messages[reservation.status] ?? "withdrawal_unavailable" };
  }

  try {
    const created = await createInternationalTransfer(built.payload);
    if (!created) return { ok: true as const, reference: reservation.reference, status: "pending" as const };
    try {
      const verified = await getTransfer(created.id);
      const settled = await applyInternationalTransfer(verified, reservation.reference) as { status?: string } | null;
      return {
        ok: true as const,
        reference: reservation.reference,
        status: settled?.status === "successful" || settled?.status === "failed" ? settled.status : "pending" as const,
      };
    } catch {
      return { ok: true as const, reference: reservation.reference, status: "pending" as const };
    }
  } catch (error) {
    if (error instanceof ProviderRejected) {
      const { error: finishError } = await rpc(supabaseAdmin, "finish_international_withdrawal", {
        _reference: reservation.reference,
        _provider_transfer_id: null,
        _outcome: "failed",
        _amount: reservation.payout,
        _currency: input.currency.toUpperCase(),
      });
      if (finishError) return { ok: true as const, reference: reservation.reference, status: "pending" as const };
      return { ok: false as const, error: "provider_rejected" };
    }
    // Network timeouts and 5xx responses have an unknown outcome. Keep funds reserved.
    return { ok: true as const, reference: reservation.reference, status: "pending" as const };
  }
}
