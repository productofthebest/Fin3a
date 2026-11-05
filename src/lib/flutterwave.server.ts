// Server-only Flutterwave client. Never import from client code.
const BASE = "https://api.flutterwave.com/v3";

async function flw<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env["FLW_SECRET_KEY"];
  if (!key) throw new Error("Bank partner is not configured.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as { status?: string; data?: T; message?: string } | null;
  if (!res.ok || body?.status !== "success") {
    console.error("Flutterwave request failed", path, res.status, body?.message);
    throw new Error("PROVIDER_ERROR");
  }
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

/** Re-checks a payment with Flutterwave. Only a successful NGN charge for this exact reference counts. */
export async function verifyPaymentByReference(txRef: string) {
  try {
    const data = await flw<{ id: number; tx_ref: string; status: string; currency: string; amount: number }>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`);
    if (data.tx_ref !== txRef || data.status !== "successful" || data.currency !== "NGN" || !(Number(data.amount) > 0)) return null;
    return { providerTxId: String(data.id), amount: Number(data.amount) };
  } catch {
    return null;
  }
}
