import { z } from "zod";
import {
  evaluateRoute,
  findRoute,
  validateBeneficiary,
  type BeneficiaryInput,
  type RouteRequest,
} from "./international-payout-routes";

const beneficiaryFields = new Set([
  "accountName", "network", "mobileNumber", "accountNumber", "routingNumber",
  "address", "sortCode", "branchCode", "bankCode", "iban", "swiftCode",
]);

const beneficiaryInput = z.record(z.string(), z.string().max(200)).refine(
  fields => Object.keys(fields).every(key => beneficiaryFields.has(key)),
  "Unsupported beneficiary field",
);

export const internationalPayoutPreflightInput = z.object({
  walletCurrency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  destinationCountry: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  method: z.enum(["bank", "mobile_money"]),
  beneficiary: beneficiaryInput,
}).strict();

export type InternationalPayoutPreflightInput = z.infer<typeof internationalPayoutPreflightInput>;

export type InternationalPayoutPreflightResult = {
  ok: false;
  enabled: false;
  reason: string;
  beneficiaryValid?: boolean;
  invalidFields?: string[];
};

type QueryResult = {
  data: { country?: string; currency?: string } | null;
  error: unknown | null;
};

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
};

/** Minimal database contract keeps the server decision independently testable. */
export type InternationalPayoutPreflightDatabase = {
  rpc(name: "consume_rate_limit", args: {
    _bucket: string;
    _limit: number;
    _window_seconds: number;
  }): Promise<{ data: boolean | null; error: unknown | null }>;
  from(table: "user_settings" | "accounts"): QueryBuilder;
};

/**
 * Authenticated server decision. userId comes only from verified Supabase claims.
 * Database errors, missing records, and rate-limit errors always fail closed.
 */
export async function runAuthenticatedInternationalPayoutPreflight(
  input: InternationalPayoutPreflightInput,
  userId: string,
  supabase: InternationalPayoutPreflightDatabase,
): Promise<InternationalPayoutPreflightResult> {
  if (!userId) return { ok: false, enabled: false, reason: "wallet_context_unavailable" };

  const { data: allowed, error: rateError } = await supabase.rpc("consume_rate_limit", {
    _bucket: "international_payout_preflight",
    _limit: 20,
    _window_seconds: 600,
  });
  if (rateError || allowed !== true) {
    return { ok: false, enabled: false, reason: "temporarily_unavailable" };
  }

  const [{ data: settings, error: settingsError }, { data: account, error: accountError }] = await Promise.all([
    supabase.from("user_settings").select("country").eq("user_id", userId).maybeSingle(),
    supabase.from("accounts").select("currency").eq("user_id", userId)
      .eq("currency", input.walletCurrency.toUpperCase()).maybeSingle(),
  ]);

  if (settingsError || accountError || !settings?.country || !account?.currency) {
    return { ok: false, enabled: false, reason: "wallet_context_unavailable" };
  }

  return buildInternationalPayoutPreflight(input, settings.country);
}

/**
 * Non-monetary, fail-closed preflight. No merchant verification records are
 * supplied, so this can never authorize a payout.
 */
export function buildInternationalPayoutPreflight(
  input: InternationalPayoutPreflightInput,
  trustedWalletCountry: string,
): InternationalPayoutPreflightResult {
  const request: RouteRequest = {
    walletCountry: trustedWalletCountry,
    walletCurrency: input.walletCurrency,
    destinationCountry: input.destinationCountry,
    currency: input.currency,
    method: input.method,
  };

  const decision = evaluateRoute(request, []);
  if (decision.ok) return { ok: false, enabled: false, reason: "not_merchant_verified" };
  if (decision.reason !== "not_merchant_verified") {
    return { ok: false, enabled: false, reason: decision.reason };
  }

  const route = findRoute(input.destinationCountry, input.currency, input.method);
  if (!route) return { ok: false, enabled: false, reason: "unknown_route" };

  const validation = validateBeneficiary(route, input.beneficiary as BeneficiaryInput);
  if (!validation.ok) {
    return {
      ok: false,
      enabled: false,
      reason: "invalid_beneficiary",
      beneficiaryValid: false,
      invalidFields: validation.errors,
    };
  }

  return {
    ok: false,
    enabled: false,
    reason: "not_merchant_verified",
    beneficiaryValid: true,
    invalidFields: [],
  };
}
