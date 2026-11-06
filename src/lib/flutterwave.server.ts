// Server-only Flutterwave client. Never import from client code.
const BASE = "https://api.flutterwave.com/v3";
import { z } from "zod";

async function flw<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env["FLW_SECRET_KEY"];
  if (!key) throw new Error("Bank partner is not configured.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(12_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as { status?: string; data?: T; message?: string } | null;
  if (!res.ok || body?.status !== "success") {
    throw new Error("PROVIDER_ERROR");
  }
  if (body.data == null) throw new Error("PROVIDER_ERROR");
  return body.data as T;
}

export async function listNigerianBanks() {
  const data = await flw<{ code: string; name: string }[]>("/banks/NG");
  const seen = new Set<string>();
  return data
    .filter(b => b.code && b.name && !seen.has(b.code) && seen.add(b.code))
    .map(b => ({ code: b.code, name: b.name.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function resolveBankAccount(accountNumber: string, bankCode: string) {
  const data = await flw<{ account_name: string; account_number: string }>("/accounts/resolve", {
    method: "POST",
    body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
  });
  return { accountName: data.account_name, accountNumber: data.account_number };
}

export async function createDynamicVirtualAccount(input: { email: string; amount: number; txRef: string }) {
  const data = await flw<{ account_number: string; bank_name: string; expiry_date: string; amount: string | number }>("/virtual-account-numbers", {
    method: "POST",
    body: JSON.stringify({ email: input.email, amount: input.amount, tx_ref: input.txRef, is_permanent: false, currency: "NGN", narration: "Fin3a wallet top-up" }),
  });
  return { accountNumber: data.account_number, bankName: data.bank_name, expiresAt: data.expiry_date };
}

const providerId = z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d{0,19}$/)]).transform(String);
const money = z.number().finite().nonnegative().max(1_000_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001);
const chargeSchema = z.object({ id: providerId, tx_ref: z.string().min(1).max(200), status: z.string().min(1).max(80), currency: z.string().min(3).max(10), amount: money, charged_amount: money.nullish(), app_fee: money.nullish(), merchant_fee: money.nullish(), created_at: z.string().datetime({ offset: true }).nullish() });
export type VerifiedCharge = z.infer<typeof chargeSchema>;
function parseCharge(data: unknown): VerifiedCharge { const parsed = chargeSchema.safeParse(data); if (!parsed.success) throw new Error("PROVIDER_ERROR"); return parsed.data; }
/** Provider failures propagate so a webhook never acknowledges an unverified notification. */
export async function verifyPaymentByReference(txRef: string) {
  return parseCharge(await flw<unknown>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`));
}
export async function verifyPaymentById(id: string) {
  if (!/^[1-9]\d{0,19}$/.test(id)) throw new Error("INVALID_PROVIDER_ID");
  return parseCharge(await flw<unknown>(`/transactions/${id}/verify`));
}
const refundSchema = z.object({ id: providerId, transaction_id: providerId, amount_refunded: money, status: z.string().min(1).max(80), created_at: z.string().datetime({ offset: true }).nullish() });
export async function retrieveRefund(id: string) {
  if (!/^[1-9]\d{0,19}$/.test(id)) throw new Error("INVALID_PROVIDER_ID");
  // Official retrieval reference shows an unwrapped body; API deployments may wrap it in status/data.
  const key = process.env["FLW_SECRET_KEY"];
  if (!key) throw new Error("PROVIDER_ERROR");
  const response = await fetch(`${BASE}/refunds/${id}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("PROVIDER_ERROR");
  const candidate = body && typeof body === "object" && "data" in body ? ("status" in body && body.status === "success" ? body.data : null) : body;
  const parsed = refundSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("PROVIDER_ERROR");
  return parsed.data;
}

const transferSchema = z.object({ id: providerId, reference: z.string().min(1).max(200), status: z.string().min(1).max(40), currency: z.string().min(3).max(10), amount: money });
export type VerifiedTransfer = z.infer<typeof transferSchema>;
/** Maps Flutterwave transfer status to a final Fin3a outcome; anything else stays pending. */
export function transferOutcome(status: string): "successful" | "failed" | "pending" {
  const s = status.toUpperCase();
  if (s === "SUCCESSFUL") return "successful";
  if (s === "FAILED") return "failed";
  return "pending";
}
export class ProviderRejected extends Error {}
/** Sends an NGN payout. Throws ProviderRejected only when Flutterwave clearly refused (no transfer created). */
export async function createNgnTransfer(input: { bankCode: string; accountNumber: string; amount: number; reference: string }) {
  const key = process.env["FLW_SECRET_KEY"];
  if (!key) throw new ProviderRejected("not configured");
  const res = await fetch(`${BASE}/transfers`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ account_bank: input.bankCode, account_number: input.accountNumber, amount: input.amount, currency: "NGN", debit_currency: "NGN", reference: input.reference, narration: "Fin3a wallet withdrawal" }),
  });
  const body = (await res.json().catch(() => null)) as { status?: string; data?: unknown; message?: string } | null;
  if (res.ok && body?.status === "success") {
    const parsed = transferSchema.safeParse(body.data);
    return parsed.success ? parsed.data : null;
  }
  if (res.status >= 400 && res.status < 500 && body?.status === "error") {
    console.error("flw transfer rejected", res.status, body.message);
    throw new ProviderRejected(body.message ?? "rejected");
  }
  throw new Error("PROVIDER_UNCERTAIN");
}
export async function getTransfer(id: string) {
  if (!/^[1-9]\d{0,19}$/.test(id)) throw new Error("INVALID_PROVIDER_ID");
  const parsed = transferSchema.safeParse(await flw<unknown>(`/transfers/${id}`));
  if (!parsed.success) throw new Error("PROVIDER_ERROR");
  return parsed.data;
}
export async function findTransferByReference(reference: string) {
  const list = await flw<unknown[]>(`/transfers?reference=${encodeURIComponent(reference)}`);
  const match = list.map(x => transferSchema.safeParse(x)).find(p => p.success && p.data.reference === reference);
  return match?.success ? match.data : null;
}

