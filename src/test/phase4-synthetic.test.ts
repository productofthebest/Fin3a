import { describe, expect, it } from "vitest";
import { buildAnalysis, forecastHistory, simulateForecast } from "@/lib/financial-analysis";
import { calculateTotals } from "@/lib/financial-calculations";
import { syntheticAccounts, syntheticHistory, SYNTHETIC_TODAY } from "./fixtures/phase4-synthetic";

describe("isolated in-memory synthetic financial reconciliation", () => {
  it("reconciles six months of recorded history without counting transfers, refunds or loans", () => {
    const totals = calculateTotals(syntheticHistory(), "NGN", SYNTHETIC_TODAY);
    expect(totals.income).toBe(3_000_000);
    expect(totals.spending).toBe(1_770_000);
    expect(totals.recordedNet).toBe(1_230_000);
    expect(totals.pendingExpenses).toBe(12_500);
    expect(totals.clearedNet).toBe(40_000);
    expect(totals.excluded).toEqual({ nonRegular: 4, unverified: 1, needsReview: 2, otherCurrency: 1, unknownCurrency: 1, future: 1 });
  });
  it("reconciles October category totals and chart totals against the ledger", () => {
    const result = buildAnalysis(syntheticHistory(), "NGN", SYNTHETIC_TODAY, { period: "month", comparison: "previous" });
    expect(result.current.income).toBe(450_000);
    expect(result.current.spending).toBe(320_000);
    expect(result.current.recordedNet).toBe(130_000);
    expect(result.previous.spending).toBe(290_000);
    expect(result.categories.reduce((s,c) => s+c.spending, 0)).toBe(320_000);
    expect(result.trend.reduce((s,p) => s+p.income, 0)).toBe(450_000);
    expect(result.trend.reduce((s,p) => s+p.spending, 0)).toBe(320_000);
    expect(result.categories.find(c => c.id === "food")?.change).toBe(33.3);
    expect(result.transactions).toHaveLength(5);
  });
  it("uses five complete months for estimates and preserves a separately confirmed balance", () => {
    const history = forecastHistory(syntheticHistory(), "NGN", SYNTHETIC_TODAY);
    expect(history).toEqual({ completeMonths: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"], income: 450_000, spending: 290_000 });
    const result = simulateForecast({ balance: syntheticAccounts[0].confirmedBalance, income: history.income ?? NaN, spending: history.spending ?? NaN, incomeChange: -450_000, spendingChange: 0, purchase: 500_000, months: 6 }, "NGN");
    expect(result.baselineNet).toBe(160_000);
    expect(result.baselineRunway).toBeNull();
    expect(result.scenarioNet).toBe(-290_000);
    expect(result.scenarioRunway).toBe(2.4);
    expect(result.points[0]?.scenario).toBe(700_000);
    expect(result.points[6]?.baseline).toBe(2_160_000);
    expect(result.points[6]?.scenario).toBe(-1_040_000);
  });
  it("reconciles more than 1000 records in the pure engine", () => {
    const source = syntheticHistory()[0];
    if (!source) throw new Error("Missing test fixture");
    const records = Array.from({ length: 1205 }, (_,i) => ({ ...source, id: `bulk-${i}`, type: "expense", amount: 100, occurred_at: "2026-10-15" }));
    expect(buildAnalysis(records, "NGN", SYNTHETIC_TODAY, { period: "month", comparison: "previous" }).current.spending).toBe(120_500);
  });
});