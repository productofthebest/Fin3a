/**
 * Pure rules for future international payouts (Phase A).
 * Nothing here calls a provider, touches balances, or enables a payout.
 * Every route is disabled unless an explicit merchant-route verification record
 * is supplied; published provider capability metadata is never treated as approval.
 */
import { getBankPayoutCapability } from "./flutterwave-capabilities";

export type PayoutMethod = "bank" | "mobile_money";
export type PayoutRoute = {
  id: string;
  provider: "flutterwave";
  country: string;
  currency: string;
  method: PayoutMethod;
  /** Mobile-money networks accepted for this route. */
  networks?: readonly string[];
  /** International dialling prefix and national number length for mobile money. */
  dial?: { prefix: string; length: number };
};

const EU_COUNTRIES = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"] as const;

export const INTERNATIONAL_PAYOUT_ROUTES: readonly PayoutRoute[] = [
  { id: "flw:US:USD:bank", provider: "flutterwave", country: "US", currency: "USD", method: "bank" },
  { id: "flw:GB:GBP:bank", provider: "flutterwave", country: "GB", currency: "GBP", method: "bank" },
  ...EU_COUNTRIES.map(c => ({ id: `flw:${c}:EUR:bank`, provider: "flutterwave" as const, country: c, currency: "EUR", method: "bank" as const })),
  { id: "flw:GH:GHS:bank", provider: "flutterwave", country: "GH", currency: "GHS", method: "bank" },
  { id: "flw:GH:GHS:mobile_money", provider: "flutterwave", country: "GH", currency: "GHS", method: "mobile_money", networks: ["MTN", "VODAFONE", "AIRTELTIGO"], dial: { prefix: "233", length: 9 } },
  { id: "flw:KE:KES:bank", provider: "flutterwave", country: "KE", currency: "KES", method: "bank" },
  { id: "flw:KE:KES:mobile_money", provider: "flutterwave", country: "KE", currency: "KES", method: "mobile_money", networks: ["MPESA"], dial: { prefix: "254", length: 9 } },
  { id: "flw:UG:UGX:mobile_money", provider: "flutterwave", country: "UG", currency: "UGX", method: "mobile_money", networks: ["MTN", "AIRTEL"], dial: { prefix: "256", length: 9 } },
  { id: "flw:RW:RWF:mobile_money", provider: "flutterwave", country: "RW", currency: "RWF", method: "mobile_money", networks: ["MTN", "AIRTEL"], dial: { prefix: "250", length: 9 } },
  { id: "flw:TZ:TZS:mobile_money", provider: "flutterwave", country: "TZ", currency: "TZS", method: "mobile_money", networks: ["MPESA", "TIGO", "AIRTEL", "HALOPESA"], dial: { prefix: "255", length: 9 } },
  { id: "flw:ZA:ZAR:bank", provider: "flutterwave", country: "ZA", currency: "ZAR", method: "bank" },
];

/** Decimal places per currency; amounts are handled as integer minor units. */
export const CURRENCY_EXPONENT: Record<string, number> = { USD: 2, GBP: 2, EUR: 2, GHS: 2, KES: 2, ZAR: 2, NGN: 2, UGX: 0, RWF: 0, TZS: 2, XOF: 0, XAF: 0 };

export type MerchantRouteVerification = {
  routeId: string;
  verifiedAt: string; // ISO timestamp
  verifiedBy: string; // admin user id
  evidenceRef: string; // e.g. sandbox transfer id or provider approval reference
  expiresAt?: string | null;
};

export function findRoute(country: string, currency: string, method: PayoutMethod): PayoutRoute | null {
  const c = country.trim().toUpperCase();
  const cur = currency.trim().toUpperCase();
  return INTERNATIONAL_PAYOUT_ROUTES.find(r => r.country === c && r.currency === cur && r.method === method) ?? null;
}

/** A route is enabled only with a complete, unexpired verification record for that exact route. */
export function isRouteVerified(route: PayoutRoute, records: readonly MerchantRouteVerification[], now: Date = new Date()): boolean {
  return records.some(r => {
    if (r.routeId !== route.id || !r.verifiedBy?.trim() || !r.evidenceRef?.trim()) return false;
    const at = Date.parse(r.verifiedAt);
    if (!Number.isFinite(at) || at > now.getTime()) return false;
    if (r.expiresAt) {
      const exp = Date.parse(r.expiresAt);
      if (!Number.isFinite(exp) || exp <= now.getTime()) return false;
    }
    return true;
  });
}

export type RouteRequest = { walletCountry: string; walletCurrency: string; destinationCountry: string; currency: string; method: PayoutMethod };
export type RouteDecision =
  | { ok: true; route: PayoutRoute }
  | { ok: false; reason: "nigeria_uses_ngn_path" | "unknown_route" | "not_in_provider_coverage" | "wallet_country_mismatch" | "wallet_currency_mismatch" | "not_merchant_verified" };

