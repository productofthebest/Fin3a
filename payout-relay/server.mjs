import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.RELAY_SHARED_TOKEN || "";
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const PAYMENT_REDIRECT_URL = process.env.PAYMENT_REDIRECT_URL || "";
const ALLOWED_SOURCE_IPS = new Set((process.env.RELAY_ALLOWED_SOURCE_IPS || "").split(",").map(x => x.trim()).filter(Boolean));
const MAX_BODY_BYTES = 16 * 1024;
const FLW_ORIGIN = "https://api.flutterwave.com/v3";

const PAYOUT_CURRENCIES = new Set(["NGN", "GHS", "KES", "MWK", "TZS", "UGX", "USD", "EUR", "GBP", "XAF", "XOF", "ZAR", "RWF", "EGP"]);
const DEBIT_CURRENCIES = new Set(["NGN", "GHS", "KES", "MWK", "TZS", "UGX", "USD", "EUR", "GBP", "XAF", "XOF", "ZAR", "RWF", "EGP"]);
const MOBILE_NETWORKS = {
  KES: new Set(["SAFARICOM", "T-KASH", "AIRTEL", "MPS"]),
  GHS: new Set(["AIRTELTIGO", "MTN", "TELECEL", "VODAFONE"]),
  XOF: new Set(["FMM", "MOOV", "ORANGEMONEY", "WAVE", "FREEMONEY"]),
  RWF: new Set(["MPS", "MTN"]),
  UGX: new Set(["AIRTEL", "MPS", "MTN"]),
  EGP: new Set(["EGPWALLETS"]),
};

const PAYMENT_OPTIONS = {
  NG: { NGN: ["card", "banktransfer"] },
  GH: { GHS: ["card", "mobilemoneyghana"] },
  KE: { KES: ["card", "mpesa"] },
  GB: { GBP: ["card", "account"] },
  US: { USD: ["card", "account"] },
  ZA: { ZAR: ["card", "account"] },
  MW: { MWK: ["card", "mobilemoneymalawi"] },
  UG: { UGX: ["card", "mobilemoneyuganda"] },
  RW: { RWF: ["card", "mobilemoneyrwanda"] },
  TZ: { TZS: ["card", "mobilemoneytanzania"] },
  CI: { XOF: ["card", "mobilemoneyxaf"] },
  SN: { XOF: ["card", "mobilemoneyxaf"] },
  CM: { XAF: ["card", "mobilemoneyxof"] },
  FR: { EUR: ["card", "account"] },
  DE: { EUR: ["card", "account"] },
  IE: { EUR: ["card", "account"] },
  NL: { EUR: ["card", "account"] },
  BE: { EUR: ["card", "account"] },
  AT: { EUR: ["card", "account"] },
  ES: { EUR: ["card", "account"] },
  IT: { EUR: ["card", "account"] },
  PT: { EUR: ["card", "account"] },
  FI: { EUR: ["card", "account"] },
  GR: { EUR: ["card", "account"] },
  LU: { EUR: ["card", "account"] },
  LT: { EUR: ["card", "account"] },
  LV: { EUR: ["card", "account"] },
  EE: { EUR: ["card", "account"] },
  SK: { EUR: ["card", "account"] },
  SI: { EUR: ["card", "account"] },
  CY: { EUR: ["card", "account"] },
  MT: { EUR: ["card", "account"] },
};

