import { COUNTRY_CURRENCY } from "./country-currency";

export const WITHDRAWAL_TOKENS = ["USDT", "USDC"] as const;
// Deposit addresses and QR recognition are not evidence of a payout network.
export const VERIFIED_CRYPTO_WITHDRAWAL_NETWORKS: readonly string[] = [];

export function withdrawalOptions(country: string, currency: string, ngnEnabled: boolean) {
  const local = COUNTRY_CURRENCY[country];
  const isNigeriaNgn = country === "NG" && currency === "NGN";
  const isUsUsd = country === "US" && currency === "USD";
  const isLocalFiatContext = Boolean(local && local === currency);
  return {
    visible: true,
    ngn: isNigeriaNgn,
    usd: isUsUsd,
    currency: local ?? null,
    localFiat: isLocalFiatContext,
    bankEnabled: isNigeriaNgn && ngnEnabled,
    bankReason: isNigeriaNgn
      ? "NGN bank withdrawals remain unavailable until secure payment setup is verified."
      : isLocalFiatContext
        ? `${currency} bank withdrawals are unavailable: no verified, enabled payout route is connected.`
        : "Bank withdrawals are unavailable for this country and wallet currency.",
    // Crypto payout amounts are USD-denominated for every country. This does not
    // authorize conversion or debit of a non-USD fiat wallet.
    cryptoCurrency: "USD" as const,
    tokens: WITHDRAWAL_TOKENS,
    cryptoEnabled: false as const,
    networks: VERIFIED_CRYPTO_WITHDRAWAL_NETWORKS,
  };
}
