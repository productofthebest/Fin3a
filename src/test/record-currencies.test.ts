import { describe, expect, it } from "vitest";
import { recordCurrencies, recordMoney, totalsByCurrency } from "@/lib/record-currencies";
import type { FinancialRecord } from "@/lib/financial-calculations";

describe("NGN and USD records", () => {
  it("always offers both account currencies without removing a user's preference", () => {
    expect(recordCurrencies("EUR", [{ currency: "USD" }, { currency: "NGN" }, { currency: null }])).toEqual(["EUR", "NGN", "USD"]);
  });
  it("keeps NGN and USD totals separate and excludes unconfirmed currency", () => {
    const row = (currency: string | null, amount: number): FinancialRecord => ({ currency, amount, type: "expense", classification: "regular", status: "completed", occurred_at: "2026-11-01" });
    const totals = totalsByCurrency([row("NGN", 12500), row("USD", 50), row(null, 900)], "NGN", "2026-11-03");
    expect(totals.find(t => t.currency === "NGN")?.spending).toBe(12500);
    expect(totals.find(t => t.currency === "USD")?.spending).toBe(50);
    expect(totals.find(t => t.currency === "USD")?.excluded["unknownCurrency"]).toBe(1);
  });
  it("does not relabel a dollar record as Naira or assign unknown amounts a currency", () => {
    expect(recordMoney(50, "USD")).toBe("$50 USD");
    expect(recordMoney(12500, "NGN")).toBe("₦12,500 NGN");
    expect(recordMoney(50, null)).toBe("50 · Currency unconfirmed");
  });
});