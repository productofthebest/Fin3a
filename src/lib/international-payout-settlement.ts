import { z } from "zod";
import { isValidAbaRouting, isValidBic, isValidIban, findRoute, toMinorUnits } from "./international-payout-routes";

const allowedBeneficiaryFields = new Set([
  "accountName", "accountNumber", "routingNumber", "swiftCode", "bankName",
  "accountType", "address", "postalCode", "streetNumber", "streetName", "city", "iban",
  "email", "mobileNumber", "firstName", "lastName", "beneficiaryMerchantName",
]);

const beneficiarySchema = z.record(z.string(), z.string().max(200)).refine(
  fields => Object.keys(fields).every(key => allowedBeneficiaryFields.has(key)),
  "Unsupported beneficiary field",
);

export const internationalWithdrawalInput = z.object({
  walletCurrency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  destinationCountry: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/),
  method: z.literal("bank"),
  amount: z.number().finite().positive().max(1_000_000),
  idempotencyKey: z.string().uuid(),
  beneficiary: beneficiarySchema,
}).strict();

export type InternationalWithdrawalInput = z.infer<typeof internationalWithdrawalInput>;

export type ProviderTransferPayload = {
  account_number: string;
  beneficiary_name: string;
  amount: number;
  currency: string;
  debit_currency: string;
  reference: string;
  narration: string;
  meta: Array<Record<string, string>>;
};

export type TransferPayloadResult =
  | { ok: true; routeId: string; payload: ProviderTransferPayload; fingerprint: string }
  | { ok: false; reason: string; invalidFields?: string[] };

const text = (v: unknown, max = 160): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
const cleanDigits = (v: string) => v.replace(/[\s-]/g, "");
const cleanCode = (v: string) => v.trim().replace(/\s/g, "").toUpperCase();
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Builds only the documented Flutterwave V3 USD/GBP/EUR international-bank
 * transfer shape. Other corridors remain validation-only until their exact
 * provider metadata and account permissions have been verified.
 */
