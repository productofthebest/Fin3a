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
