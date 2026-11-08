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

/**
 * Non-monetary, fail-closed preflight. The wallet country is supplied by the
 * authenticated server after reading user_settings; the requested currency is
 * separately checked against an account owned by that user. No merchant
 * verification records are supplied, so this can never authorize a payout.
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
  if (decision.ok) {
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
