import { getCollectionCapability, supportsApplePay, supportsCollectionCards } from "@/lib/flutterwave-capabilities";

export type DepositMethodId = "bank-transfer" | "debit-card" | "apple-pay" | "google-pay";

export type DepositMethodEligibility = {
  countrySupported: boolean | null;
  merchantConfirmed: false;
  usable: boolean;
  message: string;
};

export function getDepositMethodEligibility(
  method: DepositMethodId,
  country: string,
  currency: string,
): DepositMethodEligibility {
  const code = country.trim().toUpperCase();
  const collection = getCollectionCapability(code);

  switch (method) {
    case "bank-transfer": {
      const countrySupported = collection?.methods.includes("banktransfer") ?? false;
      const liveNgnFlow = code === "NG" && currency.toUpperCase() === "NGN";
      return {
        countrySupported: countrySupported || liveNgnFlow,
        merchantConfirmed: false,
        usable: liveNgnFlow,
        message: liveNgnFlow
          ? "Nigeria bank-transfer top-ups use Fin3a’s existing verified NGN top-up flow. Follow the account instructions below and wait for payment confirmation."
          : countrySupported
            ? "Bank transfer is listed for this country, but a live Fin3a merchant route and settlement flow have not been confirmed. It is not enabled yet."
            : "Bank transfer is not listed for this country in the current payment capability matrix.",
      };
    }
    case "debit-card": {
      const countrySupported = supportsCollectionCards(code);
      return {
        countrySupported,
        merchantConfirmed: false,
        usable: false,
        message: countrySupported
          ? "Card collection is listed for this country. Fin3a merchant activation and a verified hosted-checkout response have not been confirmed, so card deposits are not enabled yet."
          : "Card collection is not listed for this country in the current payment capability matrix.",
      };
    }
    case "apple-pay": {
      const countrySupported = supportsApplePay(code);
      return {
        countrySupported,
        merchantConfirmed: false,
        usable: false,
        message: countrySupported
          ? "Apple Pay is listed for this region, but availability still depends on Fin3a merchant approval and confirmation from the actual hosted checkout. It is not enabled until that check succeeds."
          : "Apple Pay is not listed for this region in the current provider capability matrix.",
      };
    }
    case "google-pay":
      return {
        countrySupported: null,
        merchantConfirmed: false,
        usable: false,
        message: "Google Pay availability can only be confirmed by the actual Fin3a merchant checkout session. That confirmation is not currently available, so Google Pay is not enabled yet.",
      };
  }
}
