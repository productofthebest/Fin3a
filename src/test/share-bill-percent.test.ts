import { describe, expect, it } from "vitest";
import { percentSplit } from "@/lib/split-bill";

describe("Share Payment percentage split", () => {
  it("splits 100,000 as 50/30/20", () => {
    expect(percentSplit(10_000_000, [50, 30, 20])).toEqual([5_000_000, 3_000_000, 2_000_000]);
  });
  it("gives leftover cents so shares equal the total", () => {
    const s = percentSplit(100, [33.33, 33.33, 33.34]) as number[];
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("rejects percentages that do not add to 100", () => {
    expect(percentSplit(1000, [50, 40])).toBe("Percentages must add up to 100%");
  });
  it("rejects zero percentages", () => {
    expect(percentSplit(1000, [100, 0])).toBe("Every percentage must be above 0");
  });
});
