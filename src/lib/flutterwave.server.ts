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
