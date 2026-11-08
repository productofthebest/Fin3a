import { describe, expect, it } from "vitest";
import { withdrawalOptions } from "./withdrawal-options";

describe("country-scoped withdrawal presentation", () => {
  it("keeps Withdraw visible and selects existing NGN only for Nigeria/NGN", () => {
    expect(withdrawalOptions("NG", "NGN", false)).toMatchObject({ visible: true, ngn: true, bankEnabled: false });
    expect(withdrawalOptions("NG", "NGN", true).bankEnabled).toBe(true);
    expect(withdrawalOptions("GH", "NGN", true).ngn).toBe(false);
  });

  it("changes local currency without enabling unverified corridors", () => {
    expect(withdrawalOptions("GH", "GHS", true)).toMatchObject({ currency: "GHS", ngn: false, bankEnabled: false, localBankEnabled: false });
    expect(withdrawalOptions("GB", "GBP", true)).toMatchObject({ currency: "GBP", bankEnabled: false, localBankEnabled: false });
  });

  it("restricts USD bank context to US/USD and requires an explicit merchant route", () => {
    expect(withdrawalOptions("US", "USD", true)).toMatchObject({ usd: true, bankEnabled: false, localBankEnabled: false });
    expect(withdrawalOptions("US", "USD", true, [{ country: "US", currency: "USD", enabled: true }]).localBankEnabled).toBe(true);
    expect(withdrawalOptions("NG", "USD", true).usd).toBe(false);
    expect(withdrawalOptions("US", "NGN", true).usd).toBe(false);
    expect(withdrawalOptions("EC", "USD", true).usd).toBe(false);
  });

  it("enables other local fiat only for an exact, explicitly enabled merchant corridor", () => {
    const enabled = [{ country: "GH", currency: "GHS", enabled: true as const }];
    expect(withdrawalOptions("GH", "GHS", true, enabled).localBankEnabled).toBe(true);
    expect(withdrawalOptions("GH", "USD", true, enabled).localBankEnabled).toBe(false);
    expect(withdrawalOptions("KE", "KES", true, enabled).localBankEnabled).toBe(false);
    expect(withdrawalOptions("GH", "GHS", true, [{ country: "GH", currency: "USD", enabled: true }]).localBankEnabled).toBe(false);
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
