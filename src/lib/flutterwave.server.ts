// Server-only Flutterwave client. Never import from client code.
const BASE = "https://api.flutterwave.com/v3";
import { z } from "zod";
import { payoutFetch } from "./payout-transport.server";
import { withdrawalsEnabled } from "./withdrawal-production";

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
    .filter((b) => b.code && b.name && !seen.has(b.code) && seen.add(b.code))
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
  if (!withdrawalsEnabled(process.env)) throw new ProviderRejected("withdrawals disabled");
  const res = await payoutFetch("/transfers", {
    method: "POST", signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ account_bank: input.bankCode, account_number: input.accountNumber, amount: input.amount, currency: "NGN", debit_currency: "NGN", reference: input.reference, narration: "Fin3a wallet withdrawal" }),
  });
  const body = (await res.json().catch(() => null)) as { status?: string; data?: unknown; message?: string } | null;
  if (res.ok && body?.status === "success") {
    const parsed = transferSchema.safeParse(body.data);
    return parsed.success ? parsed.data : null;
  }
  if (res.status >= 400 && res.status < 500 && body?.status === "error") {
    // Never log raw provider messages, which can include recipient data.
    throw new ProviderRejected("provider rejected transfer");
  }
  throw new Error("PROVIDER_UNCERTAIN");
}
export async function getTransfer(id: string) {
  if (!/^[1-9]\d{0,19}$/.test(id)) throw new Error("INVALID_PROVIDER_ID");
  const res = await payoutFetch(`/transfers/${id}`);
  const body = await res.json() as { status?: string; data?: unknown };
  if (!res.ok || body.status !== "success") throw new Error("PROVIDER_ERROR");
  const parsed = transferSchema.safeParse(body.data);
  if (!parsed.success) throw new Error("PROVIDER_ERROR");
  return parsed.data;
}
export async function findTransferByReference(reference: string) {
  if (!/^F3W-[0-9a-f-]{36}$/.test(reference)) throw new Error("INVALID_REFERENCE");
  const res = await payoutFetch(`/transfers?reference=${encodeURIComponent(reference)}`);
  const body = await res.json() as { status?: string; data?: unknown };
  if (!res.ok || body.status !== "success" || !Array.isArray(body.data)) throw new Error("PROVIDER_ERROR");
  const list: unknown[] = body.data;
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
  const data = await flw<unknown>(
    `/billers/${encodeURIComponent(billerCode)}/items/${encodeURIComponent(itemCode)}/validate`,
    {
      method: "POST",
      body: JSON.stringify({ customer, code: itemCode }),
    },
  );
  const parsed = z.object({ response_code: z.string().optional(), name: z.string().max(200).nullish() }).safeParse(data);
  return { valid: parsed.success, customerName: parsed.success ? (parsed.data.name ?? null) : null };
}
const billPaySchema = z.object({
  tx_ref: z.string().min(1).max(200),
  reference: z.string().min(1).max(200).nullish(),
  amount: z
    .union([
      z.number().finite(),
      z
        .string()
        .regex(/^\d+(?:\.\d+)?$/)
        .transform(Number),
    ])
    .optional(),
});
export type BillPayResult = z.infer<typeof billPaySchema>;

/** Initiates a bill payment using Flutterwave's biller/item-specific V3 endpoint. */
export async function payBill(input: {
  billerCode: string;
  itemCode: string;
  customer: string;
  amount: number;
  reference: string;
}) {
  const key = process.env["FLW_SECRET_KEY"];
  if (!key) throw new ProviderRejected("not configured");
  const res = await fetch(
    `${BASE}/billers/${encodeURIComponent(input.billerCode)}/items/${encodeURIComponent(input.itemCode)}/payment`,
    {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        country: "NG",
        customer_id: input.customer,
        amount: input.amount,
        reference: input.reference,
      }),
    },
  );
  const body = (await res.json().catch(() => null)) as {
    status?: string;
    data?: unknown;
    message?: string;
  } | null;
  if (res.ok && body?.status === "success") {
    const parsed = billPaySchema.safeParse(body.data);
    if (parsed.success) return parsed.data;
    throw new Error("PROVIDER_UNCERTAIN");
  }
  const message = typeof body?.message === "string" ? body.message.toLowerCase() : "";
  if (
    res.status >= 400 &&
    res.status < 500 &&
    body?.status === "error" &&
    /invalid customer|invalid phone|invalid biller|invalid item|wrong amount|missing parameter/.test(
      message,
    ) &&
    !/duplicate|already exists/.test(message)
  ) {
    throw new ProviderRejected("provider rejected bill payment");
  }
  throw new Error("PROVIDER_UNCERTAIN");
}

const billHistoryEntrySchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  customer_id: z.string().min(1).max(200),
  amount: z
    .union([
      z.number().finite(),
      z
        .string()
        .regex(/^\d+(?:\.\d+)?$/)
        .transform(Number),
    ])
    .transform(Number)
    .refine((value) => value > 0),
  tx_ref: z.string().min(1).max(200),
  customer_reference: z.string().min(1).max(200),
  status: z.string().min(1).max(80),
  country: z.string().max(4).optional(),
});
export type VerifiedBillStatus = z.infer<typeof billHistoryEntrySchema>;

/** Looks up a bill by our merchant reference after a DB reference-write failure.
 * The history API is filtered by our unique customer reference; only one exact
 * NGN match is accepted. No match or multiple matches stays unresolved.
 */
/** Reads a bill's provider status using the Flutterwave tx_ref returned at initiation. */
export async function getBillStatusByTxRef(txRef: string) {
  if (!txRef || txRef.length > 200) throw new Error("INVALID_PROVIDER_REFERENCE");
  const data = await flw<unknown>(`/bills/${encodeURIComponent(txRef)}?verbose=1`);
  const parsed = billHistoryEntrySchema.safeParse(data);
  if (!parsed.success) throw new Error("PROVIDER_ERROR");
  return parsed.data;
}

/** Recovers a bill when persisting its provider tx_ref failed. Query every terminal status:
 * Flutterwave's history endpoint defaults to Successful if status is omitted.
 */
export async function findBillStatusByCustomerReference(
  customerReference: string,
  fromDate: string,
  toDate: string,
) {
  if (
    !/^F3B-[0-9a-f-]{36}$/.test(customerReference) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
  ) {
    throw new Error("INVALID_BILL_RECOVERY_QUERY");
  }
  const statuses = ["Successful", "Failed", "Reversed"] as const;
  const results = await Promise.all(
    statuses.map(async (status) => {
      const query = new URLSearchParams({
        status,
        reference: customerReference,
        country: "NG",
        from: fromDate,
        to: toDate,
        page: "1",
        limit: "10",
      });
      const rows = await flw<unknown>(`/bills/history?${query.toString()}`);
      const parsed = z.array(billHistoryEntrySchema).safeParse(rows);
      if (!parsed.success) throw new Error("PROVIDER_ERROR");
      return parsed.data;
    }),
  );
  const matches = results
    .flat()
    .filter((row) =>
        row.customer_reference === customerReference &&
        (!row.country || row.country === "NG"),
    );
  const unique = [...new Map(matches.map((row) => [row.tx_ref, row])).values()];
  if (unique.length !== 1) return null;
  return unique[0];
}