// ---- Bills (v3) ----
const billerSchema = z.object({ biller_code: z.string().min(1).max(80), name: z.string().min(1).max(160), item_code: z.string().min(1).max(80), short_name: z.string().max(160).nullish(), amount: z.number().finite().nonnegative().nullish(), country: z.string().max(4).nullish(), label_name: z.string().max(120).nullish() });
export type BillBiller = z.infer<typeof billerSchema>;
/** Billers for a category query, e.g. "airtime=1" or "data_bundle=1". Nigerian billers only. */
export async function getBillCategories(query: string) {
  const data = await flw<unknown[]>(`/bill-categories?${query}`);
  return data.map(x => billerSchema.safeParse(x)).filter(p => p.success).map(p => p.data).filter(b => !b.country || b.country === "NG");
}
export async function validateBillCustomer(billerCode: string, itemCode: string, customer: string) {
  const data = await flw<unknown>(`/billers/${encodeURIComponent(billerCode)}/items/${encodeURIComponent(itemCode)}/validate`, {
    method: "POST",
    body: JSON.stringify({ customer, code: itemCode }),
  });
  const parsed = z.object({ response_code: z.string().optional(), name: z.string().max(200).nullish() }).safeParse(data);
  return { valid: parsed.success, customerName: parsed.success ? (parsed.data.name ?? null) : null };
}
const billPaySchema = z.object({ id: providerId, tx_ref: z.string().min(1).max(200).nullish(), reference: z.string().min(1).max(200).nullish(), status: z.string().min(1).max(80), amount: money.nullish(), currency: z.string().max(10).nullish() });
export type BillPayResult = z.infer<typeof billPaySchema>;
/** Pays a bill, debiting the Flutterwave balance. Throws ProviderRejected only on a clear refusal. */
export async function payBill(input: { billerName: string; type: string; customer: string; amount: number; reference: string }) {
  const key = process.env["FLW_SECRET_KEY"];
  if (!key) throw new ProviderRejected("not configured");
  const res = await fetch(`${BASE}/bills`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ country: "NG", customer: input.customer, amount: input.amount, type: input.type, reference: input.reference, biller_name: input.billerName }),
  });
  const body = (await res.json().catch(() => null)) as { status?: string; data?: unknown; message?: string } | null;
  if (res.ok && body?.status === "success") {
    const parsed = billPaySchema.safeParse(body.data);
    return parsed.success ? parsed.data : null;
  }
  if (res.status >= 400 && res.status < 500 && body?.status === "error") {
    console.error("flw bill rejected", res.status, body.message);
    throw new ProviderRejected(body.message ?? "rejected");
  }
  throw new Error("PROVIDER_UNCERTAIN");
}
