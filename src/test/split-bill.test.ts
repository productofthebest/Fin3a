import { describe, expect, it } from "vitest";
import {
  billProgress,
  equalSplit,
  fromCents,
  shareDisplayStatus,
  toCents,
  validateCustomSplit,
} from "@/lib/split-bill";

describe("equalSplit", () => {
  it("splits ₦100,000 equally across 4 participants", () => {
    const shares = equalSplit(toCents(100_000), 4);
    expect(shares).toEqual([2_500_000, 2_500_000, 2_500_000, 2_500_000]);
    expect(fromCents(shares[0])).toBe(25_000);
  });

  it("distributes the remainder so shares always sum to the total", () => {
    const shares = equalSplit(toCents(100), 3);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(toCents(100));
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it("handles a single participant", () => {
    expect(equalSplit(toCents(42.5), 1)).toEqual([toCents(42.5)]);
  });

  it("rejects zero totals and zero participants", () => {
    expect(() => equalSplit(0, 3)).toThrow();
    expect(() => equalSplit(toCents(10), 0)).toThrow();
  });
});

describe("validateCustomSplit", () => {
  it("accepts shares that sum exactly to the total", () => {
    expect(validateCustomSplit(toCents(100), [toCents(60), toCents(40)])).toBeNull();
  });

  it("rejects shares that fall short of the total", () => {
    expect(validateCustomSplit(toCents(100), [toCents(60)])).toMatch(/short of the total/);
  });

  it("rejects shares that exceed the total", () => {
    expect(validateCustomSplit(toCents(100), [toCents(60), toCents(60)])).toMatch(/exceed the total/);
  });

  it("rejects empty and non-positive shares", () => {
    expect(validateCustomSplit(toCents(100), [])).toMatch(/at least one/);
    expect(validateCustomSplit(toCents(100), [0, toCents(100)])).toMatch(/positive/);
  });
});

describe("shareDisplayStatus", () => {
  it("marks paid shares paid regardless of deadline", () => {
    expect(shareDisplayStatus("paid", "2026-01-01", "2026-11-03")).toBe("paid");
  });

  it("marks pending shares overdue only after the deadline passes", () => {
    expect(shareDisplayStatus("pending", "2026-11-02", "2026-11-03")).toBe("overdue");
    expect(shareDisplayStatus("pending", "2026-11-03", "2026-11-03")).toBe("pending");
    expect(shareDisplayStatus("pending", null, "2026-11-03")).toBe("pending");
  });
});

describe("billProgress", () => {
  it("counts the creator share as collected without a payment", () => {
    const progress = billProgress([
      { amount: 25_000, status: "pending", is_creator: true },
      { amount: 25_000, status: "paid", is_creator: false },
      { amount: 25_000, status: "pending", is_creator: false },
    ]);
    expect(progress.collected).toBe(50_000);
    expect(progress.outstanding).toBe(25_000);
    expect(progress.paidCount).toBe(1);
    expect(progress.pendingCount).toBe(1);
  });
});
