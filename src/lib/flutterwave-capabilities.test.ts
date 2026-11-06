import { describe, expect, it } from "vitest";
import {
  getBankPayoutCapability,
  getBankPayoutCurrency,
  getCollectionCapability,
  getCollectionPaymentOptions,
} from "./flutterwave-capabilities";

describe("Flutterwave country capabilities", () => {
  it("returns only the published payment methods for a collection country", () => {
    expect(getCollectionPaymentOptions("ke")).toEqual(["card", "mpesa"]);
    expect(getCollectionPaymentOptions("NG")).toContain("banktransfer");
    expect(getCollectionPaymentOptions("GH")).toContain("mobilemoneyghana");
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
  });

  it("fails closed for unknown countries", () => {
    expect(getCollectionCapability("XX")).toBeNull();
    expect(getCollectionPaymentOptions("XX")).toEqual([]);
    expect(getBankPayoutCurrency("XX")).toBeNull();
  });
});
