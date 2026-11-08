import { describe, expect, it } from "vitest";
import { withdrawalOptions } from "./withdrawal-options";

describe("country-scoped withdrawal presentation", () => {
  it("keeps Withdraw visible and selects existing NGN only for Nigeria/NGN", () => {
    expect(withdrawalOptions("NG", "NGN", false)).toMatchObject({ visible: true, ngn: true, bankEnabled: false });
    expect(withdrawalOptions("NG", "NGN", true).bankEnabled).toBe(true);
    expect(withdrawalOptions("GH", "NGN", true).ngn).toBe(false);
  });
  it("changes local currency without enabling unverified corridors", () => {
    expect(withdrawalOptions("GH", "GHS", true)).toMatchObject({ currency: "GHS", ngn: false, bankEnabled: false });
    expect(withdrawalOptions("GB", "GBP", true)).toMatchObject({ currency: "GBP", bankEnabled: false });
  });
  it("restricts USD bank context to US/USD and still requires an implemented rail", () => {
    expect(withdrawalOptions("US", "USD", true)).toMatchObject({ usd: true, bankEnabled: false });
    expect(withdrawalOptions("NG", "USD", true).usd).toBe(false);
    expect(withdrawalOptions("US", "NGN", true).usd).toBe(false);
    expect(withdrawalOptions("EC", "USD", true).usd).toBe(false);
  });
  it("offers only USDT/USDC everywhere without inventing supported networks", () => {
    for (const country of ["NG", "US", "GH", "GB", "XX"]) {
      const options = withdrawalOptions(country, "USD", true);
      expect(options.tokens).toEqual(["USDT", "USDC"]);
      expect(options.tokens.includes("BTC" as "USDT")).toBe(false);
      expect(options.networks).toEqual([]);
      expect(options.cryptoEnabled).toBe(false);
    }
  });
});