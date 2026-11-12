import { COUNTRY_CURRENCY } from "./country-currency";

export const WITHDRAWAL_TOKENS = ["USDT", "USDC"] as const;
// Deposit addresses and QR recognition are not evidence of a payout network.
export const VERIFIED_CRYPTO_WITHDRAWAL_NETWORKS: readonly string[] = [];

export type VerifiedBankPayoutRoute = {
  country: string;
  currency: string;
  enabled: true;
};

/**
 * Presentation policy only. A route is shown as available only when an explicit
 * server-provided merchant capability says that exact country/currency corridor
 * is enabled. This is not an authorization boundary: payout handlers must repeat
 * the same checks against trusted server configuration before reserving funds.
 */
export function withdrawalOptions(
  country: string,
  currency: string,
  ngnEnabled: boolean,
  verifiedBankPayoutRoutes: readonly VerifiedBankPayoutRoute[] = [],
) {
  const countryCode = country.trim().toUpperCase();
  const selectedCurrency = currency.trim().toUpperCase();
  const local = COUNTRY_CURRENCY[countryCode];
  const isNigeriaNgn = countryCode === "NG" && selectedCurrency === "NGN";
  const isUsUsd = countryCode === "US" && selectedCurrency === "USD";
  const isLocalFiatContext = Boolean(local && local === selectedCurrency);
  const verifiedBankRoute = verifiedBankPayoutRoutes.some(
    (route) =>
      route.enabled === true &&
      route.country.trim().toUpperCase() === countryCode &&
      route.currency.trim().toUpperCase() === selectedCurrency,
  );
  const localBankEnabled = isLocalFiatContext && verifiedBankRoute;

  // Non-US users see bank withdrawal on a non-USD local wallet and crypto
  // withdrawal on their USD wallet. The US has one USD wallet and sees both.
  // Countries whose local currency is USD (for example Ecuador) follow the
  // non-US USD-wallet rule and therefore see crypto only.
  const showBankMethod = isUsUsd || (local !== "USD" && isLocalFiatContext);
  const showCryptoMethod = selectedCurrency === "USD";

  return {
    visible: true,
    ngn: isNigeriaNgn,
    usd: isUsUsd,
    currency: local ?? null,
    localFiat: isLocalFiatContext,
    showBankMethod,
    showCryptoMethod,
    defaultMethod: showBankMethod ? ("bank" as const) : ("crypto" as const),
    // Existing NGN form has its own reviewed implementation and feature gate.
    bankEnabled: isNigeriaNgn && ngnEnabled,
    // For other corridors, exact merchant enablement is mandatory. The frontend
    // must still call a backend route that independently enforces this allowlist.
    localBankEnabled,
    bankReason: isNigeriaNgn
      ? "NGN bank withdrawals remain unavailable until secure payment setup is verified."
      : isLocalFiatContext && !localBankEnabled
        ? `${selectedCurrency} bank withdrawals are unavailable: this payout corridor is not verified and enabled for this merchant account.`
        : "Bank withdrawals are unavailable for this country and wallet currency.",
    // Crypto payout amounts are USD-denominated for every country. This does not
    // authorize conversion or debit of a non-USD fiat wallet.
    cryptoCurrency: "USD" as const,
    tokens: WITHDRAWAL_TOKENS,
    cryptoEnabled: false as const,
    networks: VERIFIED_CRYPTO_WITHDRAWAL_NETWORKS,
  };
}