export function buildInternationalTransferPayload(
  input: InternationalWithdrawalInput,
  reference: string,
): TransferPayloadResult {
  const country = input.destinationCountry.toUpperCase();
  const currency = input.currency.toUpperCase();
  const walletCurrency = input.walletCurrency.toUpperCase();
  const route = findRoute(country, currency, input.method);
  if (!route) return { ok: false, reason: "unknown_route" };
  if (walletCurrency !== currency) return { ok: false, reason: "wallet_currency_mismatch" };
  if (country !== "US" && country !== "GB" && !["AT","BE","CY","DE","EE","ES","FI","FR","GR","HR","IE","IT","LT","LU","LV","MT","NL","PT","SI","SK"].includes(country)) {
    return { ok: false, reason: "provider_schema_pending" };
  }
  if (!/^F3X-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(reference)) {
    return { ok: false, reason: "invalid_reference" };
  }
  if (toMinorUnits(input.amount, currency) === null) return { ok: false, reason: "invalid_amount" };

  const b = input.beneficiary;
  const invalid: string[] = [];
  const accountName = b.accountName?.trim() ?? "";
  if (!text(accountName, 120) || !/^\p{L}[\p{L} .'-]{1,99}$/u.test(accountName)) invalid.push("accountName");

  let accountNumber = "";
  const meta: Record<string, string> = {};
  const bankName = b.bankName?.trim() ?? "";
  const routing = cleanCode(b.routingNumber ?? "");
  const swift = cleanCode(b.swiftCode ?? "");

  if (!text(bankName, 120)) invalid.push("bankName");
  else meta.bank_name = bankName;

  if (currency === "USD") {
    accountNumber = cleanDigits(b.accountNumber ?? "");
    if (!/^\d{4,17}$/.test(accountNumber)) invalid.push("accountNumber");
    if (!isValidAbaRouting(routing)) invalid.push("routingNumber");
    else meta.routing_number = routing;
    if (!isValidBic(swift, "US")) invalid.push("swiftCode");
    else meta.swift_code = swift;
    if (!["checking", "depository"].includes(b.accountType ?? "")) invalid.push("accountType");
    else meta.account_type = b.accountType!;
    if (!text(b.address, 180)) invalid.push("address");
    else meta.beneficiary_address = b.address.trim();
    if (!text(b.postalCode, 20)) invalid.push("postalCode");
    else meta.postal_code = b.postalCode.trim();
    if (!text(b.streetNumber, 30)) invalid.push("streetNumber");
    else meta.street_number = b.streetNumber.trim();
    if (!text(b.streetName, 100)) invalid.push("streetName");
    else meta.street_name = b.streetName.trim();
  } else if (currency === "GBP") {
    accountNumber = cleanDigits(b.accountNumber ?? "");
    if (!/^\d{8}$/.test(accountNumber)) invalid.push("accountNumber");
    if (!/^\d{6}$/.test(routing)) invalid.push("routingNumber");
    else meta.routing_number = routing;
    if (!["personal", "corporate"].includes(b.accountType ?? "")) invalid.push("accountType");
    else meta.account_type = b.accountType!;
    if (b.accountType === "personal") {
      if (!text(b.firstName, 80)) invalid.push("firstName");
      else meta.first_name = b.firstName.trim();
      if (!text(b.lastName, 80)) invalid.push("lastName");
      else meta.last_name = b.lastName.trim();
      if (text(b.firstName, 80) && text(b.lastName, 80) && text(accountName, 120)
        && !sameName(accountName, b.firstName + " " + b.lastName)) invalid.push("beneficiaryNameMismatch");
    } else if (b.accountType === "corporate") {
      if (!text(b.beneficiaryMerchantName, 120)) invalid.push("beneficiaryMerchantName");
      else meta.beneficiary_merchant_name = b.beneficiaryMerchantName.trim();
    }
    if (swift) {
      if (!isValidBic(swift, "GB")) invalid.push("swiftCode");
      else meta.swift_code = swift;
    }
  } else {
    accountNumber = cleanCode(b.iban ?? b.accountNumber ?? "");
    if (!isValidIban(accountNumber, country)) invalid.push("iban");
    if (!routing || routing.length > 40) invalid.push("routingNumber");
    else meta.routing_number = routing;
    if (!isValidBic(swift, country)) invalid.push("swiftCode");
    else meta.swift_code = swift;
    if (!text(b.postalCode, 20)) invalid.push("postalCode");
    else meta.postal_code = b.postalCode.trim();
    if (!text(b.streetNumber, 30)) invalid.push("streetNumber");
    else meta.street_number = b.streetNumber.trim();
    if (!text(b.streetName, 100)) invalid.push("streetName");
    else meta.street_name = b.streetName.trim();
    if (!text(b.city, 100)) invalid.push("city");
    else meta.city = b.city.trim();
  }

  if (b.email) {
    if (!validEmail(b.email)) invalid.push("email");
    else meta.email = b.email.trim();
  }
  if (b.mobileNumber) {
    if (!/^\+?[0-9]{7,18}$/.test(b.mobileNumber.replace(/[\s()-]/g, ""))) invalid.push("mobileNumber");
    else meta.mobile_number = b.mobileNumber.replace(/[\s()-]/g, "");
  }

  if (invalid.length) return { ok: false, reason: "invalid_beneficiary", invalidFields: [...new Set(invalid)] };

  const payload: ProviderTransferPayload = {
    account_number: accountNumber,
    beneficiary_name: accountName,
    amount: input.amount,
    currency,
    debit_currency: currency,
    reference,
    narration: "Fin3a international withdrawal",
    meta: [meta],
  };
  const { reference: _reference, ...fingerprintPayload } = payload;
  const fingerprint = stableFingerprint({ routeId: route.id, payload: fingerprintPayload });
  return { ok: true, routeId: route.id, payload, fingerprint };
}

function stableFingerprint(value: unknown): string {
  // A stable, deterministic fingerprint is used only for idempotency; no beneficiary
  // details are stored in the database or included in application logs.
  const canonical = JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
  // Web Crypto is not assumed in server modules; the caller hashes this canonical
  // string with Node crypto before persisting it.
  return canonical;
}
