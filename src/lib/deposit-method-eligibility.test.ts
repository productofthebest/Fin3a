import { describe, expect, it } from "vitest";
import { getDepositMethodEligibility } from "./deposit-method-eligibility";

describe("deposit method eligibility disclosure", () => {
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
