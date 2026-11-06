/**
 * Flutterwave's published V3 collection and bank-payout coverage.
 * This matrix is provider documentation only: merchant approval, account settings,
 * currency settlement, KYC, risk limits and actual API responses remain authoritative.
 */
export const FLUTTERWAVE_COLLECTIONS = [
  { country: "NG", name: "Nigeria", currency: "NGN", methods: ["card", "ussd", "banktransfer", "account", "internetbanking", "nqr", "enaira", "opay"], applePay: true },
  { country: "US", name: "United States", currency: "USD", methods: ["card", "account"], applePay: true },
  { country: "GB", name: "United Kingdom", currency: "GBP", methods: ["card", "account"], applePay: true },
  { country: "EU", name: "Europe / SEPA", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "GH", name: "Ghana", currency: "GHS", methods: ["card", "ghanamobilemoney"], applePay: false },
  { country: "CM", name: "Cameroon", currency: "XAF", methods: ["card", "mobilemoneyxaf"], applePay: false },
  { country: "CI", name: "Côte d’Ivoire", currency: "XOF", methods: ["card", "mobilemoneyxof"], applePay: false },
  { country: "ZA", name: "South Africa", currency: "ZAR", methods: ["card", "account", "1voucher"], applePay: true },
  { country: "MW", name: "Malawi", currency: "MWK", methods: ["card", "mobilemoneymalawi"], applePay: false },
  { country: "KE", name: "Kenya", currency: "KES", methods: ["card", "mpesa"], applePay: false },
  { country: "UG", name: "Uganda", currency: "UGX", methods: ["card", "mobilemoneyuganda"], applePay: false },
  { country: "RW", name: "Rwanda", currency: "RWF", methods: ["card", "mobilemoneyrwanda"], applePay: false },
  { country: "TZ", name: "Tanzania", currency: "TZS", methods: ["card", "mobilemoneytanzania"], applePay: false },
  { country: "EG", name: "Egypt", currency: "EGP", methods: ["card", "fawrypay"], applePay: false },
  { country: "ZM", name: "Zambia", currency: "ZMW", methods: ["card", "mobilemoneyzambia"], applePay: false },
] as const;

/** Bank payout coverage is separate from collection coverage. */
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

export function supportsCollectionCards(country: string): boolean {
  return getCollectionCapability(country)?.methods.includes("card") ?? false;
}

export function supportsApplePay(country: string): boolean {
  return getCollectionCapability(country)?.applePay ?? false;
}

/**
 * Google Pay is not a documented V3 payment_options value or country-specific
 * method in the current V3 matrix. It may appear in hosted checkout only when
 * Flutterwave enables it for the merchant/account and checkout session.
 */
export function googlePayAvailability(): "merchant-checkout-only" {
  return "merchant-checkout-only";
}

/** Bank payout coverage is independent of collection coverage. */
export function getBankPayoutCurrency(country: string): string | null {
  return getBankPayoutCapability(country)?.currency ?? null;
}