export function evaluateRoute(req: RouteRequest, records: readonly MerchantRouteVerification[], now: Date = new Date()): RouteDecision {
  const dest = req.destinationCountry.trim().toUpperCase();
  const cur = req.currency.trim().toUpperCase();
  if (dest === "NG") return { ok: false, reason: "nigeria_uses_ngn_path" };
  const route = findRoute(dest, cur, req.method);
  if (!route) return { ok: false, reason: "unknown_route" };
  if (route.method === "bank" && getBankPayoutCapability(route.country)?.currency !== route.currency) return { ok: false, reason: "not_in_provider_coverage" };
  if (req.walletCountry.trim().toUpperCase() !== dest) return { ok: false, reason: "wallet_country_mismatch" };
  if (req.walletCurrency.trim().toUpperCase() !== cur) return { ok: false, reason: "wallet_currency_mismatch" };
  if (!isRouteVerified(route, records, now)) return { ok: false, reason: "not_merchant_verified" };
  return { ok: true, route };
}

/** Converts a decimal amount to integer minor units, rejecting excess precision. */
export function toMinorUnits(amount: number, currency: string): number | null {
  const exp = CURRENCY_EXPONENT[currency.toUpperCase()];
  if (exp === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const scaled = amount * 10 ** exp;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) return null;
  return rounded;
}

// ---------- Beneficiary validators ----------

type BeneficiaryField = "accountName" | "network" | "mobileNumber" | "accountNumber" | "routingNumber" | "address" | "sortCode" | "branchCode" | "bankCode" | "iban" | "swiftCode";
export type BeneficiaryInput = Partial<Record<BeneficiaryField, unknown>>;
export type BeneficiaryResult = { ok: true; normalized: Partial<Record<BeneficiaryField, string>> } | { ok: false; errors: string[] };

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\s-]/g, "").toUpperCase() : "");
const nameOk = (v: unknown) => typeof v === "string" && /^[\p{L}][\p{L} .'-]{1,99}$/u.test(v.trim());

export function isValidIban(raw: string, country?: string): boolean {
  const iban = clean(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (country && iban.slice(0, 2) !== country.toUpperCase()) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

export function isValidBic(raw: string, country?: string): boolean {
  const bic = clean(raw);
  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return false;
  return !country || bic.slice(4, 6) === country.toUpperCase();
}

/** ABA routing number with checksum. */
export function isValidAbaRouting(raw: string): boolean {
  const r = clean(raw);
  if (!/^\d{9}$/.test(r)) return false;
  const w = [3, 7, 1];
  const sum = r.split("").reduce((acc, ch, i) => acc + Number(ch) * (w[i % 3] ?? 0), 0);
  return sum % 10 === 0;
}

export function normalizeMobileNumber(raw: string, dial: { prefix: string; length: number }): string | null {
  let n = typeof raw === "string" ? raw.replace(/[\s()-]/g, "") : "";
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith(dial.prefix)) n = n.slice(dial.prefix.length);
  else if (n.startsWith("0")) n = n.slice(1);
  if (!new RegExp(`^[1-9]\\d{${dial.length - 1}}$`).test(n)) return null;
  return dial.prefix + n;
}

export function validateBeneficiary(route: PayoutRoute, input: BeneficiaryInput): BeneficiaryResult {
  const errors: string[] = [];
  const out: Partial<Record<BeneficiaryField, string>> = {};
  if (!nameOk(input.accountName)) errors.push("accountName");
  else out.accountName = String(input.accountName).trim();

  if (route.method === "mobile_money") {
    const network = clean(input.network);
    if (!route.networks?.includes(network)) errors.push("network");
    else out.network = network;
    const phone = route.dial ? normalizeMobileNumber(String(input.mobileNumber ?? ""), route.dial) : null;
    if (!phone) errors.push("mobileNumber");
    else out.mobileNumber = phone;
    return errors.length ? { ok: false, errors } : { ok: true, normalized: out };
  }

  const acct = clean(input.accountNumber);
  switch (route.country) {
    case "US": {
      if (!isValidAbaRouting(String(input.routingNumber ?? ""))) errors.push("routingNumber"); else out.routingNumber = clean(input.routingNumber);
      if (!/^\d{4,17}$/.test(acct)) errors.push("accountNumber"); else out.accountNumber = acct;
      const addr = typeof input.address === "string" ? input.address.trim() : "";
      if (addr.length < 5 || addr.length > 200) errors.push("address"); else out.address = addr;
      break;
    }
    case "GB": {
      const sort = clean(input.sortCode);
      if (!/^\d{6}$/.test(sort)) errors.push("sortCode"); else out.sortCode = sort;
      if (!/^\d{8}$/.test(acct)) errors.push("accountNumber"); else out.accountNumber = acct;
      break;
    }
    case "ZA": {
      const branch = clean(input.branchCode);
      if (!/^\d{6}$/.test(branch)) errors.push("branchCode"); else out.branchCode = branch;
      if (!/^\d{7,11}$/.test(acct)) errors.push("accountNumber"); else out.accountNumber = acct;
      break;
    }
    case "GH":
    case "KE": {
      const bank = clean(input.bankCode);
      if (!/^[A-Z0-9]{2,12}$/.test(bank)) errors.push("bankCode"); else out.bankCode = bank;
      if (!/^\d{6,16}$/.test(acct)) errors.push("accountNumber"); else out.accountNumber = acct;
      break;
    }
    default: {
      if (route.currency !== "EUR") { errors.push("unsupportedRoute"); break; }
      if (!isValidIban(String(input.iban ?? ""), route.country)) errors.push("iban"); else out.iban = clean(input.iban);
      if (!isValidBic(String(input.swiftCode ?? ""), route.country)) errors.push("swiftCode"); else out.swiftCode = clean(input.swiftCode);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, normalized: out };
}
