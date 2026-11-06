import { beforeEach, describe, expect, it, vi } from "vitest";

const { payoutFetch } = vi.hoisted(() => ({ payoutFetch: vi.fn() }));
vi.mock("./payout-transport.server", () => ({ payoutFetch }));

import { verifyFlutterwaveTransaction } from "./flutterwave-transaction-verification.server";

const expected = {
  transactionId: "12345",
  txRef: "F3I-12345678-1234-1234-1234-123456789012",
  amount: 250,
  currency: "NGN",
};
const provider = {
  status: "success",
  data: { id: 12345, tx_ref: expected.txRef, amount: 250, currency: "NGN", status: "successful" },
};

describe("verifyFlutterwaveTransaction", () => {
  beforeEach(() => payoutFetch.mockReset());

  it("accepts only exact successful provider evidence", async () => {
    payoutFetch.mockResolvedValue(new Response(JSON.stringify(provider), { status: 200 }));
    await expect(verifyFlutterwaveTransaction(expected)).resolves.toEqual({
      providerTransactionId: "12345",
      txRef: expected.txRef,
      amount: 250,
      currency: "NGN",
      status: "successful",
    });
    expect(payoutFetch).toHaveBeenCalledWith("/transactions/12345/verify", { method: "GET" });
  });

  it.each([
    ["wrong reference", { ...provider, data: { ...provider.data, tx_ref: "F3I-other" } }],
    ["wrong amount", { ...provider, data: { ...provider.data, amount: 249 } }],
    ["wrong currency", { ...provider, data: { ...provider.data, currency: "USD" } }],
    ["pending status", { ...provider, data: { ...provider.data, status: "pending" } }],
    ["failed status", { ...provider, data: { ...provider.data, status: "failed" } }],
    ["wrong provider id", { ...provider, data: { ...provider.data, id: 999 } }],
  ])("rejects %s", async (_label, body) => {
    payoutFetch.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(verifyFlutterwaveTransaction(expected)).rejects.toThrow("PAYMENT_VERIFICATION_FAILED");
  });

  it("rejects malformed pending records without contacting the relay", async () => {
    await expect(verifyFlutterwaveTransaction({ ...expected, txRef: "attacker-ref" })).rejects.toThrow();
    expect(payoutFetch).not.toHaveBeenCalled();
  });

  it("rejects provider errors and invalid response bodies", async () => {
    payoutFetch.mockResolvedValue(new Response("{}", { status: 502 }));
    await expect(verifyFlutterwaveTransaction(expected)).rejects.toThrow("PAYMENT_VERIFICATION_FAILED");
  });
});
