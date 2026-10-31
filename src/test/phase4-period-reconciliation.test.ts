import { describe, expect, it } from "vitest";
import { buildAnalysis, simulateForecast, type AnalysisRecord } from "@/lib/financial-analysis";
import { syntheticHistory, SYNTHETIC_TODAY } from "./fixtures/phase4-synthetic";

describe("Phase 4 period and runway reconciliation", () => {
  it("answers yearly transportation spending using recorded category totals", () => {
    const result = buildAnalysis(syntheticHistory(), "NGN", SYNTHETIC_TODAY, { period: "year", comparison: "year" });
    expect(result.categories.find(category => category.id === "transport")?.spending).toBe(180_000);
    expect(result.current.income).toBe(3_000_000);
    expect(result.current.spending).toBe(1_770_000);
    expect(result.trend.reduce((sum, point) => sum + point.spending, 0)).toBe(1_770_000);
  });
  it("reconciles a complete quarter against the three recorded months", () => {
    const result = buildAnalysis(syntheticHistory(), "NGN", SYNTHETIC_TODAY, { period: "quarter", end: "2026-09-30", comparison: "year" });
    expect(result.range.start).toBe("2026-07-01");
    expect(result.current.income).toBe(1_350_000);
    expect(result.current.spending).toBe(870_000);
    expect(result.current.recordedNet).toBe(480_000);
  });
  it("compares identical dates last year without inventing missing records", () => {
    const result = buildAnalysis(syntheticHistory(), "NGN", SYNTHETIC_TODAY, { period: "month", comparison: "year" });
    expect(result.range.comparisonStart).toBe("2025-10-01");
    expect(result.range.comparisonEnd).toBe("2025-10-31");
    expect(result.comparisonCount).toBe(0);
    expect(result.changes.spending).toBeNull();
  });
  it("keeps three-decimal currency projections precise", () => {
    const result = simulateForecast({ balance: 10.123, income: 1.234, spending: 2.345, incomeChange: 0, spendingChange: 0, purchase: 0.111, months: 3 }, "KWD");
    expect(result.baselineNet).toBe(-1.111);
    expect(result.points[3]).toEqual({ month: 3, baseline: 6.79, scenario: 6.679 });
  });
  it("handles zero starting funds and negative estimated cash flow without inventing runway", () => {
    const result = simulateForecast({ balance: 0, income: 0, spending: 290_000, incomeChange: 0, spendingChange: 0, purchase: 0, months: 1 }, "NGN");
    expect(result.baselineRunway).toBe(0);
    expect(result.points[1]?.baseline).toBe(-290_000);
  });
  it("preserves actual source currencies in yearly analysis", () => {
    const source: AnalysisRecord | undefined = syntheticHistory()[0];
    if (!source) throw new Error("Missing fixture");
    const result = buildAnalysis([{ ...source, currency: "USD", amount: 500 }, { ...source, currency: "NGN", amount: 1000 }, { ...source, currency: null, amount: 9000 }], "USD", SYNTHETIC_TODAY, { period: "year", comparison: "previous" });
    expect(result.current.income).toBe(500);
    expect(result.current.excluded).toEqual({ otherCurrency: 1, unknownCurrency: 1 });
  });
});