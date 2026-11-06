import { describe, expect, it } from "vitest";
import {
  getBankPayoutCapability,
  getBankPayoutCurrency,
  getCollectionCapability,
  getCollectionPaymentOptions,
} from "./flutterwave-capabilities";

describe("Flutterwave country capabilities", () => {
  it("returns documented country-specific collection methods", () => {
    expect(getCollectionPaymentOptions("ke")).toEqual(["card", "mpesa"]);
    expect(getCollectionPaymentOptions("NG")).toContain("banktransfer");
    expect(getCollectionPaymentOptions("GH")).toContain("ghanamobilemoney");
    expect(getCollectionPaymentOptions("CM")).toContain("mobilemoneyxof");
    expect(getCollectionPaymentOptions("CI")).toContain("mobilemoneyxaf");
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
