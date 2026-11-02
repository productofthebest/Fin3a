import { describe, expect, it } from "vitest";
import { budgetUse, estimateCostUsd, scanRequestKey } from "@/lib/ai-usage-rules";

describe("AI cost estimates", () => {
  const price = { input_per_mtok: 0.25, cached_input_per_mtok: 0.025, output_per_mtok: 2 };
  it("prices cached input separately from new input", () => {
    // 900k new input + 100k cached + 50k output
    expect(estimateCostUsd(price, 1_000_000, 100_000, 50_000)).toBeCloseTo(0.225 + 0.0025 + 0.1, 10);
  });
  it("returns null instead of inventing a price", () => {
    expect(estimateCostUsd(null, 1000, 0, 1000)).toBeNull();
    expect(estimateCostUsd(price, null, 0, 1000)).toBeNull();
  });
  it("budget use is null when no budget is set", () => {
    expect(budgetUse(5, null)).toBeNull();
    expect(budgetUse(8, 10)).toBe(0.8);
  });
  it("repeat scans of one document within a minute share a key", () => {
    expect(scanRequestKey("d", 60_000)).toBe(scanRequestKey("d", 119_999));
    expect(scanRequestKey("d", 60_000)).not.toBe(scanRequestKey("d", 120_000));
  });
});
