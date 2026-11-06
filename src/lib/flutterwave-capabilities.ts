/**
 * Flutterwave V3 published collection options and bank-transfer payout coverage.
 * This is a capability reference, not a guarantee that a specific merchant account
 * has been approved or enabled for every rail. Verify merchant settings, settlement
 * currency, destination bank codes, KYC and limits before enabling any operation.
 */
export const FLUTTERWAVE_COLLECTIONS = [
  { country: "NG", name: "Nigeria", currency: "NGN", methods: ["card", "ussd", "banktransfer", "account", "internetbanking", "nqr", "enaira", "opay"] },
  { country: "US", name: "United States", currency: "USD", methods: ["card", "account"] },
  { country: "GB", name: "United Kingdom", currency: "GBP", methods: ["card", "account"] },
  { country: "EU", name: "Europe / SEPA", currency: "EUR", methods: ["card", "account"] },
  { country: "GH", name: "Ghana", currency: "GHS", methods: ["card", "ghanamobilemoney"] },
  { country: "CM", name: "Cameroon", currency: "XAF", methods: ["card", "mobilemoneyxof"] },
  { country: "CI", name: "Côte d’Ivoire", currency: "XOF", methods: ["card", "mobilemoneyxaf"] },
  { country: "ZA", name: "South Africa", currency: "ZAR", methods: ["card", "account", "1voucher"] },
  { country: "MW", name: "Malawi", currency: "MWK", methods: ["card", "mobilemoneymalawi"] },
  { country: "KE", name: "Kenya", currency: "KES", methods: ["card", "mpesa"] },
  { country: "UG", name: "Uganda", currency: "UGX", methods: ["card", "mobilemoneyuganda"] },
  { country: "RW", name: "Rwanda", currency: "RWF", methods: ["card", "mobilemoneyrwanda"] },
  { country: "TZ", name: "Tanzania", currency: "TZS", methods: ["card", "mobilemoneytanzania"] },
  { country: "EG", name: "Egypt", currency: "EGP", methods: ["card", "fawrypay"] },
  { country: "ZM", name: "Zambia", currency: "ZMW", methods: ["card", "mobilemoneyzambia"] },
] as const;

/** Countries/currencies listed in Flutterwave V3 bank-account transfer documentation. */
export const FLUTTERWAVE_BANK_PAYOUTS = [
  { country: "NG", name: "Nigeria", currency: "NGN" },
  { country: "US", name: "United States", currency: "USD" },
  { country: "GB", name: "United Kingdom", currency: "GBP" },
  { country: "EU", name: "SEPA countries", currency: "EUR" },
  { country: "GH", name: "Ghana", currency: "GHS" },
  { country: "KE", name: "Kenya", currency: "KES" },
  { country: "MW", name: "Malawi", currency: "MWK" },
  { country: "TZ", name: "Tanzania", currency: "TZS" },
  { country: "UG", name: "Uganda", currency: "UGX" },
  { country: "CM", name: "Cameroon", currency: "XAF" },
  { country: "CI", name: "Côte d’Ivoire", currency: "XOF" },
  { country: "SN", name: "Senegal", currency: "XOF" },
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

export function getCollectionPaymentOptions(country: string): string[] {
  return [...(getCollectionCapability(country)?.methods ?? [])];
}

/** Bank payout coverage is independent of collection coverage. */
export function getBankPayoutCurrency(country: string): string | null {
  return getBankPayoutCapability(country)?.currency ?? null;
}
