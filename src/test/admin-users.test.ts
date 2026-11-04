import { describe, expect, it } from "vitest";
import { blocksSignIn, growthPercent, isActiveUser, validAdjustmentAmount } from "@/lib/admin-users";

describe("admin user rules", () => {
  it("active means activity within 100 days", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(isActiveUser("2026-07-28T00:00:00Z", now)).toBe(true); // 99 days
    expect(isActiveUser("2026-07-26T00:00:00Z", now)).toBe(false); // 101 days
    expect(isActiveUser(null, now)).toBe(false);
  });
  it("growth percent needs a previous baseline", () => {
    expect(growthPercent(15, 10)).toBe(50);
    expect(growthPercent(5, 0)).toBeNull();
  });
  it("suspended and deactivated block sign-in; restricted does not", () => {
    expect(blocksSignIn("suspended")).toBe(true);
    expect(blocksSignIn("deactivated")).toBe(true);
    expect(blocksSignIn("restricted")).toBe(false);
  });
  it("adjustments are positive with at most 2 decimals", () => {
    expect(validAdjustmentAmount("100.50")).toBe(100.5);
    expect(validAdjustmentAmount("0")).toBeNull();
    expect(validAdjustmentAmount("1.234")).toBeNull();
    expect(validAdjustmentAmount("-5")).toBeNull();
  });
});
