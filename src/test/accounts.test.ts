import { describe, expect, it } from "vitest";
import { computeAccountBalance, calcSwapDestination, DEFAULT_NGN_PER_USD, type LedgerEntry } from "@/lib/accounts";

const entry = (kind: LedgerEntry["kind"], status: LedgerEntry["status"], amount: number): LedgerEntry => ({ kind, status, amount });

describe("computeAccountBalance", () => {
  it("counts only completed entries in the available balance", () => {
    const balance = computeAccountBalance([
      entry("deposit", "completed", 1000),
      entry("withdrawal", "completed", 250),
      entry("deposit", "pending", 500),
    ]);
    expect(balance.available).toBe(750);
    expect(balance.pendingIn).toBe(500);
    expect(balance.total).toBe(1250);
  });

  it("never increases the available balance for a pending deposit request", () => {
    const balance = computeAccountBalance([entry("deposit", "pending", 5000)]);
    expect(balance.available).toBe(0);
    expect(balance.pendingIn).toBe(5000);
  });

  it("excludes failed and reversed transactions entirely", () => {
    const balance = computeAccountBalance([
      entry("deposit", "completed", 1000),
      entry("deposit", "failed", 400),
      entry("withdrawal", "reversed", 300),
    ]);
    expect(balance.available).toBe(1000);
    expect(balance.pending).toBe(0);
    expect(balance.total).toBe(1000);
  });

  it("tracks pending withdrawals separately and nets them in pending", () => {
    const balance = computeAccountBalance([
      entry("deposit", "completed", 2000),
      entry("transfer_out", "pending", 300),
      entry("transfer_in", "pending", 100),
    ]);
    expect(balance.available).toBe(2000);
    expect(balance.pendingOut).toBe(300);
    expect(balance.pending).toBe(-200);
    expect(balance.total).toBe(1800);
  });

  it("counts completed swaps as a credit in and a debit out", () => {
    const balance = computeAccountBalance([
      entry("deposit", "completed", 1000),
      entry("swap_out", "completed", 1000),
      entry("swap_in", "completed", 0.71),
    ]);
    expect(balance.available).toBe(0.71);
    expect(balance.total).toBe(0.71);
  });

  it("never moves the balance for a pending swap", () => {
    const balance = computeAccountBalance([entry("swap_out", "pending", 500), entry("swap_in", "pending", 0.36)]);
    expect(balance.available).toBe(0);
    expect(balance.pending).toBe(-500 + 0.36);
  });
});

describe("calcSwapDestination", () => {
  it("converts USD to NGN at the owner-set rate", () => {
    expect(calcSwapDestination(100, DEFAULT_NGN_PER_USD, "USD")).toBe(140000);
  });

  it("converts NGN to USD and rounds to two decimals", () => {
    expect(calcSwapDestination(2800, DEFAULT_NGN_PER_USD, "NGN")).toBe(2);
    expect(calcSwapDestination(1000, DEFAULT_NGN_PER_USD, "NGN")).toBe(0.71);
  });

  it("rejects invalid amounts and rates", () => {
    expect(calcSwapDestination(0, DEFAULT_NGN_PER_USD, "NGN")).toBeNull();
    expect(calcSwapDestination(-5, DEFAULT_NGN_PER_USD, "NGN")).toBeNull();
    expect(calcSwapDestination(10, 0, "NGN")).toBeNull();
    expect(calcSwapDestination(Number.NaN, DEFAULT_NGN_PER_USD, "NGN")).toBeNull();
  });
});

import { summarizeAccountActivity } from "@/lib/accounts";
describe("summarizeAccountActivity", () => {
  it("counts only this month and excludes pending from available", () => {
    const s = summarizeAccountActivity([
      { kind: "deposit", status: "completed", amount: 5000, currency: "NGN", created_at: "2026-11-02T10:00:00Z" },
      { kind: "deposit", status: "pending", amount: 2000, currency: "NGN", created_at: "2026-11-02T11:00:00Z" },
      { kind: "withdrawal", status: "completed", amount: 1000, currency: "NGN", created_at: "2026-10-30T10:00:00Z" },
    ], "2026-11-03");
    expect(s.NGN.balance.available).toBe(4000);
    expect(s.NGN.thisMonth.deposit).toEqual({ count: 2, completedTotal: 5000 });
    expect(s.NGN.pendingCount).toBe(1);
    expect(s.USD.totalEntries).toBe(0);
  });
});
