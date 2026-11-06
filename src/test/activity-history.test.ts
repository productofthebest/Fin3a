import { describe, expect, it } from "vitest";
import { activityPage, buildActivity, canDeleteRecord, type ActivitySources } from "@/lib/activity-history";

const empty = (): ActivitySources => ({ records: [], ledger: [], transfers: [], topups: [], withdrawals: [], payments: [], splits: [], shares: [], requests: [], swaps: [], quotes: [], refunds: [] });
describe("Activity retention and source union", () => {
  it("never adds an uploaded document as an Activity row; only its imported transactions belong there", () => {
    const s = empty();
    s.records = [{ id: "tx-1", type: "expense", source: "document", import_identity: "fingerprint-1", amount: 1250, currency: "NGN", occurred_at: "2026-11-06", status: "completed", description: "Groceries", merchant: "Market", reference: null, category_id: "cat-1", categories: { name: "Groceries", icon: "shopping-basket" } }] as unknown as ActivitySources["records"];
    const rows = buildActivity(s,"u");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ recordId: "tx-1", kind: "expense", title: "Groceries", category: { name: "Groceries" }, amount: 1250 });
    expect(rows.some(row => row.kind === "document" || row.title.endsWith(".pdf"))).toBe(false);
  });
  it("manual history cannot be deleted", () => expect(canDeleteRecord({ source: "manual", import_identity: null })).toBe(false));
  it("only proven document imports can be deleted", () => {
    expect(canDeleteRecord({ source: "document", import_identity: "draft:123" })).toBe(true);
    expect(canDeleteRecord({ source: "document", import_identity: null })).toBe(false);
    expect(canDeleteRecord({ source: "manual", import_identity: "forged" })).toBe(false);
  });
  it("includes deposits once and keeps failed transfers", () => {
    const s = empty();
    s.topups = [{ id: "t", ledger_id: "l", credited_amount: 150, requested_amount: 200, tx_ref: "F3T-test", status: "credited", created_at: "2026-11-06T00:00:00Z" }] as ActivitySources["topups"];
    s.ledger = [{ id: "l", amount: 150, kind: "deposit", status: "completed", currency: "NGN", created_at: "2026-11-06T00:00:00Z" }] as ActivitySources["ledger"];
    s.transfers = [{ id: "f", from_user_id: "u", amount: 20, currency: "USD", status: "failed", created_at: "2026-11-06T01:00:00Z", reference: null }] as ActivitySources["transfers"];
    const rows = buildActivity(s,"u");
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.kind === "deposit")?.amount).toBe(150);
    expect(rows[0]?.status).toBe("failed");
    expect(rows.every(r => !r.deletable)).toBe(true);
  });
  it("links split and QR payments without duplicate ledger payments", () => {
    const s = empty();
    s.transfers = ["split", "qr"].map(id => ({ id, from_user_id: "u", amount: 50, currency: "NGN", status: "completed", created_at: "2026-11-06T00:00:00Z" })) as ActivitySources["transfers"];
    s.shares = [{ bill_id: "b", transfer_id: "split", user_id: "u", amount: 50 }] as ActivitySources["shares"];
    s.requests = [{ id: "q", transfer_id: "qr", status: "paid", amount: 50, currency: "NGN", created_at: "2026-11-06T00:00:00Z" }] as ActivitySources["requests"];
    s.ledger = ["split", "qr"].map(id => ({ id: `l-${id}`, provider: "internal", provider_ref: `${id}:out`, kind: "transfer_out" })) as ActivitySources["ledger"];
    const rows = buildActivity(s,"u");
    expect(rows.filter(r => r.direction === "out")).toHaveLength(2);
    expect(rows.find(r => r.id === "transfer:split")?.kind).toBe("split_bill");
    expect(rows.find(r => r.id === "transfer:qr")?.kind).toBe("share_payment");
  });
  it("includes withdrawals, bills, crypto, swaps and refunds with no delete access", () => {
    const s = empty();
    const base = { id: "1", created_at: "2026-11-06T00:00:00Z", amount: 100, status: "pending", currency: "NGN" };
    s.withdrawals = [{ ...base, ledger_id: "w", bank_name: "Bank", payout: 50, fin3a_fee: 50 }] as unknown as ActivitySources["withdrawals"];
    s.payments = [{ ...base, ledger_id: "p", biller_name: "Airtime" }] as unknown as ActivitySources["payments"];
    s.swaps = [{ ...base, source_amount: 100, from_currency: "NGN", to_currency: "USD", destination_amount: 1 }] as unknown as ActivitySources["swaps"];
    s.quotes = [{ ...base, ledger_id: "c", asset: "USDC", original_amount: 10, network: "ETH", service: "crypto_deposit" }] as unknown as ActivitySources["quotes"];
    s.ledger = [{ ...base, id: "c", kind: "deposit" }] as ActivitySources["ledger"];
    s.refunds = [{ provider_refund_id: "r", verified_at: base.created_at, amount: 200, review_state: "pending" }] as ActivitySources["refunds"];
    const rows = buildActivity(s,"u");
    expect(rows.map(r => r.kind).sort()).toEqual(["bill_payment", "crypto", "refund", "swap", "withdrawal"]);
    expect(rows.every(r => !r.deletable)).toBe(true);
  });
  it("filters original currencies before pagination and retains all history", () => {
    const s = empty();
    s.records = Array.from({ length: 125 }, (_,i) => ({ id: `${i}`, type: "income", source: "manual", amount: i, currency: i < 70 ? "NGN" : "USD", occurred_at: "2026-11-06", status: "completed" })) as ActivitySources["records"];
    const page = activityPage(buildActivity(s,"u"), { page: 2, currency: "NGN" });
    expect(page.total).toBe(70); expect(page.rows).toHaveLength(20);
    expect(page.rows.every(r => r.currency === "NGN")).toBe(true);
    expect(page.currencies).toEqual(["NGN", "USD"]);
  });
});