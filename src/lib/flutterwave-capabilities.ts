/**
 * Flutterwave's published country/currency/payment-method matrix.
 *
 * This is a product-side allowlist, not a promise that a merchant account is
 * enabled for every rail. The server must still enforce merchant eligibility,
 * currency settlement configuration, amount limits and provider verification.
 */
export const FLUTTERWAVE_COLLECTIONS = [
  { country: "NG", name: "Nigeria", currency: "NGN", methods: ["card", "ussd", "banktransfer", "account", "internetbanking", "nqr", "enaira", "opay"] },
  { country: "US", name: "United States", currency: "USD", methods: ["card", "account"] },
  { country: "GB", name: "United Kingdom", currency: "GBP", methods: ["card", "account"] },
  { country: "EU", name: "SEPA / Europe", currency: "EUR", methods: ["card", "account"] },
  { country: "GH", name: "Ghana", currency: "GHS", methods: ["card", "mobilemoneyghana"] },
  { country: "CM", name: "Cameroon", currency: "XAF", methods: ["card", "mobilemoneyxaf"] },
  { country: "CI", name: "Côte d’Ivoire", currency: "XOF", methods: ["card", "mobilemoneyxof"] },
  { country: "ZA", name: "South Africa", currency: "ZAR", methods: ["card", "account"] },
  { country: "MW", name: "Malawi", currency: "MWK", methods: ["card", "mobilemoneymalawi"] },
  { country: "KE", name: "Kenya", currency: "KES", methods: ["card", "mpesa"] },
  { country: "UG", name: "Uganda", currency: "UGX", methods: ["card", "mobilemoneyuganda"] },
  { country: "RW", name: "Rwanda", currency: "RWF", methods: ["card", "mobilemoneyrwanda"] },
  { country: "TZ", name: "Tanzania", currency: "TZS", methods: ["card", "mobilemoneytanzania"] },
  { country: "EG", name: "Egypt", currency: "EGP", methods: ["card", "fawrypay"] },
] as const;

export const FLUTTERWAVE_BANK_PAYOUTS = [
  { country: "NG", name: "Nigeria", currency: "NGN" },
  { country: "US", name: "United States", currency: "USD" },
  { country: "GB", name: "United Kingdom", currency: "GBP" },
  { country: "GH", name: "Ghana", currency: "GHS" },
  { country: "KE", name: "Kenya", currency: "KES" },
  { country: "MW", name: "Malawi", currency: "MWK" },
  { country: "TZ", name: "Tanzania", currency: "TZS" },
  { country: "UG", name: "Uganda", currency: "UGX" },
  { country: "CM", name: "Cameroon", currency: "XAF" },
  { country: "CI", name: "Côte d’Ivoire", currency: "XOF" },
  { country: "SN", name: "Senegal", currency: "XOF" },
  { country: "RW", name: "Rwanda", currency: "RWF" },
  { country: "ZA", name: "South Africa", currency: "ZAR" },
] as const;

export type FlutterwaveCollection = (typeof FLUTTERWAVE_COLLECTIONS)[number];
export type FlutterwaveBankPayout = (typeof FLUTTERWAVE_BANK_PAYOUTS)[number];

export function getCollectionCapability(country: string) {
  const code = country.trim().toUpperCase();
  return FLUTTERWAVE_COLLECTIONS.find(item => item.country === code) ?? null;
}

export function getBankPayoutCapability(country: string) {
  const code = country.trim().toUpperCase();
  return FLUTTERWAVE_BANK_PAYOUTS.find(item => item.country === code) ?? null;
}

/** Return only payment options documented for this country's collection currency. */
export function getCollectionPaymentOptions(country: string): string[] {
  return [...(getCollectionCapability(country)?.methods ?? [])];
}

/** Provider payout rails must not be inferred from collection support. */
export function getBankPayoutCurrency(country: string): string | null {
  return getBankPayoutCapability(country)?.currency ?? null;
}
