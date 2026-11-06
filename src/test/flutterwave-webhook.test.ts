import { afterEach, describe, expect, it, vi } from "vitest";
import { handleWebhook, refundState, MAX_WEBHOOK_BYTES, parseNotice, validV3Hash } from "@/lib/flutterwave-webhook";
import { retrieveRefund, verifyPaymentByReference } from "@/lib/flutterwave.server";
const ref = "F3T-10000000-0000-4000-8000-000000000001";
const notice = { event: "charge.completed", data: { id: 123, tx_ref: ref, amount: 999, status: "successful" } };
const request = (body: string, signature = "test-only-shared-hash") => new Request("https://example.invalid/webhook", { method: "POST", headers: { "content-type": "application/json", "verif-hash": signature }, body });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("V3 webhook admission", () => {
  it("rejects invalid signatures before reading any body or processing", async () => {
    const r = request("invalid", "wrong"); const read = vi.spyOn(r, "body", "get"); const process = vi.fn();
    expect((await handleWebhook(r, "test-only-shared-hash", process)).status).toBe(401); expect(read).not.toHaveBeenCalled(); expect(process).not.toHaveBeenCalled();
  });
  it("does not enable HMAC or other signature headers", () => { expect(validV3Hash(null, "test-only-shared-hash")).toBe(false); expect(validV3Hash("hmac-value", "test-only-shared-hash")).toBe(false); });
  it.each(["{", "[]", JSON.stringify({ event: "charge.completed", data: { id: "bad", tx_ref: ref } })])("rejects malformed supported notification %s", async body => { expect((await handleWebhook(request(body), "test-only-shared-hash", vi.fn())).status).toBe(400); });
  it("bounds actual body bytes without trusting content-length", async () => { expect((await handleWebhook(request('"' + 'x'.repeat(MAX_WEBHOOK_BYTES) + '"'), "test-only-shared-hash", vi.fn())).status).toBe(413); });
  it("returns retry 503 on provider/database failures", async () => { expect((await handleWebhook(request(JSON.stringify(notice)), "test-only-shared-hash", vi.fn().mockRejectedValue(new Error("private provider error")))).status).toBe(503); });
  it("ignores unknown event types without processing", async () => { const process = vi.fn(); expect((await handleWebhook(request('{"event":"unknown.event"}'), "test-only-shared-hash", process)).status).toBe(200); expect(process).not.toHaveBeenCalled(); });
  it("recognizes transfer notices by reference only, ignoring client-supplied status and amount", () => {
    expect(parseNotice({ event: "transfer.completed", data: { id: 456, reference: "F3W-10000000-0000-4000-8000-000000000002", status: "SUCCESSFUL", amount: 1 } })).toEqual({ kind: "transfer", id: "456", reference: "F3W-10000000-0000-4000-8000-000000000002" });
  });
  it("rejects transfer notices with non-withdrawal references", async () => {
    const process = vi.fn();
    expect((await handleWebhook(request(JSON.stringify({ event: "transfer.completed", data: { id: 456, reference: "F3T-10000000-0000-4000-8000-000000000001" } })), "test-only-shared-hash", process)).status).toBe(400);
    expect(process).not.toHaveBeenCalled();
  });
  it("strips client payment amount/status and uses only correlation identifiers", () => { expect(parseNotice(notice)).toEqual({ kind: "charge", id: "123", txRef: ref }); });
  it("recognizes official unwrapped refund callback", () => { expect(parseNotice({ id: 90, TransactionId: 123, AmountRefunded: 100, status: "completed" })).toEqual({ kind: "refund", id: "90", transactionId: "123" }); });
});
describe("provider retrieval and refund settlement", () => {
  it("treats completed as initiation, not refund settlement", () => { expect(refundState("completed")).toBe("pending"); });
  it.each(["completed-bank-transfer", "completed-momo", "completed-mpgs", "completed-offline", "completed-preauth"])("recognizes documented final refund %s", status => { expect(refundState(status)).toBe("settled"); });
  it("does not assume undocumented refund statuses settled", () => { expect(refundState("successful")).toBe("unknown"); expect(refundState("failed")).toBe("failed"); });
  it("propagates verification network failures", async () => { vi.stubEnv("FLW_SECRET_KEY", "test-only-api-key"); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network"))); await expect(verifyPaymentByReference(ref)).rejects.toThrow(); });
  it("retrieves refund, never initiates one, and accepts official unwrapped response", async () => { vi.stubEnv("FLW_SECRET_KEY", "test-only-api-key"); const fetch = vi.fn().mockResolvedValue(Response.json({ id: 90, transaction_id: 123, amount_refunded: 100, status: "completed-mpgs" })); vi.stubGlobal("fetch", fetch); expect((await retrieveRefund("90")).transaction_id).toBe("123"); expect(fetch.mock.calls[0]?.[0]).toBe("https://api.flutterwave.com/v3/refunds/90"); expect(fetch.mock.calls[0]?.[1]?.method).toBeUndefined(); });
  it("does not swallow refund provider failures or leak raw content", async () => { vi.stubEnv("FLW_SECRET_KEY", "test-only-api-key"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "sensitive" }, { status: 500 }))); await expect(retrieveRefund("90")).rejects.toThrow("PROVIDER_ERROR"); });
});