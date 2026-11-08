import { describe, expect, it, vi } from "vitest";
import { handleWebhook, parseNotice } from "./flutterwave-webhook";
const reference = "F3X-10000000-0000-4000-8000-000000000001";
const notice = { event: "transfer.completed", data: { id: 42, reference, status: "SUCCESSFUL", amount: 999999 } };
describe("international webhook isolation", () => {
  it("extracts reference and id only, never notice status or amount", () => {
    expect(parseNotice(notice)).toEqual({ kind: "transfer", id: "42", reference });
  });
  it("rejects unsigned notices without invoking reconciliation", async () => {
    const process = vi.fn();
    const response = await handleWebhook(new Request("https://example.test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(notice) }), "test-hash", process);
    expect(response.status).toBe(401); expect(process).not.toHaveBeenCalled();
  });
  it("returns retry if independent provider verification fails", async () => {
    const process = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const response = await handleWebhook(new Request("https://example.test", { method: "POST", headers: { "content-type": "application/json", "verif-hash": "test-hash" }, body: JSON.stringify(notice) }), "test-hash", process);
    expect(response.status).toBe(503);
  });
});