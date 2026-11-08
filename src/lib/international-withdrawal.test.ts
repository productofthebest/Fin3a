import { describe, expect, it } from "vitest";
import { INTERNATIONAL_LIVE_WITHDRAWALS_ENABLED, internationalOutcome, internationalWithdrawalInput, reservedMinor, verifiedMinorAmount } from "./international-withdrawal";

describe("international withdrawal safeguards", () => {
  it("keeps global live withdrawals OFF", () => expect(INTERNATIONAL_LIVE_WITHDRAWALS_ENABLED).toBe(false));
  it("uses integer minor units and rejects NGN", () => {
    const input = { destinationCountry: "GH", currency: "GHS", method: "bank", amountMinor: 1234, idempotencyKey: "10000000-0000-4000-8000-000000000001", beneficiary: { accountName: "Ama" } };
    expect(internationalWithdrawalInput.safeParse(input).success).toBe(true);
    expect(internationalWithdrawalInput.safeParse({ ...input, amountMinor: 12.34 }).success).toBe(false);
    expect(internationalWithdrawalInput.safeParse({ ...input, currency: "NGN" }).success).toBe(false);
    expect(internationalWithdrawalInput.safeParse({ ...input, destinationCountry: "NG" }).success).toBe(false);
  });
  it("honors zero and two decimal exponents without rounding", () => {
    expect(verifiedMinorAmount(12.34, "USD")).toBe(1234);
    expect(verifiedMinorAmount(1234, "UGX")).toBe(1234);
    expect(() => verifiedMinorAmount(12.345, "USD")).toThrow();
    expect(() => verifiedMinorAmount(1.1, "RWF")).toThrow();
    expect(() => verifiedMinorAmount(Number.MAX_SAFE_INTEGER, "USD")).toThrow();
  });
  it("treats unknown provider states as pending", () => {
    expect(internationalOutcome("SUCCESSFUL")).toBe("successful");
    expect(internationalOutcome("FAILED")).toBe("failed");
    expect(internationalOutcome("REVERSED")).toBe("reversed");
    expect(internationalOutcome("REFUNDED")).toBe("pending");
  });
  it("keeps immutable reservations charged on success and compensates only confirmed release/reversal", () => {
    expect(reservedMinor([{ kind: "reservation", amountMinor: 1234 }])).toBe(1234);
    expect(reservedMinor([{ kind: "reservation", amountMinor: 1234 }, { kind: "release", amountMinor: 1234 }])).toBe(0);
    expect(reservedMinor([{ kind: "reservation", amountMinor: 1234 }, { kind: "reversal", amountMinor: 1234 }])).toBe(0);
  });
});