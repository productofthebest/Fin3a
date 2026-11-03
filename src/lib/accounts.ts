// Pure balance arithmetic for the Accounts page. Balances are always derived
// from verified ledger entries — never incremented when a request is created.

export type LedgerKind = "deposit" | "withdrawal" | "transfer_in" | "transfer_out";
export type LedgerStatus = "pending" | "completed" | "failed" | "reversed";

export interface LedgerEntry {
  kind: LedgerKind;
  status: LedgerStatus;
  amount: number;
}

export interface AccountBalance {
  available: number;
  pendingIn: number;
  pendingOut: number;
  pending: number;
  total: number;
}

const CREDITS: ReadonlySet<LedgerKind> = new Set(["deposit", "transfer_in"]);

export function computeAccountBalance(entries: readonly LedgerEntry[]): AccountBalance {
  let available = 0;
  let pendingIn = 0;
  let pendingOut = 0;
  for (const entry of entries) {
    if (entry.status === "failed" || entry.status === "reversed") continue;
    const credit = CREDITS.has(entry.kind);
    if (entry.status === "completed") {
      available += credit ? entry.amount : -entry.amount;
    } else if (credit) {
      pendingIn += entry.amount;
    } else {
      pendingOut += entry.amount;
    }
  }
  const pending = pendingIn - pendingOut;
  return { available, pendingIn, pendingOut, pending, total: available + pending };
}

export const ACCOUNT_CURRENCIES = ["NGN", "USD"] as const;
export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];
