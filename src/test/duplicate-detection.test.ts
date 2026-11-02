import { describe, expect, it } from "vitest";
import { findDuplicates } from "@/lib/statement-reconciliation";

const tx = (id: string, occurred_at: string, amount: number, merchant: string, reference: string | null = null) => ({ id, occurred_at, amount, merchant, reference, currency: "NGN", type: "expense" });
const dr = (id: string, txn_date: string, amount: number, merchant: string, reference: string | null = null) => ({ id, txn_date, amount, merchant, reference, currency: "NGN", type: "expense" });

describe("duplicate detection by date, amount and name", () => {
  it("same date, amount and name is an exact duplicate", () => {
    const m = findDuplicates([dr("d1", "2026-03-01", 5000, "POS Shoprite Ikeja")], [tx("t1", "2026-03-01", 5000, "shoprite ikeja")]);
    expect(m.get("d1")).toMatchObject({ txId: "t1", confidence: "exact" });
  });
  it("same amount on a different date with a different name is not a duplicate", () => {
    expect(findDuplicates([dr("d1", "2026-03-05", 5000, "Uber")], [tx("t1", "2026-03-01", 5000, "Shoprite")]).size).toBe(0);
  });
  it("same date and amount but unrelated name is not a duplicate", () => {
    expect(findDuplicates([dr("d1", "2026-03-01", 5000, "Uber")], [tx("t1", "2026-03-01", 5000, "Shoprite")]).size).toBe(0);
  });
  it("two legitimate same-day 5,000 purchases are both kept when only one exists", () => {
    const m = findDuplicates([dr("d1", "2026-03-01", 5000, "Shoprite"), dr("d2", "2026-03-01", 5000, "Shoprite")], [tx("t1", "2026-03-01", 5000, "Shoprite")]);
    expect(m.size).toBe(1);
  });
  it("a similar name a day apart is flagged for review, not exact", () => {
    const m = findDuplicates([dr("d1", "2026-03-02", 1200, "Shoprite Lekki")], [tx("t1", "2026-03-01", 1200, "Shoprite")]);
    expect(m.get("d1")?.confidence).toBe("likely");
  });
  it("matching reference on the same day is exact even if names differ", () => {
    const m = findDuplicates([dr("d1", "2026-03-01", 900, "NIP/abc", "REF123")], [tx("t1", "2026-03-01", 900, "Transfer", "ref 123")]);
    expect(m.get("d1")?.confidence).toBe("exact");
  });
});
