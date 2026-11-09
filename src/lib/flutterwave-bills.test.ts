import { afterEach, describe, expect, it, vi } from "vitest";
import { getBillStatus, payBill } from "./flutterwave.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Flutterwave V3 bill payments", () => {
  it("uses the biller/item payment endpoint and persists the provider tx_ref", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: { tx_ref: "CF-FLYAPI-202611091200001234", reference: "BP123", amount: 500, network: "MTN" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await payBill({
      billerCode: "BIL099", itemCode: "AT099", customer: "08012345678",
      amount: 500, reference: "F3B-12345678-1234-1234-1234-123456789012",
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/billers/BIL099/items/AT099/payment");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      country: "NG", customer_id: "08012345678", amount: 500,
      reference: "F3B-12345678-1234-1234-1234-123456789012",
    });
    expect(result.tx_ref).toBe("CF-FLYAPI-202611091200001234");
  });

  it("retrieves status by provider tx_ref and returns the customer's reference for matching", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: {
        currency: "NGN", customer_id: "08012345678", amount: "500.00",
        tx_ref: "CF-FLYAPI-202611091200001234",
        customer_reference: "F3B-12345678-1234-1234-1234-123456789012",
        status: "successful",
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBillStatus("CF-FLYAPI-202611091200001234");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/bills/CF-FLYAPI-202611091200001234?verbose=1");
    expect(result.customer_reference).toBe("F3B-12345678-1234-1234-1234-123456789012");
    expect(result.status).toBe("successful");
  });
});
