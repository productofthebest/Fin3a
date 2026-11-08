import { z } from "zod";
import {
  evaluateRoute,
  findRoute,
  validateBeneficiary,
  type BeneficiaryInput,
  type RouteRequest,
} from "./international-payout-routes";

export const internationalPayoutPreflightInput = z.object({
  walletCountry: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
  walletCurrency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  destinationCountry: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  method: z.enum(["bank", "mobile_money"]),
  beneficiary: z.record(z.string(), z.unknown()),
}).strict();

export type InternationalPayoutPreflightInput = z.infer<typeof internationalPayoutPreflightInput>;

export type InternationalPayoutPreflightResult = {
  ok: false;
  enabled: false;
  reason: string;
  beneficiaryValid?: boolean;
  invalidFields?: string[];
};

/**
 * Non-monetary, fail-closed preflight. Merchant verification records are
 * intentionally not supplied here: no persisted, independently evidenced
 * route approval exists yet. This function can validate input shape only;
 * it can never authorize or initiate a payout.
 */
export function buildInternationalPayoutPreflight(
  input: InternationalPayoutPreflightInput,
): InternationalPayoutPreflightResult {
  const request: RouteRequest = {
    walletCountry: input.walletCountry,
    walletCurrency: input.walletCurrency,
    destinationCountry: input.destinationCountry,
    currency: input.currency,
    method: input.method,
  };

  const decision = evaluateRoute(request, []);
  if (decision.ok) {
    // Defensive invariant: the empty verification set must never authorize.
    return { ok: false, enabled: false, reason: "not_merchant_verified" };
  }
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
