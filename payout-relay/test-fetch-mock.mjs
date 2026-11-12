// Test-only provider stub loaded into the relay child process via NODE_OPTIONS.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === "https://api.flutterwave.com/v3/transfers" && init?.method === "POST") {
    const payload = JSON.parse(String(init.body || "{}"));
    if (Object.prototype.hasOwnProperty.call(payload, "destination_country")) {
      return new Response(JSON.stringify({ status: "error", message: "Internal destination country must not reach provider" }), { status: 400 });
    }
    return new Response(JSON.stringify({
      status: "success",
      message: "Transfer Queued Successfully",
      data: { id: 98765, reference: payload.reference, currency: payload.currency, debit_currency: payload.debit_currency, amount: payload.amount, status: "NEW" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url === "https://api.flutterwave.com/v3/transactions/12345/verify") {
    if (init?.method !== "GET") throw new Error("Unexpected provider method");
    const authorization = new Headers(init?.headers).get("authorization");
    if (authorization !== `Bearer ${"f".repeat(40)}`) {
      return new Response(JSON.stringify({ status: "error", message: "Unauthorized" }), { status: 401 });
    }
    return new Response(JSON.stringify({
      status: "success",
      message: "Transaction fetched successfully",
      data: { id: 12345, status: "successful", tx_ref: "F3I-test", amount: 100, currency: "NGN" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  if (url === "https://api.flutterwave.com/v3/payments" && init?.method === "POST") {
    const payload = JSON.parse(String(init.body || "{}"));
    return new Response(JSON.stringify({
      status: "success",
      data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/test", received: payload },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return originalFetch(input, init);
};
