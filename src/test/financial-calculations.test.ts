import { describe, expect, it } from "vitest";
import { calculateTotals, completedRecords, historicalAverages, type FinancialRecord } from "@/lib/financial-calculations";

const today = "2026-10-31";
const row = (patch: Partial<FinancialRecord> = {}): FinancialRecord => ({ type: "expense", amount: 100, currency: "NGN", status: "completed", classification: "regular", occurred_at: "2026-10-01", ...patch });

describe("shared financial accuracy", () => {
  it.each(["transfer", "refund", "loan", "credit_card_payment"])("excludes %s from ordinary income and spending", (classification) => {
    const totals = calculateTotals([row({ classification, type: "income", amount: 500_000 }), row({ amount: 12_500 })], "NGN", today);
    expect(totals.income).toBe(0);
    expect(totals.spending).toBe(12_500);
  });
  it("separates completed cash flow, pending expenses and cleared funds", () => {
    expect(calculateTotals([row({ type: "income", amount: 1000 }), row({ amount: 200 }), row({ status: "pending", amount: 50 }), row({ status: "cleared", type: "income", amount: 300 }), row({ status: "unverified", amount: 90 })], "NGN", today))
      .toEqual({ income: 1000, spending: 200, recordedNet: 800, pendingExpenses: 50, clearedNet: 300, excluded: { unverified: 1 } });
  });
  it("never combines other or unknown currencies with the selected currency", () => {
    expect(calculateTotals([row({ amount: 200 }), row({ currency: "USD", amount: 500 }), row({ currency: null, amount: 900 })], "NGN", today))
      .toMatchObject({ spending: 200, excluded: { otherCurrency: 1, unknownCurrency: 1 } });
  });
  it("excludes future and invalid dates and includes leap day", () => {
    expect(completedRecords([row({ occurred_at: "2026-11-01" }), row({ occurred_at: "2026-02-30" }), row({ occurred_at: "2024-02-29" })], "NGN", today)).toHaveLength(1);
  });
  it("does not inflate totals with duplicate or ambiguous records", () => {
    expect(calculateTotals([row(), row({ flag: "duplicate" }), row({ flag: "ambiguous" })], "NGN", today).spending).toBe(100);
  });
  it("adds minor units without floating-point residue", () => {
    expect(calculateTotals([row({ amount: 0.1 }), row({ amount: 0.2 })], "NGN", today).spending).toBe(0.3);
  });
  it("uses three-decimal currency precision", () => {
    expect(calculateTotals([row({ currency: "KWD", amount: 1.234 }), row({ currency: "KWD", amount: 2.345 })], "KWD", today).spending).toBe(3.579);
  });
  it("averages zero-activity months but excludes first and current partial months", () => {
    const result = historicalAverages([{ month: "2026-07", income: 500, spending: 500 }, { month: "2026-08", income: 1000, spending: 200 }, { month: "2026-09", income: 0, spending: 0 }, { month: "2026-10", income: 9000, spending: 9000 }], "2026-07-15", today, "NGN");
    expect(result).toEqual({ completeMonths: ["2026-08", "2026-09"], income: 500, spending: 100 });
  });
  it("returns missing averages without sufficient completed months", () => {
    expect(historicalAverages([], null, today, "NGN").income).toBeNull();
  });
});