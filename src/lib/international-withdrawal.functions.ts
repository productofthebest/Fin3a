import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTERNATIONAL_LIVE_WITHDRAWALS_ENABLED, INTERNATIONAL_LOCKED, internationalWithdrawalInput } from "./international-withdrawal";
import { INTERNATIONAL_PAYOUT_ROUTES } from "./international-payout-routes";
import type { VerifiedMerchantRoute } from "./international-beneficiary";

type RpcClient = { rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> };
export type InternationalHistoryRow = { reference: string; currency: string; amount_minor: number; payout_minor: number; exponent: number; status: string; created_at: string };
type InternationalReadClient = { from(table: "international_withdrawals"): {
  select(columns: string): { eq(column: string, value: string): { order(column: string, options: { ascending: boolean }): { limit(n: number): Promise<{ data: InternationalHistoryRow[] | null; error: unknown }> } } }
} };

export const getInternationalWithdrawalOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: settings, error } = await context.supabase.from("user_settings").select("country").eq("user_id", context.userId).maybeSingle();
    if (error || !settings) throw new Error("Could not load withdrawal options.");
    // No private merchant evidence is projected into the customer response.
    const routes = INTERNATIONAL_PAYOUT_ROUTES.filter(r => r.country === settings.country);
    return { enabled: false as const, message: INTERNATIONAL_LOCKED, country: settings.country,
      routes: routes.map(r => ({ country: r.country, currency: r.currency, method: r.method, enabled: false as const })) };
  });

export const createInternationalWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => internationalWithdrawalInput.parse(input))
  .handler(async () => {
    // Reject before reads, reservation or provider calls. The approved migration
    // also enforces its own immutable false gate against direct RPC callers.
    if (!INTERNATIONAL_LIVE_WITHDRAWALS_ENABLED) return { status: "locked" as const, message: INTERNATIONAL_LOCKED };
    return { status: "locked" as const, message: INTERNATIONAL_LOCKED };
  });

export const getInternationalWithdrawalHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as InternationalReadClient;
    const { data, error } = await client.from("international_withdrawals")
      .select("reference,currency,amount_minor,payout_minor,exponent,status,created_at")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50);
    if (error) return { rows: [] as InternationalHistoryRow[], unavailable: true };
    return { rows: data ?? [], unavailable: false };
  });

const verificationInput = z.object({
  routeId: z.string().regex(/^flw:GH:GHS:(bank|mobile_money)$/),
  method: z.enum(["bank", "mobile_money"]), environment: z.enum(["sandbox", "production"]),
  providerCodes: z.array(z.string().regex(/^[A-Za-z0-9]{2,12}$/)).min(1).max(100),
  evidenceRef: z.string().trim().min(3).max(200), expiresAt: z.string().datetime({ offset: true }),
  feeMinor: z.number().int().nonnegative().safe(), maxMinor: z.number().int().positive().safe().max(1_000_000_000_000), revoked: z.boolean(),
}).strict().refine(v => v.routeId === `flw:GH:GHS:${v.method}` && v.maxMinor > v.feeMinor);

export const verifyInternationalMerchantRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => verificationInput.parse(input))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase as unknown as RpcClient;
    const result = await rpc.rpc("admin_verify_international_route", {
      _route_id: data.routeId, _country: "GH", _currency: "GHS", _method: data.method, _environment: data.environment,
      _schema_version: "flw-v3-gh-bank-momo-1", _provider_codes: data.providerCodes, _evidence_ref: data.evidenceRef,
      _expires_at: data.expiresAt, _fee_minor: data.feeMinor, _max_minor: data.maxMinor, _revoked: data.revoked,
    });
    if (result.error) throw new Error("Administrator approval and valid merchant evidence are required.");
    return { recorded: true, withdrawalsEnabled: false };
  });

export type { VerifiedMerchantRoute };