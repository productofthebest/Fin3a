import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 19000 + Math.floor(Math.random() * 1000);
const env = { ...process.env, PORT: String(port), RELAY_SHARED_TOKEN: "x".repeat(40), FLW_SECRET_KEY: "f".repeat(40), RELAY_ALLOWED_SOURCE_IPS: "", PAYMENT_REDIRECT_URL: "https://fin3a.example/deposit/return", NODE_OPTIONS: "--import ./test-fetch-mock.mjs" };
const child = spawn(process.execPath, ["server.mjs"], { cwd: fileURLToPath(new URL(".", import.meta.url)), env, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(base + "/health"); if (r.status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("relay did not start");
}
before(waitReady);
after(() => child.kill());

const auth = { authorization: `Bearer ${env.RELAY_SHARED_TOKEN}` };
test("health exposes readiness without leaking configuration", async () => {
  const r = await fetch(base + "/health");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ready: true, payments_ready: true });
});
test("rejects unauthenticated payout calls", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers/123");
  assert.equal(r.status, 401);
});
test("rejects unsupported routes and methods", async () => {
  const r = await fetch(base + "/v1/flutterwave/transactions/123", { headers: auth });
  assert.equal(r.status, 404);
});

test("rejects malformed transaction verification identifiers", async () => {
  const r = await fetch(base + "/v1/flutterwave/transactions/0/verify", { headers: auth });
  assert.equal(r.status, 404);
});

test("verifies a Flutterwave transaction through the fixed provider origin", async () => {
  const r = await fetch(base + "/v1/flutterwave/transactions/12345/verify", { headers: auth });
  assert.equal(r.status, 200);
  const payload = await r.json();
  assert.equal(payload.data.status, "successful");
  assert.equal(payload.data.tx_ref, "F3I-test");
});
test("rejects invalid Nigerian bank payout before contacting provider", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ account_bank: "044", account_number: "123", beneficiary_name: "Test Beneficiary", amount: 500, currency: "NGN", debit_currency: "NGN", reference: "F3W-12345678-1234-1234-1234-123456789012" }),
  });
  assert.equal(r.status, 400);
});
test("rejects unsupported international payout currency", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ account_bank: "BANK", account_number: "12345678", beneficiary_name: "Test Beneficiary", amount: 100, currency: "CAD", debit_currency: "NGN", reference: "F3W-12345678-1234-1234-1234-123456789012" }),
  });
  assert.equal(r.status, 400);
});
test("rejects mobile-money payout when operator does not match currency", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ destination_type: "mobile_money", destination_country: "GH", account_bank: "MPS", account_number: "254712345678", beneficiary_name: "Test Beneficiary", amount: 100, currency: "GHS", debit_currency: "GHS", reference: "F3W-12345678-1234-1234-1234-123456789012" }),
  });
  assert.equal(r.status, 400);
});
test("rejects international payout when destination country and currency do not match", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ destination_type: "bank", destination_country: "KE", account_bank: "BANK", account_number: "12345678", beneficiary_name: "Test Beneficiary", amount: 100, currency: "GHS", debit_currency: "GHS", reference: "F3W-12345678-1234-1234-1234-123456789012" }),
  });
  assert.equal(r.status, 400);
});

test("rejects international payout without an explicit destination country", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ destination_type: "bank", account_bank: "BANK", account_number: "12345678", beneficiary_name: "Test Beneficiary", amount: 100, currency: "GHS", debit_currency: "GHS", reference: "F3W-12345678-1234-1234-1234-123456789012" }),
  });
  assert.equal(r.status, 400);
});

test("rejects USD payout metadata without a documented account type", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      destination_country: "US", account_number: "123456789", beneficiary_name: "Jane Doe",
      amount: 500, currency: "USD", debit_currency: "NGN",
      reference: "F3W-12345678-1234-1234-1234-123456789012",
      meta: [{ routing_number: "111000025", swift_code: "IRVTUS3N", bank_name: "Test Bank", beneficiary_address: "1 Main Street", postal_code: "10001", street_number: "1", street_name: "Main Street" }],
    }),
  });
  assert.equal(r.status, 400);
});

