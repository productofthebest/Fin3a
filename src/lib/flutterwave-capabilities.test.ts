import { describe, expect, it } from "vitest";
import {
  getBankPayoutCapability,
  supportsFlutterwaveFxPair,
  FLUTTERWAVE_FX_MINIMUM_USD_EQUIVALENT,
  getBankPayoutCurrency,
  getCollectionCapability,
  getCollectionPaymentOptions,
  googlePayAvailability,
  supportsApplePay,
  supportsCollectionCards,
} from "./flutterwave-capabilities";

describe("Flutterwave country capabilities", () => {
  it("returns documented country-specific collection methods", () => {
    expect(getCollectionPaymentOptions("ke")).toEqual(["card", "mpesa"]);
    expect(getCollectionPaymentOptions("NG")).toEqual(["card"]);
    expect(getCollectionPaymentOptions("GH")).toEqual(["card", "mobilemoneyghana"]);
    expect(getCollectionPaymentOptions("CM")).toContain("mobilemoneyxaf");
    expect(getCollectionPaymentOptions("CI")).toContain("mobilemoneyxof");
    expect(getCollectionPaymentOptions("SN")).toContain("mobilemoneyxof");
    expect(getCollectionPaymentOptions("FR")).toEqual(["card", "account"]);
  });

  it("offers card collection in every country in the published collection matrix", () => {
    for (const country of ["NG", "US", "GB", "EU", "FR", "DE", "GH", "CM", "CI", "SN", "ZA", "MW", "KE", "UG", "RW", "TZ", "EG", "ZM"]) {
      expect(supportsCollectionCards(country), country).toBe(true);
    }
    expect(supportsCollectionCards("XX")).toBe(false);
  });

  it("limits Apple Pay to the countries listed in Flutterwave's regional channel table", () => {
    for (const country of ["NG", "US", "GB", "EU", "FR", "DE", "ZA"]) expect(supportsApplePay(country), country).toBe(true);
    for (const country of ["GH", "KE", "CM", "CI", "EG", "XX"]) expect(supportsApplePay(country), country).toBe(false);
  });

  it("does not pretend Google Pay is a V3 country payment option", () => {
    expect(googlePayAvailability()).toBe("merchant-checkout-only");
  });

  it("does not treat collection support as bank payout support", () => {
    expect(getCollectionCapability("ZM")).not.toBeNull();
    expect(getBankPayoutCapability("ZM")).toBeNull();
    expect(getBankPayoutCurrency("ZM")).toBeNull();
    expect(getCollectionCapability("RW")).not.toBeNull();
    expect(getBankPayoutCapability("RW")).toBeNull();
    expect(getBankPayoutCurrency("RW")).toBeNull();
  });

  it("returns documented bank payout currencies", () => {
    expect(getBankPayoutCurrency("GB")).toBe("GBP");
    expect(getBankPayoutCurrency("FR")).toBe("EUR");
    // Rwanda is collection-supported, but bank payouts remain disabled until verified.
    expect(getBankPayoutCurrency("RW")).toBeNull();
    expect(getBankPayoutCurrency("EG")).toBe("EGP");
    expect(getBankPayoutCurrency("CI")).toBe("XOF");
    expect(getBankPayoutCurrency("SN")).toBe("XOF");
    expect(getBankPayoutCurrency("SL")).toBeNull();
    expect(getBankPayoutCurrency("ZM")).toBeNull();
  });

  it("limits FX trading to the exact documented pairs and minimum threshold", () => {
    expect(supportsFlutterwaveFxPair("NGN", "USD")).toBe(true);
    expect(supportsFlutterwaveFxPair("GHS", "USD")).toBe(true);
    expect(supportsFlutterwaveFxPair("USD", "NGN")).toBe(true);
    expect(supportsFlutterwaveFxPair("USD", "GHS")).toBe(false);
    expect(supportsFlutterwaveFxPair("GBP", "USD")).toBe(false);
    expect(supportsFlutterwaveFxPair("EUR", "USD")).toBe(false);
    expect(FLUTTERWAVE_FX_MINIMUM_USD_EQUIVALENT).toBe(1_000);
  });

  it("fails closed for unknown countries", () => {
    expect(getCollectionCapability("XX")).toBeNull();
    expect(getCollectionPaymentOptions("XX")).toEqual([]);
    expect(getBankPayoutCurrency("XX")).toBeNull();
  });
});
