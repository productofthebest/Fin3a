import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findBillStatusByCustomerReference,
  getBillStatusByTxRef,
  payBill,
} from "./flutterwave.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const billHistoryRow = (overrides: Record<string, unknown> = {}) => ({
  currency: "NGN",
  customer_id: "08012345678",
  amount: "500.00",
  tx_ref: "CF-FLYAPI-202611091200001234",
  customer_reference: "F3B-12345678-1234-1234-1234-123456789012",
  status: "Successful",
  country: "NG",
  ...overrides,
});

describe("Flutterwave V3 bill payments", () => {
  it("uses the biller/item payment endpoint and returns the provider tx_ref", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            tx_ref: "CF-FLYAPI-202611091200001234",
            reference: "BP123",
            amount: 500,
            network: "MTN",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await payBill({
      billerCode: "BIL099",
      itemCode: "AT099",
      customer: "08012345678",
      amount: 500,
      reference: "F3B-12345678-1234-1234-1234-123456789012",
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/billers/BIL099/items/AT099/payment");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      country: "NG",
      customer_id: "08012345678",
      amount: 500,
      reference: "F3B-12345678-1234-1234-1234-123456789012",
    });
    expect(result.tx_ref).toBe("CF-FLYAPI-202611091200001234");
  });

  it("checks the direct bill status endpoint when a provider tx_ref is saved", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          data: billHistoryRow({ status: "Failed" }),
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBillStatusByTxRef("CF-FLYAPI-202611091200001234");

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/bills/CF-FLYAPI-202611091200001234?verbose=1",
    );
    expect(result.status).toBe("Failed");
  });

  it("recovers failed and reversed outcomes instead of relying on history's successful default", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = new URL(String(input));
      const status = url.searchParams.get("status");
      const rows = status === "Failed" ? [billHistoryRow({ status: "Failed" })] : [];
      return new Response(JSON.stringify({ status: "success", data: rows }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await findBillStatusByCustomerReference(
      "F3B-12345678-1234-1234-1234-123456789012",
      "2026-11-08",
      "2026-11-09",
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("status")),
    ).toEqual(["Successful", "Failed", "Reversed"]);
    expect(result?.status).toBe("Failed");
  });

  it("does not recover when bill history returns a different merchant reference", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          status: "success",
          data: [
            billHistoryRow({
              customer_reference: "F3B-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            }),
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await findBillStatusByCustomerReference(
      "F3B-12345678-1234-1234-1234-123456789012",
      "2026-11-08",
      "2026-11-09",
    );

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
