import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.RELAY_SHARED_TOKEN || "";
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const ALLOWED_SOURCE_IPS = new Set((process.env.RELAY_ALLOWED_SOURCE_IPS || "").split(",").map(x => x.trim()).filter(Boolean));
const MAX_BODY_BYTES = 16 * 1024;
const FLW_ORIGIN = "https://api.flutterwave.com/v3";

function ready() { return TOKEN.length >= 32 && FLW_SECRET_KEY.length >= 20; }
function equalSecret(a, b) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function sourceIp(req) {
  return (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
}
function allowedSource(req) {
  return ALLOWED_SOURCE_IPS.size === 0 || ALLOWED_SOURCE_IPS.has(sourceIp(req));
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("BODY_TOO_LARGE"), { status: 413 });
    chunks.push(chunk);
  }
  if (!size) throw Object.assign(new Error("BODY_REQUIRED"), { status: 400 });
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}
function route(path, method) {
  if (method === "POST" && path === "/v1/flutterwave/transfers") return { method: "POST", providerPath: "/transfers" };
  if (method === "GET" && /^\/v1\/flutterwave\/transfers\/[1-9]\d{0,19}$/.test(path)) {
    return { method: "GET", providerPath: `/transfers/${path.split("/").at(-1)}` };
  }
  if (method === "GET" && path.startsWith("/v1/flutterwave/transfers?")) {
    const u = new URL(path, "http://relay.invalid");
    const entries = [...u.searchParams.entries()];
    if (entries.length !== 1 || entries[0][0] !== "reference" || !/^F3W-[0-9a-f-]{36}$/.test(entries[0][1])) return null;
    return { method: "GET", providerPath: `/transfers?reference=${encodeURIComponent(entries[0][1])}` };
  }
  return null;
}
function validTransfer(body) {
  return body && typeof body === "object" && !Array.isArray(body)
    && typeof body.account_bank === "string" && /^[A-Za-z0-9]{2,12}$/.test(body.account_bank)
    && typeof body.account_number === "string" && /^\d{10}$/.test(body.account_number)
    && typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0
    && Math.round(body.amount * 100) === body.amount * 100
    && body.currency === "NGN" && body.debit_currency === "NGN"
    && typeof body.reference === "string" && /^F3W-[0-9a-f-]{36}$/.test(body.reference)
    && typeof body.narration === "string" && body.narration.length <= 80;
}
async function callFlutterwave(spec, body) {
  const response = await fetch(FLW_ORIGIN + spec.providerPath, {
    method: spec.method,
    headers: { authorization: `Bearer ${FLW_SECRET_KEY}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(18_000),
  });
  const raw = await response.text();
  if (raw.length > 64 * 1024) throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
  let payload;
  try { payload = JSON.parse(raw); } catch { throw new Error("PROVIDER_INVALID_RESPONSE"); }
  return { status: response.status, payload };
}

const server = http.createServer(async (req, res) => {
  const path = req.url || "/";
  if (req.method === "GET" && path === "/health") {
    return json(res, ready() ? 200 : 503, { ready: ready() });
  }
  if (!ready()) return json(res, 503, { status: "error", message: "Payout relay is not configured" });
  if (!allowedSource(req)) return json(res, 403, { status: "error", message: "Forbidden" });
  const auth = req.headers.authorization || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!equalSecret(supplied, TOKEN)) return json(res, 401, { status: "error", message: "Unauthorized" });

  const spec = route(path, req.method || "");
  if (!spec) return json(res, 404, { status: "error", message: "Not found" });
  try {
    let body;
    if (spec.method === "POST") {
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) return json(res, 415, { status: "error", message: "JSON required" });
      body = await readJson(req);
      if (!validTransfer(body)) return json(res, 400, { status: "error", message: "Invalid NGN transfer request" });
    }
    const result = await callFlutterwave(spec, body);
    return json(res, result.status, result.payload);
  } catch (error) {
    const status = error?.status === 413 ? 413 : error?.status === 400 ? 400 : 502;
    // Never log credentials, request bodies, account numbers, or provider response bodies.
    console.error("payout relay request failed", { code: error?.message || "UNKNOWN", method: req.method });
    return json(res, status, { status: "error", message: status === 502 ? "Payout provider unavailable or response uncertain" : error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("payout relay listening", { port: PORT, configured: ready() });
});
