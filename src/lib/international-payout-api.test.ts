import { describe, expect, it } from "vitest";
import { buildInternationalPayoutPreflight, internationalPayoutPreflightInput } from "./international-payout-api";

const validGhanaMobile = {
  walletCurrency: "GHS",
  destinationCountry: "GH",
  currency: "GHS",
  method: "mobile_money" as const,
  beneficiary: { accountName: "Ama Mensah", network: "MTN", mobileNumber: "0241234567" },
};

describe("authenticated international payout preflight rules", () => {
  it("accepts only the declared input contract and rejects browser-supplied wallet identity", () => {
    expect(internationalPayoutPreflightInput.safeParse(validGhanaMobile).success).toBe(true);
    expect(internationalPayoutPreflightInput.safeParse({ ...validGhanaMobile, walletCountry: "GH" }).success).toBe(false);
    expect(internationalPayoutPreflightInput.safeParse({ ...validGhanaMobile, unexpected: true }).success).toBe(false);
    expect(internationalPayoutPreflightInput.safeParse({ ...validGhanaMobile, method: "card" }).success).toBe(false);
  });

  it("rejects unknown beneficiary fields and non-string values", () => {
    expect(internationalPayoutPreflightInput.safeParse({
      ...validGhanaMobile,
      beneficiary: { ...validGhanaMobile.beneficiary, admin: "true" },
    }).success).toBe(false);
    expect(internationalPayoutPreflightInput.safeParse({
      ...validGhanaMobile,
      beneficiary: { ...validGhanaMobile.beneficiary, accountName: { value: "Ama" } },
    }).success).toBe(false);
  });

  it("rejects oversized beneficiary values", () => {
    expect(internationalPayoutPreflightInput.safeParse({
      ...validGhanaMobile,
      beneficiary: { ...validGhanaMobile.beneficiary, accountName: "A".repeat(201) },
    }).success).toBe(false);
  });

  it("validates a Ghana mobile-money beneficiary but never enables the route", () => {
    expect(buildInternationalPayoutPreflight(validGhanaMobile, "GH")).toEqual({
      ok: false,
      enabled: false,
      reason: "not_merchant_verified",
      beneficiaryValid: true,
      invalidFields: [],
    });
  });

  it("reports invalid beneficiary fields without exposing normalized account data", () => {
    expect(buildInternationalPayoutPreflight({
      ...validGhanaMobile,
      beneficiary: { accountName: "Ama", network: "MPESA", mobileNumber: "0241234567" },
    }, "GH")).toEqual({
      ok: false,
      enabled: false,
      reason: "invalid_beneficiary",
      beneficiaryValid: false,
      invalidFields: ["network"],
    });
  });

  it("rejects trusted wallet-country and wallet-currency mismatches", () => {
    expect(buildInternationalPayoutPreflight(validGhanaMobile, "KE").reason).toBe("wallet_country_mismatch");
    expect(buildInternationalPayoutPreflight({ ...validGhanaMobile, walletCurrency: "USD" }, "GH").reason)
      .toBe("wallet_currency_mismatch");
  });

  it("rejects unsupported country/currency/method combinations", () => {
    expect(buildInternationalPayoutPreflight({ ...validGhanaMobile, destinationCountry: "CA", currency: "CAD" }, "GH").reason)
      .toBe("unknown_route");
    expect(buildInternationalPayoutPreflight({
      ...validGhanaMobile,
      method: "bank",
      beneficiary: { accountName: "Ama Mensah", bankCode: "TEST", accountNumber: "12345678" },
    }, "GH").reason).toBe("not_merchant_verified");
  });

  it("keeps Nigeria on the existing NGN withdrawal path", () => {
    expect(buildInternationalPayoutPreflight({
      walletCurrency: "NGN",
      destinationCountry: "NG",
      currency: "NGN",
      method: "bank",
      beneficiary: {},
    }, "NG").reason).toBe("nigeria_uses_ngn_path");
  });
});
