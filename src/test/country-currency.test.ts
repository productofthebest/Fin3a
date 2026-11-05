import { describe, expect, it } from "vitest";
import { accountCurrencies, selectCountryAccounts } from "@/lib/country-currency";

describe("local currency plus USD", () => {
  it("Nigeria gets NGN and USD", () => expect(accountCurrencies("NG")).toEqual(["NGN", "USD"]));
  it("Ghana gets GHS and USD", () => expect(accountCurrencies("GH")).toEqual(["GHS", "USD"]));
  it("United States gets USD once", () => expect(accountCurrencies("US")).toEqual(["USD"]));
});

describe("country wallet visibility without balance changes", () => {
  const accounts = Object.freeze([
    Object.freeze({ currency: "USD", balance: 20, recent: Object.freeze(["usd-deposit"]) }),
    Object.freeze({ currency: "NGN", balance: 150, recent: Object.freeze(["ngn-deposit"]) }),
    Object.freeze({ currency: "GHS", balance: 30, recent: Object.freeze(["ghs-deposit"]) }),
  ]);

  it("US hides funded NGN and GHS wallets and shows USD only", () => {
    expect(selectCountryAccounts(accounts, "US").map(a => a.currency)).toEqual(["USD"]);
  });
  it("Ghana shows only GHS and USD even with NGN history", () => {
    expect(selectCountryAccounts(accounts, "GH").map(a => a.currency)).toEqual(["GHS", "USD"]);
  });
  it("switching back to Nigeria restores the same NGN balance and recent activity", () => {
    selectCountryAccounts(accounts, "US");
    selectCountryAccounts(accounts, "GH");
    const restored = selectCountryAccounts(accounts, "NG");
    expect(restored.map(a => a.currency)).toEqual(["NGN", "USD"]);
    expect(restored[0]).toBe(accounts[1]);
    expect(restored[0]?.balance).toBe(150);
    expect(restored[0]?.recent).toEqual(["ngn-deposit"]);
    expect(accounts.map(a => a.balance)).toEqual([20, 150, 30]);
  });
});
