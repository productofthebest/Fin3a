import { describe, expect, it } from "vitest";
import { accountCurrencies, COUNTRY_CURRENCY, fiatWalletFlag, selectCountryAccounts } from "@/lib/country-currency";

describe("local currency plus USD for every supported country", () => {
  it("Nigeria gets NGN and USD", () => expect(accountCurrencies("NG")).toEqual(["NGN", "USD"]));
  it("South Africa gets ZAR and USD", () => expect(accountCurrencies("ZA")).toEqual(["ZAR", "USD"]));
  it("Ghana gets GHS and USD", () => expect(accountCurrencies("GH")).toEqual(["GHS", "USD"]));
  it("United Kingdom gets GBP and USD", () => expect(accountCurrencies("GB")).toEqual(["GBP", "USD"]));
  it("United States gets USD once", () => expect(accountCurrencies("US")).toEqual(["USD"]));

  it("provides exactly the local currency and USD (without duplicates) for every country in the country map", () => {
    for (const [country, local] of Object.entries(COUNTRY_CURRENCY)) {
      const expected = local === "USD" ? ["USD"] : [local, "USD"];
      expect(accountCurrencies(country)).toEqual(expected);
      expect(new Set(accountCurrencies(country)).size).toBe(expected.length);
    }
  });
});

describe("dynamic fiat wallet country flags", () => {
  it("shows the selected country flag for the local fiat wallet and the US flag for USD", () => {
    expect(fiatWalletFlag("NGN", "NG")).toBe("🇳🇬");
    expect(fiatWalletFlag("USD", "NG")).toBe("🇺🇸");
    expect(fiatWalletFlag("ZAR", "ZA")).toBe("🇿🇦");
    expect(fiatWalletFlag("GHS", "GH")).toBe("🇬🇭");
    expect(fiatWalletFlag("GBP", "GB")).toBe("🇬🇧");
    expect(fiatWalletFlag("USD", "US")).toBe("🇺🇸");
  });

  it("supports every country in the existing country-currency map", () => {
    for (const country of Object.keys(COUNTRY_CURRENCY)) {
      expect(fiatWalletFlag(COUNTRY_CURRENCY[country], country)).not.toBe("🌐");
      expect(fiatWalletFlag("USD", country)).toBe("🇺🇸");
    }
  });
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
