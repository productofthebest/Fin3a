import { describe, expect, it } from "vitest";
import { canTransfer } from "@/lib/account-transfer";

describe("single-user Fin3a transfer", () => {
  it("permits exactly one recipient and rejects multiple recipients", () => {
    expect(canTransfer(50, 100, 1)).toBe(true);
    expect(canTransfer(50, 100, 2)).toBe(false);
    expect(canTransfer(50, 100, 0)).toBe(false);
  });
  it("does not permit more than the available balance", () => {
    expect(canTransfer(100, 100, 1)).toBe(true);
    expect(canTransfer(100.01, 100, 1)).toBe(false);
    expect(canTransfer(0, 100, 1)).toBe(false);
  });
});