function ready() { return TOKEN.length >= 32 && FLW_SECRET_KEY.length >= 20; }
function paymentReady() {
  if (!ready() || !PAYMENT_REDIRECT_URL) return false;
  try { return new URL(PAYMENT_REDIRECT_URL).protocol === "https:"; } catch { return false; }
}
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
  const u = new URL(path, "http://relay.invalid");
  if (method === "POST" && u.pathname === "/v1/flutterwave/transfers" && !u.search) return { method: "POST", providerPath: "/transfers", kind: "payout" };
  if (method === "GET" && /^\/v1\/flutterwave\/transfers\/[1-9]\d{0,19}$/.test(u.pathname) && !u.search) {
    return { method: "GET", providerPath: `/transfers/${u.pathname.split("/").at(-1)}`, kind: "status" };
  }
  if (method === "GET" && u.pathname === "/v1/flutterwave/transfers" && [...u.searchParams.keys()].length === 1) {
    const reference = u.searchParams.get("reference") || "";
    if (/^F3W-[0-9a-f-]{36}$/.test(reference)) return { method: "GET", providerPath: `/transfers?reference=${encodeURIComponent(reference)}`, kind: "status" };
  }
  if (method === "POST" && u.pathname === "/v1/flutterwave/payments" && !u.search) return { method: "POST", providerPath: "/payments", kind: "collection" };
  return null;
}
function validAmount(amount) {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0 && Math.round(amount * 100) === amount * 100;
}
function safeText(value, max = 120) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
const INTERNATIONAL_META_KEYS = new Set([
  "routing_number", "swift_code", "bank_name", "account_type", "email", "mobile_number",
  "beneficiary_address", "sender_address", "sender_mobile_number", "postal_code",
  "street_number", "street_name", "city", "first_name", "last_name", "beneficiary_merchant_name",
]);
function validInternationalMeta(currency, meta) {
  if (!Array.isArray(meta) || !meta[0] || typeof meta[0] !== "object" || Array.isArray(meta[0])) return false;
  const m = meta[0];
  if (Object.keys(m).some(k => !INTERNATIONAL_META_KEYS.has(k))) return false;
  if (!safeText(m.routing_number, 40) || !safeText(m.bank_name, 120)) return false;
  if ((currency === "USD" || currency === "EUR") && !safeText(m.swift_code, 20)) return false;
  if (currency === "USD" && (!safeText(m.beneficiary_address, 180) || !safeText(m.postal_code, 20) || !safeText(m.street_number, 30) || !safeText(m.street_name, 100))) return false;
  if (currency === "EUR" && (!safeText(m.postal_code, 20) || !safeText(m.street_number, 30) || !safeText(m.street_name, 100) || !safeText(m.city, 100))) return false;
  if (currency === "GBP") {
    if (!["personal", "corporate"].includes(m.account_type)) return false;
    if (m.account_type === "personal" && (!safeText(m.first_name, 80) || !safeText(m.last_name, 80))) return false;
    if (m.account_type === "corporate" && !safeText(m.beneficiary_merchant_name, 120)) return false;
  }
  return true;
}
function validTransfer(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !validAmount(body.amount)) return false;
  const allowedKeys = new Set(["destination_type", "account_bank", "account_number", "amount", "currency", "debit_currency", "reference", "narration", "beneficiary_name", "meta"]);
  if (Object.keys(body).some(key => !allowedKeys.has(key))) return false;
  if (body.destination_type && !["bank", "mobile_money"].includes(body.destination_type)) return false;
  if (!PAYOUT_CURRENCIES.has(body.currency) || !DEBIT_CURRENCIES.has(body.debit_currency || body.currency)) return false;
  if (!safeText(body.account_number, 34) || !/^[A-Za-z0-9-]{5,34}$/.test(body.account_number)) return false;
  if (!safeText(body.beneficiary_name, 120) || !/^F3W-[0-9a-f-]{36}$/.test(body.reference) || !safeText(body.narration || "Fin3a payout", 80)) return false;
  if (body.currency === "NGN" && (!/^\\d{10}$/.test(body.account_number) || !safeText(body.account_bank, 12))) return false;
  if (["USD", "GBP", "EUR"].includes(body.currency)) return validInternationalMeta(body.currency, body.meta);
  const operator = typeof body.account_bank === "string" ? body.account_bank.toUpperCase() : "";
  if (body.destination_type === "mobile_money") return Boolean(MOBILE_NETWORKS[body.currency]?.has(operator));
  if (body.destination_type === "bank") return safeText(body.account_bank, 12);
  if (MOBILE_NETWORKS[body.currency]?.has(operator)) return true;
  return safeText(body.account_bank, 12);
}
function validPayment(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !validAmount(body.amount)) return false;
  const country = typeof body.country === "string" ? body.country.toUpperCase() : "";
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const options = PAYMENT_OPTIONS[country]?.[currency];
  return Boolean(options)
    && safeText(body.tx_ref, 100)
    && typeof body.customer === "object" && body.customer !== null && !Array.isArray(body.customer)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer.email || "")
    && safeText(body.customer.name, 120)
    && (!body.customer.phonenumber || safeText(body.customer.phonenumber, 30));
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
    return json(res, ready() ? 200 : 503, { ready: ready(), payments_ready: paymentReady() });
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
      if (spec.kind === "payout") {
        if (!validTransfer(body)) return json(res, 400, { status: "error", message: "Invalid or unsupported payout request" });
        const { destination_type, ...providerBody } = body;
        body = { ...providerBody, debit_currency: body.debit_currency || body.currency };
      }
      if (spec.kind === "collection") {
        if (!validPayment(body)) return json(res, 400, { status: "error", message: "Unsupported country/currency or invalid payment request" });
        if (!paymentReady()) return json(res, 503, { status: "error", message: "Hosted payment checkout is not configured" });
        body = {
          tx_ref: body.tx_ref,
          amount: body.amount,
          currency: body.currency.toUpperCase(),
          country: body.country.toUpperCase(),
          redirect_url: PAYMENT_REDIRECT_URL,
          payment_options: PAYMENT_OPTIONS[body.country.toUpperCase()][body.currency.toUpperCase()].join(", "),
          customer: {
            email: body.customer.email,
            name: body.customer.name,
            ...(body.customer.phonenumber ? { phonenumber: body.customer.phonenumber } : {}),
          },
          customizations: { title: "Fin3a", description: "Fin3a account funding" },
        };
      }
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
  console.log("payout relay listening", { port: PORT, configured: ready(), paymentsConfigured: paymentReady() });
});
