import { describe, expect, it } from "vitest";
import { pageCount, pageRange, sanitizeHistorySearch } from "@/lib/transaction-history";

describe("transaction history pagination", () => {
  it("page 41 of 50 reaches rows 2000–2049 (no 200-row ceiling)", () => {
    expect(pageRange(41, 50)).toEqual({ from: 2000, to: 2049 });
  });
  it("5,001 transactions make 101 pages of 50", () => {
    expect(pageCount(5001, 50)).toBe(101);
  });
  it("caps page size at 100 and floors page at 1", () => {
    expect(pageRange(0, 1000)).toEqual({ from: 0, to: 99 });
  });
  it("strips filter-injection characters from search", () => {
    expect(sanitizeHistorySearch("uber,amount.gt.0)%")).toBe("uber amount gt 0");
  });
});
