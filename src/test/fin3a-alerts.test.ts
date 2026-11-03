import { describe, it, expect } from "vitest";
import { buildAlerts, type AlertInputs } from "@/lib/fin3a-alerts";

const base: AlertInputs = { today: "2026-11-03", bills: [], splitOwedByMe: [], splitOwedToMe: [], pendingDrafts: [], failedDocuments: [], expenses: [] };
const exp = (id: string, amount: number, date: string, extra = {}) => ({ id, amount, currency: "NGN", occurred_at: date + "T10:00:00Z", description: id, status: "completed", classification: "regular", flag: null, ...extra });

describe("Fin3a alerts", () => {
  it("flags overdue bills as high and bills due within 3 days as medium", () => {
    const a = buildAlerts({ ...base, bills: [
      { id: "1", name: "Rent", amount: 1, next_due_date: "2026-11-01", active: true },
      { id: "2", name: "DSTV", amount: 1, next_due_date: "2026-11-06", active: true },
      { id: "3", name: "Later", amount: 1, next_due_date: "2026-11-07", active: true },
    ] });
    expect(a.map(x => [x.kind, x.severity])).toEqual([["bill_overdue", "high"], ["bill_due_soon", "medium"]]);
  });
  it("marks split shares past deadline as high", () => {
    const a = buildAlerts({ ...base, splitOwedByMe: [{ id: "s", title: "Dinner", amount: 5000, currency: "NGN", deadline: "2026-11-02" }] });
    expect(a[0]!.severity).toBe("high");
  });
  it("reports pending scanned lines and skips empty documents", () => {
    const a = buildAlerts({ ...base, pendingDrafts: [{ document_id: "d", filename: "s.pdf", count: 4 }, { document_id: "e", filename: "x.pdf", count: 0 }] });
    expect(a).toHaveLength(1);
    expect(a[0]!.title).toContain("4 scanned lines");
  });
  it("needs 5 baseline expenses and 3× median for an unusual-expense alert", () => {
    const hist = [1, 2, 3, 4, 5].map(n => exp("h" + n, 1000, `2026-10-0${n}`));
    expect(buildAlerts({ ...base, expenses: [...hist.slice(0, 4), exp("big", 5000, "2026-11-02")] })).toHaveLength(0);
    expect(buildAlerts({ ...base, expenses: [...hist, exp("ok", 2999, "2026-11-02")] })).toHaveLength(0);
    expect(buildAlerts({ ...base, expenses: [...hist, exp("big", 3000, "2026-11-02")] })[0]!.kind).toBe("unusual_expense");
  });
  it("ignores flagged, pending and unknown-currency expenses", () => {
    const hist = [1, 2, 3, 4, 5].map(n => exp("h" + n, 1000, `2026-10-0${n}`));
    expect(buildAlerts({ ...base, expenses: [...hist, exp("a", 9000, "2026-11-02", { flag: "duplicate" }), exp("b", 9000, "2026-11-02", { status: "pending" }), exp("c", 9000, "2026-11-02", { currency: null })] })).toHaveLength(0);
  });
});
