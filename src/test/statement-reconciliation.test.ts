import { describe, expect, it } from "vitest";
import { duplicateSearchRange, matchDuplicates, mergeSummaries, planPageChunks, reconcileStatement } from "@/lib/statement-reconciliation";

const rows = [
  { amount: 1000.1, type: "income" as const },
  { amount: 250.05, type: "expense" as const },
  { amount: 0.1, type: "expense" as const },
];

describe("statement reconciliation", () => {
  it("matches when opening + credits − debits equals printed closing balance", () => {
    const r = reconcileStatement({ opening_balance: 500, closing_balance: 1249.95, total_credits: 1000.1, total_debits: 250.15, currency: "NGN" }, rows);
    expect(r.status).toBe("matched");
    expect(r.balance.difference).toBe(0);
  });
  it("reports the exact shortfall when a line is missing", () => {
    const r = reconcileStatement({ opening_balance: 500, closing_balance: 1149.95, total_credits: null, total_debits: null, currency: "NGN" }, rows);
    expect(r.status).toBe("mismatch");
    expect(r.balance.difference).toBe(100);
  });
  it("never claims verification when nothing was printed", () => {
    expect(reconcileStatement(null, rows).status).toBe("unverifiable");
  });
  it("merges opening from the first chunk and closing from the last", () => {
    const m = mergeSummaries([
      { opening_balance: 10, closing_balance: 20, total_credits: null, total_debits: null, currency: "USD" },
      null,
      { opening_balance: 20, closing_balance: 35, total_credits: 50, total_debits: null, currency: null },
    ]);
    expect(m).toEqual({ opening_balance: 10, closing_balance: 35, total_credits: 50, total_debits: null, currency: "USD" });
  });
  it("splits 70 pages into 8-page chunks", () => {
    const c = planPageChunks(70, 8);
    expect(c).toHaveLength(9);
    expect(c.at(-1)).toEqual({ start: 64, end: 70 });
  });
});

describe("duplicate detection", () => {
  it("search range covers 3 days either side, including the full last day", () => {
    expect(duplicateSearchRange(["2026-03-10", "2026-03-01"])).toEqual({ from: "2026-02-26", toExclusive: "2026-03-14" });
  });
  it("flags a transaction 3 days later but not 4", () => {
    const base = { amount: 50, merchant: "Shoprite", reference: null, currency: "NGN", type: "expense" };
    const m = matchDuplicates(
      [{ id: "d1", txn_date: "2026-03-01", ...base }, { id: "d2", txn_date: "2026-03-20", ...base }],
      [{ id: "t1", occurred_at: "2026-03-04T18:00:00Z", ...base }, { id: "t2", occurred_at: "2026-03-24T09:00:00Z", ...base }],
    );
    expect(m.get("d1")).toBe("t1");
    expect(m.has("d2")).toBe(false);
  });
  it("one existing transaction is matched to only one draft", () => {
    const base = { amount: 50, merchant: "Uber", reference: null, currency: "USD", type: "expense", txn_date: "2026-01-02" };
    const m = matchDuplicates([{ id: "a", ...base }, { id: "b", ...base }], [{ id: "t", occurred_at: "2026-01-02", ...base }]);
    expect(m.size).toBe(1);
  });
});
