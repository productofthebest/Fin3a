// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { applyVerifiedInternationalTransfer } from "./international-withdrawal.server";
const reference = "F3X-10000000-0000-4000-8000-000000000001";
describe("international reconciliation", () => {
  it("passes verified integer amounts to isolated finish only", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: { status: "successful" }, error: null }) };
    expect(await applyVerifiedInternationalTransfer({ id: "42", reference, status: "SUCCESSFUL", currency: "GHS", amount: 99.5 }, reference, db)).toEqual({ status: "successful" });
    expect(db.rpc).toHaveBeenCalledWith("finish_international_withdrawal", { _reference: reference, _provider_transfer_id: "42", _outcome: "successful", _amount_minor: 9950, _currency: "GHS" });
  });
  it("rejects reference and precision mismatches before persistence", async () => {
    const db = { rpc: vi.fn() };
    await expect(applyVerifiedInternationalTransfer({ id: "42", reference, status: "FAILED", currency: "GHS", amount: 99.501 }, reference, db)).rejects.toThrow();
    await expect(applyVerifiedInternationalTransfer({ id: "42", reference, status: "FAILED", currency: "GHS", amount: 99.5 }, reference.replace("000001", "000002"), db)).rejects.toThrow();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("retains pending status for unknown provider outcomes", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: { status: "pending" }, error: null }) };
    await applyVerifiedInternationalTransfer({ id: "42", reference, status: "TIMEOUT", currency: "GHS", amount: 99.5 }, reference, db);
    expect(db.rpc.mock.calls[0]?.[1]._outcome).toBe("pending");
  });
  it("propagates persistence errors so callbacks retry", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("offline") }) };
    await expect(applyVerifiedInternationalTransfer({ id: "42", reference, status: "REVERSED", currency: "GHS", amount: 99.5 }, reference, db)).rejects.toThrow("INTERNATIONAL_RECONCILIATION_FAILED");
  });
});