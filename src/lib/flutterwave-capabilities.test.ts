import { describe, expect, it } from "vitest";
import {
  getBankPayoutCapability,
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
    expect(getCollectionPaymentOptions("NG")).toContain("banktransfer");
    expect(getCollectionPaymentOptions("GH")).toContain("ghanamobilemoney");
    expect(getCollectionPaymentOptions("CM")).toContain("mobilemoneyxaf");
    expect(getCollectionPaymentOptions("CI")).toContain("mobilemoneyxof");
  });

  it("offers card collection in every country in the published collection matrix", () => {
    for (const country of ["NG", "US", "GB", "EU", "GH", "CM", "CI", "ZA", "MW", "KE", "UG", "RW", "TZ", "EG", "ZM"]) {
      expect(supportsCollectionCards(country), country).toBe(true);
    }
    expect(supportsCollectionCards("XX")).toBe(false);
  });

  it("limits Apple Pay to the countries listed in Flutterwave's regional channel table", () => {
    for (const country of ["NG", "US", "GB", "EU", "ZA"]) expect(supportsApplePay(country), country).toBe(true);
    for (const country of ["GH", "KE", "CM", "CI", "EG", "XX"]) expect(supportsApplePay(country), country).toBe(false);
  });

  it("does not pretend Google Pay is a V3 country payment option", () => {
    expect(googlePayAvailability()).toBe("merchant-checkout-only");
  });

  it("does not treat collection support as bank payout support", () => {
    expect(getCollectionCapability("EG")).not.toBeNull();
    expect(getBankPayoutCapability("EG")).toBeNull();
    expect(getBankPayoutCurrency("EG")).toBeNull();
  });

  it("returns documented bank payout currencies", () => {
    expect(getBankPayoutCurrency("GB")).toBe("GBP");
    expect(getBankPayoutCurrency("CI")).toBe("XOF");
    expect(getBankPayoutCurrency("SN")).toBe("XOF");
    expect(getBankPayoutCurrency("SL")).toBeNull();
    expect(getBankPayoutCurrency("ZM")).toBeNull();
  });

  it("fails closed for unknown countries", () => {
    expect(getCollectionCapability("XX")).toBeNull();
    expect(getCollectionPaymentOptions("XX")).toEqual([]);
    expect(getBankPayoutCurrency("XX")).toBeNull();
  });
});
