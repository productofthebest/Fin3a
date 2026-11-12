import { describe, expect, it } from "vitest";
import { withdrawalOptions } from "./withdrawal-options";

describe("country- and currency-scoped withdrawal presentation", () => {
  it("shows only bank withdrawal for Nigeria's NGN wallet and preserves its feature gate", () => {
    expect(withdrawalOptions("NG", "NGN", false)).toMatchObject({
      visible: true,
      ngn: true,
      bankEnabled: false,
      showBankMethod: true,
      showCryptoMethod: false,
      defaultMethod: "bank",
    });
    expect(withdrawalOptions("NG", "NGN", true).bankEnabled).toBe(true);
  });

  it("shows only bank withdrawal for non-US local-fiat wallets", () => {
    expect(withdrawalOptions("GH", "GHS", true)).toMatchObject({
      currency: "GHS",
      ngn: false,
      bankEnabled: false,
      localBankEnabled: false,
      showBankMethod: true,
      showCryptoMethod: false,
      defaultMethod: "bank",
    });
    expect(withdrawalOptions("GB", "GBP", true)).toMatchObject({
      showBankMethod: true,
      showCryptoMethod: false,
      defaultMethod: "bank",
    });
  });

  it("shows only crypto withdrawal for non-US USD wallets", () => {
    for (const [country, currency] of [
      ["NG", "USD"],
      ["GH", "USD"],
      ["GB", "USD"],
      ["EC", "USD"],
    ] as const) {
      expect(withdrawalOptions(country, currency, true)).toMatchObject({
        showBankMethod: false,
        showCryptoMethod: true,
        defaultMethod: "crypto",
      });
    }
  });

  it("shows both bank and crypto withdrawal for the US's single USD wallet", () => {
    expect(withdrawalOptions("US", "USD", true)).toMatchObject({
      usd: true,
      showBankMethod: true,
      showCryptoMethod: true,
      defaultMethod: "bank",
      bankEnabled: false,
      localBankEnabled: false,
    });
    expect(
      withdrawalOptions("US", "USD", true, [{ country: "US", currency: "USD", enabled: true }])
        .localBankEnabled,
    ).toBe(true);
  });

  it("does not expose methods for a currency that does not belong to the selected country", () => {
    expect(withdrawalOptions("US", "NGN", true)).toMatchObject({
      showBankMethod: false,
      showCryptoMethod: false,
    });
    expect(withdrawalOptions("NG", "GHS", true)).toMatchObject({
      showBankMethod: false,
      showCryptoMethod: false,
    });
  });

  it("requires an exact, explicitly enabled merchant route for non-NGN bank payout readiness", () => {
    const enabled = [{ country: "GH", currency: "GHS", enabled: true as const }];
    expect(withdrawalOptions("GH", "GHS", true, enabled).localBankEnabled).toBe(true);
    expect(withdrawalOptions("GH", "USD", true, enabled).localBankEnabled).toBe(false);
    expect(withdrawalOptions("KE", "KES", true, enabled).localBankEnabled).toBe(false);
    expect(
      withdrawalOptions("GH", "GHS", true, [{ country: "GH", currency: "USD", enabled: true }])
        .localBankEnabled,
    ).toBe(false);
  });

  it("offers only USDT/USDC and never invents supported payout networks", () => {
    for (const country of ["NG", "US", "GH", "GB", "XX"]) {
      const options = withdrawalOptions(country, "USD", true);
      expect(options.tokens).toEqual(["USDT", "USDC"]);
      expect(options.tokens.includes("BTC" as "USDT")).toBe(false);
      expect(options.networks).toEqual([]);
      expect(options.cryptoEnabled).toBe(false);
    }
  });
});
