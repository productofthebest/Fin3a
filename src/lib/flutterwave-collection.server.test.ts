import { beforeEach, describe, expect, it, vi } from "vitest";

const collectionFetch = vi.fn();
vi.mock("./payout-transport.server", () => ({ collectionFetch }));

import { createHostedCollection } from "./flutterwave-collection.server";

const valid = {
  txRef: "F3I-12345678-1234-1234-1234-123456789012",
  amount: 250,
  country: "NG",
  currency: "NGN",
  customer: { email: "customer@example.com", name: "Fin3a Customer" },
};

describe("createHostedCollection", () => {
  beforeEach(() => collectionFetch.mockReset());

  it("returns only a Flutterwave-hosted HTTPS checkout URL", async () => {
    collectionFetch.mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/example" },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(createHostedCollection(valid)).resolves.toEqual({
      checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/example",
    });
    expect(collectionFetch).toHaveBeenCalledOnce();
    const init = collectionFetch.mock.calls[0]?.[0] as RequestInit;
    expect(JSON.parse(String(init.body))).not.toHaveProperty("card_number");
  });

  it("rejects malformed references before calling the relay", async () => {
    await expect(createHostedCollection({ ...valid, txRef: "user-controlled-ref" })).rejects.toThrow();
    expect(collectionFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-Flutterwave checkout destination", async () => {
    collectionFetch.mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: { link: "https://attacker.example/checkout" },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(createHostedCollection(valid)).rejects.toThrow("INVALID_CHECKOUT_URL");
  });

  it("does not expose provider errors or accept an unsuccessful response", async () => {
    collectionFetch.mockResolvedValue(new Response(JSON.stringify({
      status: "error",
      message: "sensitive provider diagnostic",
    }), { status: 502, headers: { "content-type": "application/json" } }));

    await expect(createHostedCollection(valid)).rejects.toThrow("HOSTED_CHECKOUT_UNAVAILABLE");
  });
});
