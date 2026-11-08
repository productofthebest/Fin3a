import { describe, expect, it } from "vitest";
import { buildInternationalPayoutPreflight } from "./international-payout-api";

describe("country-scoped fiat bank withdrawals", () => {
  const beneficiary = {
    accountName: "Jane Doe",
    accountNumber: "123456789",
    routingNumber: "021000021",
    swiftCode: "IRVTUS3N",
    bankName: "Test Bank",
    accountType: "checking",
    address: "1 Main Street, San Francisco",
    postalCode: "94105",
    streetNumber: "1",
    streetName: "Main Street",
  };

  it("rejects USD bank withdrawals unless the authenticated wallet and destination are both US", () => {
    const input = {
      walletCurrency: "USD",
      destinationCountry: "US",
      currency: "USD",
      method: "bank" as const,
      beneficiary,
    };
    expect(buildInternationalPayoutPreflight(input, "US", []).reason).toBe("not_merchant_verified");
    expect(buildInternationalPayoutPreflight(input, "NG", []).reason).toBe("usd_bank_withdrawal_requires_us_wallet");
    expect(buildInternationalPayoutPreflight({ ...input, destinationCountry: "GB" }, "GB", []).reason)
      .toBe("usd_bank_withdrawal_requires_us_wallet");
  });

  it("rejects bank payout destinations outside the authenticated wallet country", () => {
    const input = {
      walletCurrency: "USD",
      destinationCountry: "US",
      currency: "USD",
      method: "bank" as const,
      beneficiary,
    };
    expect(buildInternationalPayoutPreflight(input, "NG", []).reason)
      .toBe("usd_bank_withdrawal_requires_us_wallet");
  });
});
