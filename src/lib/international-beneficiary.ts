import { z } from "zod";
import { validateBeneficiary, type PayoutRoute } from "./international-payout-routes";

export const GH_TRANSFER_SCHEMA = "flw-v3-gh-bank-momo-1";
export type VerifiedMerchantRoute = {
  route_id: string; country: string; currency: string; method: "bank" | "mobile_money";
  environment: "sandbox" | "production"; schema_version: string; provider_codes: string[];
  evidence_ref: string; verified_by: string; verified_at: string; expires_at: string;
  revoked: boolean; fee_minor: number; max_minor: number;
};
export function merchantRouteReady(r: VerifiedMerchantRoute, route: PayoutRoute, now = new Date()): boolean {
  const at = Date.parse(r.verified_at), expiry = Date.parse(r.expires_at);
  return r.route_id === route.id && r.country === route.country && r.currency === route.currency && r.method === route.method
    && r.country === "GH" && r.currency === "GHS" && r.schema_version === GH_TRANSFER_SCHEMA
    && r.environment === "production" && !r.revoked && Boolean(r.evidence_ref.trim() && r.verified_by.trim())
    && Number.isFinite(at) && at <= now.getTime() && Number.isFinite(expiry) && expiry > now.getTime()
    && r.provider_codes.length > 0 && r.provider_codes.every(c => /^[A-Za-z0-9]{2,12}$/.test(c))
    && Number.isSafeInteger(r.fee_minor) && r.fee_minor >= 0 && Number.isSafeInteger(r.max_minor) && r.max_minor > r.fee_minor;
}

/** Only the documented Ghana V3 common-field bank/momo mapping is implemented.
 * No generic EU/US/UK/ZA validator is treated as an executable adapter.
 * Codes must come from the exact merchant verification's provider catalog.
 */
export function buildInternationalTransferFields(route: PayoutRoute, record: VerifiedMerchantRoute, beneficiary: Record<string, string>):
  | { ok: true; fields: { account_bank: string; account_number: string; beneficiary_name: string; currency: "GHS"; debit_currency: "GHS" } }
  | { ok: false; reason: string } {
  if (!merchantRouteReady(record, route)) return { ok: false, reason: "route_unverified" };
  const allowed = route.method === "bank" ? ["accountName", "bankCode", "accountNumber"] : ["accountName", "network", "mobileNumber"];
  if (!z.record(z.string().max(200)).safeParse(beneficiary).success || Object.keys(beneficiary).some(k => !allowed.includes(k))) return { ok: false, reason: "invalid_beneficiary" };
  const validated = validateBeneficiary(route, beneficiary);
  if (!validated.ok) return { ok: false, reason: "invalid_beneficiary" };
  const code = route.method === "bank" ? validated.normalized.bankCode : validated.normalized.network;
  const number = route.method === "bank" ? validated.normalized.accountNumber : validated.normalized.mobileNumber;
  const name = validated.normalized.accountName;
  if (!code || !number || !name || !record.provider_codes.includes(code)) return { ok: false, reason: "unverified_provider_code" };
  return { ok: true, fields: { account_bank: code, account_number: number, beneficiary_name: name, currency: "GHS", debit_currency: "GHS" } };
}