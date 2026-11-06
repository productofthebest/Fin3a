import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 19000 + Math.floor(Math.random() * 1000);
const env = { ...process.env, PORT: String(port), RELAY_SHARED_TOKEN: "x".repeat(40), FLW_SECRET_KEY: "f".repeat(40), RELAY_ALLOWED_SOURCE_IPS: "", PAYMENT_REDIRECT_URL: "", NODE_OPTIONS: "--import ./test-fetch-mock.mjs" };
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
  assert.deepEqual(await r.json(), { ready: true, payments_ready: false });
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
    body: JSON.stringify({ destination_type: "mobile_money", account_bank: "MPS", account_number: "254712345678", beneficiary_name: "Test Beneficiary", amount: 100, currency: "GHS", debit_currency: "GHS", reference: "F3W-12345678-1234-1234-1234-123456789012" }),
  });
  assert.equal(r.status, 400);
});
test("rejects hosted payment collection when redirect is not configured", async () => {
  const r = await fetch(base + "/v1/flutterwave/payments", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ tx_ref: "fin3a-test-123", amount: 100, currency: "KES", country: "KE", customer: { email: "test@example.com", name: "Test User" } }),
  });
  assert.equal(r.status, 503);
});
test("rejects unsupported country and currency payment combination", async () => {
  const r = await fetch(base + "/v1/flutterwave/payments", {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ tx_ref: "fin3a-test-123", amount: 100, currency: "CAD", country: "CA", customer: { email: "test@example.com", name: "Test User" } }),
  });
  assert.equal(r.status, 400);
});
