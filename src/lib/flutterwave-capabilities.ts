/**
 * Flutterwave's published V3 collection and bank-payout coverage.
 * This matrix is provider documentation only: merchant approval, account settings,
 * currency settlement, KYC, risk limits and actual API responses remain authoritative.
 */
export const FLUTTERWAVE_COLLECTIONS = [
  { country: "NG", name: "Nigeria", currency: "NGN", methods: ["card"], applePay: true },
  { country: "US", name: "United States", currency: "USD", methods: ["card", "account"], applePay: true },
  { country: "GB", name: "United Kingdom", currency: "GBP", methods: ["card", "account"], applePay: true },
  { country: "EU", name: "Europe / SEPA", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "AT", name: "Austria", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "BE", name: "Belgium", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "CY", name: "Cyprus", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "DE", name: "Germany", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "EE", name: "Estonia", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "ES", name: "Spain", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "FI", name: "Finland", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "FR", name: "France", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "GR", name: "Greece", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "HR", name: "Croatia", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "IE", name: "Ireland", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "IT", name: "Italy", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "LT", name: "Lithuania", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "LU", name: "Luxembourg", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "LV", name: "Latvia", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "MT", name: "Malta", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "NL", name: "Netherlands", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "PT", name: "Portugal", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "SI", name: "Slovenia", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "SK", name: "Slovakia", currency: "EUR", methods: ["card", "account"], applePay: true },
  { country: "GH", name: "Ghana", currency: "GHS", methods: ["card", "mobilemoneyghana"], applePay: false },
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
  { country: "AT", name: "Austria", currency: "EUR" },
  { country: "BE", name: "Belgium", currency: "EUR" },
  { country: "CY", name: "Cyprus", currency: "EUR" },
  { country: "DE", name: "Germany", currency: "EUR" },
  { country: "EE", name: "Estonia", currency: "EUR" },
  { country: "ES", name: "Spain", currency: "EUR" },
  { country: "FI", name: "Finland", currency: "EUR" },
  { country: "FR", name: "France", currency: "EUR" },
  { country: "GR", name: "Greece", currency: "EUR" },
  { country: "HR", name: "Croatia", currency: "EUR" },
  { country: "IE", name: "Ireland", currency: "EUR" },
  { country: "IT", name: "Italy", currency: "EUR" },
  { country: "LT", name: "Lithuania", currency: "EUR" },
  { country: "LU", name: "Luxembourg", currency: "EUR" },
  { country: "LV", name: "Latvia", currency: "EUR" },
  { country: "MT", name: "Malta", currency: "EUR" },
  { country: "NL", name: "Netherlands", currency: "EUR" },
  { country: "PT", name: "Portugal", currency: "EUR" },
  { country: "SI", name: "Slovenia", currency: "EUR" },
  { country: "SK", name: "Slovakia", currency: "EUR" },
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

/** FX trading is a separate, merchant-enabled Flutterwave product, not transfer-rate lookup. */
export const FLUTTERWAVE_FX_PAIRS = [
  { from: "NGN", to: "USD" },
  { from: "GHS", to: "USD" },
  { from: "USD", to: "NGN" },
] as const;
export const FLUTTERWAVE_FX_MINIMUM_USD_EQUIVALENT = 1_000;

export function supportsFlutterwaveFxPair(from: string, to: string): boolean {
  const source = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  return FLUTTERWAVE_FX_PAIRS.some(pair => pair.from === source && pair.to === target);
}

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
