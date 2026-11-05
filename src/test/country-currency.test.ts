import { describe, expect, it } from "vitest";
import { accountCurrencies } from "@/lib/country-currency";

describe("local currency plus USD", () => {
  it("Nigeria gets NGN and USD", () => expect(accountCurrencies("NG")).toEqual(["NGN", "USD"]));
  it("Ghana gets GHS and USD", () => expect(accountCurrencies("GH")).toEqual(["GHS", "USD"]));
  it("United States gets USD once", () => expect(accountCurrencies("US")).toEqual(["USD"]));
});
