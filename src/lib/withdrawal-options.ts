import { COUNTRY_CURRENCY } from "./country-currency";

export const WITHDRAWAL_TOKENS = ["USDT", "USDC"] as const;
// Deposit addresses and QR recognition are not evidence of a payout network.
export const VERIFIED_CRYPTO_WITHDRAWAL_NETWORKS: readonly string[] = [];
export function withdrawalOptions(country: string, currency: string, ngnEnabled: boolean) {
  const local = COUNTRY_CURRENCY[country];
  const ngn = country === "NG" && currency === "NGN";
  const usd = country === "US" && currency === "USD";
  const localContext = Boolean(local && local === currency && (currency !== "USD" || usd));
  return { visible: true, ngn, usd, currency: local ?? null,
    bankEnabled: ngn && ngnEnabled,
    bankReason: ngn ? "Bank withdrawals remain unavailable until secure payment setup is verified."
      : localContext ? `${currency} bank withdrawals are unavailable: no verified, enabled payout route is connected.`
      : "Bank withdrawals are unavailable for this country and wallet currency.",
    tokens: WITHDRAWAL_TOKENS, cryptoEnabled: false as const,
    networks: VERIFIED_CRYPTO_WITHDRAWAL_NETWORKS };
}