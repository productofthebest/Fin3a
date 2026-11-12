import { describe, expect, it } from "vitest";
import { getDepositCollectionMethods, getDepositMethodEligibility } from "./deposit-method-eligibility";

describe("deposit method eligibility disclosure", () => {
  it("includes the working NGN bank-transfer route independently of hosted checkout coverage", () => {
    expect(getDepositCollectionMethods("NG", "NGN")).toEqual(["banktransfer", "card"]);
  });

  it("keeps NGN bank transfer visible while hiding the other unsupported Nigeria deposit methods", () => {
    const hiddenNgnDepositMethods = new Set(["account", "internetbanking", "nqr", "opay", "ussd"]);
    expect(getDepositCollectionMethods("NG", "NGN").filter(method => !hiddenNgnDepositMethods.has(method))).toEqual(["banktransfer", "card"]);
  });

  it("does not offer the NGN top-up route to Ghana wallets", () => {
    expect(getDepositCollectionMethods("GH", "GHS")).not.toContain("banktransfer");
  });

  it("does not offer the NGN top-up route for a USD deposit", () => {
    expect(getDepositCollectionMethods("NG", "USD")).not.toContain("banktransfer");
  });

  it("keeps Nigeria NGN bank transfer on the existing top-up path", () => {
    expect(getDepositMethodEligibility("bank-transfer", "NG", "NGN")).toMatchObject({ countrySupported: true, usable: true });
  });

  it("does not enable card collection from country support alone", () => {
    expect(getDepositMethodEligibility("debit-card", "NG", "NGN")).toMatchObject({ countrySupported: true, merchantConfirmed: false, usable: false });
  });

  it("requires merchant confirmation for Apple Pay even in a listed region", () => {
    expect(getDepositMethodEligibility("apple-pay", "US", "USD")).toMatchObject({ countrySupported: true, merchantConfirmed: false, usable: false });
    expect(getDepositMethodEligibility("apple-pay", "GH", "GHS").countrySupported).toBe(false);
  });

  it("fails closed for Google Pay until the actual checkout confirms it", () => {
    expect(getDepositMethodEligibility("google-pay", "US", "USD")).toMatchObject({ countrySupported: null, merchantConfirmed: false, usable: false });
  });

  it("does not enable bank transfer in an unsupported country/currency pair", () => {
    expect(getDepositMethodEligibility("bank-transfer", "GH", "GHS")).toMatchObject({ usable: false, merchantConfirmed: false });
  });
});
