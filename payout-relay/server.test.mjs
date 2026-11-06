import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const port = 19000 + Math.floor(Math.random() * 1000);
const env = { ...process.env, PORT: String(port), RELAY_SHARED_TOKEN: "x".repeat(40), FLW_SECRET_KEY: "f".repeat(40), RELAY_ALLOWED_SOURCE_IPS: "" };
const child = spawn(process.execPath, ["server.mjs"], { cwd: new URL(".", import.meta.url), env, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(base + "/health"); if (r.status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("relay did not start");
}
test("relay exposes readiness without leaking configuration", async t => {
  t.after(() => child.kill());
  await waitReady();
  const r = await fetch(base + "/health");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ready: true });
});
test("rejects unauthenticated payout calls", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers/123");
  assert.equal(r.status, 401);
});
test("rejects unsupported routes and methods", async () => {
  const r = await fetch(base + "/v1/flutterwave/transactions/123", { headers: { authorization: `Bearer ${env.RELAY_SHARED_TOKEN}` } });
  assert.equal(r.status, 404);
});
test("validates payout payload before contacting provider", async () => {
  const r = await fetch(base + "/v1/flutterwave/transfers", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RELAY_SHARED_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ account_bank: "044", account_number: "123", amount: 500, currency: "USD", debit_currency: "USD", reference: "bad" }),
  });
  assert.equal(r.status, 400);
});
