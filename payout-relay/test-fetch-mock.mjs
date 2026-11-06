// Test-only provider stub loaded into the relay child process via NODE_OPTIONS.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
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
  return originalFetch(input, init);
};
