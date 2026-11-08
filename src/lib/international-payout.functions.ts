import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  internationalPayoutPreflightInput,
  runAuthenticatedInternationalPayoutPreflight,
  type InternationalPayoutPreflightDatabase,
} from "./international-payout-api";
import { findRoute, type MerchantRouteVerification } from "./international-payout-routes";
import { internationalWithdrawalInput } from "./international-payout-settlement";
import {
  refreshInternationalWithdrawal,
  submitInternationalWithdrawal,
} from "./international-payout-settlement.server";

type RouteVerificationRow = {
  route_id: string;
  verified_at: string;
  verified_by: string;
  evidence_ref: string;
  expires_at: string | null;
};

/** Route evidence is server-only. Missing table, row, or query permission fails closed. */
async function loadRouteVerification(routeId: string): Promise<MerchantRouteVerification[]> {
  const admin = supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: RouteVerificationRow | null; error: unknown | null }>;
          };
        };
      };
    };
  };
  try {
    const { data, error } = await admin.from("flutterwave_payout_route_verifications")
      .select("route_id, verified_at, verified_by, evidence_ref, expires_at")
      .eq("route_id", routeId)
      .eq("status", "verified")
      .maybeSingle();
    if (error || !data) return [];
    return [{
      routeId: data.route_id,
      verifiedAt: data.verified_at,
      verifiedBy: data.verified_by,
      evidenceRef: data.evidence_ref,
      expiresAt: data.expires_at,
    }];
  } catch {
    return [];
  }
}

async function preflight(data: z.infer<typeof internationalPayoutPreflightInput>, userId: string, supabase: unknown) {
  const route = findRoute(data.destinationCountry, data.currency, data.method);
  const records = route ? await loadRouteVerification(route.id) : [];
  return runAuthenticatedInternationalPayoutPreflight(
    data,
    userId,
    supabase as InternationalPayoutPreflightDatabase,
    records,
  );
}

/** Authenticated, non-monetary preflight. No balances are reserved here. */
export const validateInternationalPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => internationalPayoutPreflightInput.parse(input))
  .handler(async ({ data, context }) => preflight(data, context.userId, context.supabase));

/** Creates a payout only when the route has current merchant evidence and both kill switches pass. */
export const createInternationalWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => internationalWithdrawalInput.parse(input))
  .handler(async ({ data, context }) => {
    const decision = await preflight({
      walletCurrency: data.walletCurrency,
      destinationCountry: data.destinationCountry,
      currency: data.currency,
      method: data.method,
      beneficiary: data.beneficiary,
    }, context.userId, context.supabase);
    if (!decision.ok) {
      return { ok: false as const, error: decision.reason, invalidFields: decision.invalidFields ?? [] };
    }
    return submitInternationalWithdrawal(data, context.userId, context.supabase);
  });

/** Owner-scoped reconciliation. A pending result never releases the reservation. */
export const checkInternationalWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ reference: z.string().regex(/^F3X-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: { reference: string; status: string; provider_transfer_id: string | null } | null; error: unknown | null }>;
            };
          };
        };
      };
    };
    const { data: row, error } = await client.from("international_withdrawals")
      .select("reference, status, provider_transfer_id")
      .eq("user_id", context.userId)
      .eq("reference", data.reference)
      .maybeSingle();
    if (error || !row) throw new Error("Withdrawal not found.");
    if (row.status !== "pending") return { status: row.status };
    try {
      return await refreshInternationalWithdrawal(row.reference, row.provider_transfer_id);
    } catch {
      return { status: "pending" };
    }
  });
