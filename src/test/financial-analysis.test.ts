import { describe, it, expect } from "vitest";
import { analysisRange, buildAnalysis, forecastHistory, simulateForecast, percentChange, analysisCsv, type AnalysisRecord } from "@/lib/financial-analysis";
const row = (patch: Partial<AnalysisRecord> = {}): AnalysisRecord => ({ id: "a", type: "expense", amount: 100, currency: "NGN", status: "completed", classification: "regular", occurred_at: "2026-10-01", flag: null, description: "Expense", source: "manual", category_id: null, categories: null, ...patch });
const filters = { period: "month", comparison: "previous" } as const;
describe("historical comparisons", () => {
  it("compares inclusive selected dates with an equally long previous period", () => {
    expect(analysisRange({ period: "custom", start: "2026-10-10", end: "2026-10-12", comparison: "previous" }, "2026-10-31")).toMatchObject({ days: 3, comparisonStart: "2026-10-07", comparisonEnd: "2026-10-09" });
  });
  it("starts a UTC week on Monday", () => expect(analysisRange({ period: "week", comparison: "previous" }, "2026-10-31").start).toBe("2026-10-26"));
  it("starts a quarter at its calendar boundary", () => expect(analysisRange({ period: "quarter", comparison: "previous" }, "2026-10-31").start).toBe("2026-10-01"));
  it("clamps leap-day year-on-year comparisons to February 28", () => expect(analysisRange({ period: "custom", start: "2024-02-29", end: "2024-02-29", comparison: "year" }, "2026-10-31").comparisonEnd).toBe("2023-02-28"));
  it("rejects future and reversed date ranges", () => { expect(() => analysisRange({ ...filters, end: "2026-11-01" }, "2026-10-31")).toThrow(); expect(() => analysisRange({ period: "custom", comparison: "previous", start: "2026-10-20", end: "2026-10-01" }, "2026-10-31")).toThrow(); });
  it("reconciles totals, category comparison and eligible drill-down", () => {
    const r = buildAnalysis([row({ amount: 12500 }), row({ occurred_at: "2026-09-15", amount: 10000 }), row({ type: "income", amount: 450000 }), row({ currency: "USD", amount: 999 }), row({ classification: "transfer", amount: 9000 }), row({ flag: "duplicate" }), row({ status: "pending" })], "NGN", "2026-10-31", filters);
    expect(r.current.spending).toBe(12500); expect(r.current.recordedNet).toBe(437500); expect(r.previous.spending).toBe(10000); expect(r.categories[0]?.change).toBe(25); expect(r.transactions).toHaveLength(2); expect(r.trend.reduce((s,p) => s+p.spending,0)).toBe(12500);
  });
  it("never invents growth from a zero comparison", () => expect(percentChange(100,0)).toBeNull());
  it("keeps same-named categories separate by identity", () => expect(buildAnalysis([row({ category_id: "1", categories: { name: "Food", icon: "x" } }), row({ category_id: "2", categories: { name: "Food", icon: "x" } })], "NGN", "2026-10-31", filters).categories).toHaveLength(2));
  it("neutralizes spreadsheet formulas in exported user descriptions", () => expect(analysisCsv(buildAnalysis([row({ description: '=HYPERLINK("evil")' })], "NGN", "2026-10-31", filters), "NGN")).toContain('"\'=HYPERLINK(""evil"")"'));
});
describe("forecast estimates", () => {
  it("excludes first/current months and includes zero-activity months", () => expect(forecastHistory([row({ occurred_at: "2026-07-15" }), row({ occurred_at: "2026-08-01", amount: 200 }), row({ amount: 9000 })], "NGN", "2026-10-31")).toMatchObject({ completeMonths: ["2026-08", "2026-09"], spending: 100, income: 0 }));
  it("requires history rather than inventing averages", () => expect(forecastHistory([], "NGN", "2026-10-31").spending).toBeNull());
  it("calculates baseline and income-loss/purchase scenarios without double counting", () => {
    const r = simulateForecast({ balance: 1000, income: 500, spending: 700, incomeChange: -100, spendingChange: -50, purchase: 200, months: 3 }, "NGN");
    expect(r.baselineRunway).toBe(5); expect(r.scenarioRunway).toBe(3.2); expect(r.points[3]).toEqual({ month: 3, baseline: 400, scenario: 50 });
  });
  it("does not claim infinite guaranteed runway for nonnegative cash flow", () => expect(simulateForecast({ balance: 1000, income: 0, spending: 0, incomeChange: 0, spendingChange: 0, purchase: 0, months: 1 }, "NGN").scenarioRunway).toBeNull());
  it("flags a purchase exceeding confirmed starting balance immediately", () => expect(simulateForecast({ balance: 100, income: 500, spending: 200, incomeChange: 0, spendingChange: 0, purchase: 200, months: 1 }, "NGN").scenarioRunway).toBe(0));
  it("rejects negative scenario spending and missing balance", () => { expect(() => simulateForecast({ balance: NaN, income: 0, spending: 0, incomeChange: 0, spendingChange: 0, purchase: 0, months: 1 }, "NGN")).toThrow(); expect(() => simulateForecast({ balance: 100, income: 0, spending: 100, incomeChange: 0, spendingChange: -200, purchase: 0, months: 1 }, "NGN")).toThrow(); });
});