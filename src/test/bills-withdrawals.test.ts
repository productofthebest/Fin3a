import { describe, expect, it } from "vitest";
import { parseNotice } from "@/lib/flutterwave-webhook";
import { transferOutcome } from "@/lib/flutterwave.server";

describe("bill payment and withdrawal reference rules", () => {
  it("keeps top-up, withdrawal and bill references in separate namespaces", () => {
    const topup = { event: "charge.completed", data: { id: 1, tx_ref: "F3T-10000000-0000-4000-8000-000000000001" } };
    const transfer = { event: "transfer.completed", data: { id: 2, reference: "F3W-10000000-0000-4000-8000-000000000002" } };
    expect(parseNotice(topup)?.kind).toBe("charge");
    expect(parseNotice(transfer)?.kind).toBe("transfer");
    // A charge notice can never be interpreted as a payout and vice versa.
    expect(() => parseNotice({ event: "charge.completed", data: { id: 3, tx_ref: "F3W-10000000-0000-4000-8000-000000000002" } })).toThrow("INVALID_BODY");
    expect(() => parseNotice({ event: "transfer.completed", data: { id: 4, reference: "F3T-10000000-0000-4000-8000-000000000001" } })).toThrow("INVALID_BODY");
  });
  it("maps only documented transfer statuses to final outcomes", () => {
    expect(transferOutcome("SUCCESSFUL")).toBe("successful");
    expect(transferOutcome("FAILED")).toBe("failed");
    expect(transferOutcome("NEW")).toBe("pending");
    expect(transferOutcome("PENDING")).toBe("pending");
    expect(transferOutcome("successful-ish")).toBe("pending");
  });
  it("bill payment references use the F3B namespace", () => {
    expect(/^F3B-[0-9a-f-]{36}$/.test(`F3B-${crypto.randomUUID()}`)).toBe(true);
    expect(/^F3W-[0-9a-f-]{36}$/.test(`F3B-${crypto.randomUUID()}`)).toBe(false);
  });
});