test("forwards valid USD, GBP and EUR transfers only after country and metadata validation", async () => {
  const cases = [
    {
      country: "US", currency: "USD", accountNumber: "123456789",
      meta: [{ routing_number: "111000025", swift_code: "IRVTUS3N", bank_name: "Test Bank", account_type: "checking", beneficiary_address: "1 Main Street", postal_code: "10001", street_number: "1", street_name: "Main Street" }],
    },
    {
      country: "GB", currency: "GBP", accountNumber: "12345678",
      meta: [{ routing_number: "308463", bank_name: "Test Bank", account_type: "personal", first_name: "Jane", last_name: "Doe" }],
    },
    {
      country: "FR", currency: "EUR", accountNumber: "FR761234567890",
      meta: [{ routing_number: "ABCDEF123", swift_code: "ABCDEFGH", bank_name: "Test Bank", postal_code: "75001", street_number: "1", street_name: "Rue Example", city: "Paris" }],
    },
  ];
  for (const item of cases) {
    const r = await fetch(base + "/v1/flutterwave/transfers", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        destination_type: "bank", destination_country: item.country, account_number: item.accountNumber,
        beneficiary_name: "Jane Doe", amount: 500, currency: item.currency, debit_currency: "NGN",
        reference: "F3W-12345678-1234-1234-1234-123456789012", meta: item.meta,
      }),
    });
    assert.equal(r.status, 200, item.currency + " should pass the provider-specific validation");
    const payload = await r.json();
    assert.equal(payload.data.currency, item.currency);
  }
});

test("rejects hosted payment collection without an explicit checkout method", async () => {
  const r = await fetch(base + "/v1/flutterwave/payments", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ tx_ref: "fin3a-test-123", amount: 100, currency: "KES", country: "KE", checkout_method: "card", customer: { email: "test@example.com", name: "Test User" } }),
  });
  assert.equal(r.status, 400);
});
test("accepts supported country/currency pairs for card checkout", async () => {
  for (const [country, currency] of [["GH", "GHS"], ["CM", "XAF"], ["CI", "XOF"], ["ZM", "ZMW"], ["FR", "EUR"]]) {
    const r = await fetch(base + "/v1/flutterwave/payments", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ tx_ref: "fin3a-test-123", amount: 100, currency, country, checkout_method: "card", customer: { email: "test@example.com", name: "Test User" } }),
    });
    assert.equal(r.status, 200, country + " should create hosted checkout");
  }
});

test("Apple Pay and Google Pay use merchant dashboard methods, not invented payment_options values", async () => {
  for (const checkout_method of ["apple_pay", "google_pay"]) {
    const r = await fetch(base + "/v1/flutterwave/payments", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ tx_ref: "F3I-12345678-1234-1234-1234-123456789012", amount: 100, currency: "USD", country: "US", checkout_method, customer: { email: "test@example.com", name: "Test User" } }),
    });
    assert.equal(r.status, 200);
    const payload = await r.json();
    assert.equal(payload.data.received.tx_ref, "F3I-12345678-1234-1234-1234-123456789012");
    assert.equal(Object.hasOwn(payload.data.received, "payment_options"), false);
  }
});
test("card checkout keeps its explicit country/currency payment options", async () => {
  const r = await fetch(base + "/v1/flutterwave/payments", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ tx_ref: "F3I-12345678-1234-1234-1234-123456789012", amount: 100, currency: "NGN", country: "NG", checkout_method: "card", customer: { email: "test@example.com", name: "Test User" } }),
  });
  assert.equal(r.status, 200);
  const payload = await r.json();
  assert.equal(payload.data.received.payment_options, "card");
});
test("rejects unsupported country and currency payment combination", async () => {
  const r = await fetch(base + "/v1/flutterwave/payments", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ tx_ref: "fin3a-test-123", amount: 100, currency: "CAD", country: "CA", customer: { email: "test@example.com", name: "Test User" } }),
  });
  assert.equal(r.status, 400);
});

test("accepts documented Ghana mobile-money payout operators for GHS", async () => {
  for (const operator of ["MTN", "AIRTELTIGO", "TELECEL", "VODAFONE"]) {
    const r = await fetch(base + "/v1/flutterwave/transfers", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        destination_type: "mobile_money", destination_country: "GH",
        account_bank: operator, account_number: "233241234567",
        beneficiary_name: "Test Beneficiary", amount: 100,
        currency: "GHS", debit_currency: "GHS",
        reference: "F3W-12345678-1234-1234-1234-123456789012",
      }),
    });
    assert.equal(r.status, 200, operator + " should pass GHS payout route validation");
    const payload = await r.json();
    assert.equal(payload.data.currency, "GHS");
  }
});

test("rejects Ghana mobile-money payout when the destination country is not GH", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      destination_type: "mobile_money", destination_country: "KE",
      account_bank: "MTN", account_number: "233241234567",
      beneficiary_name: "Test Beneficiary", amount: 100,
      currency: "GHS", debit_currency: "GHS",
      reference: "F3W-12345678-1234-1234-1234-123456789012",
    }),
  });
  assert.equal(r.status, 400);
});
