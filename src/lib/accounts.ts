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

export interface AccountActivityRow extends LedgerEntry {
  currency: string;
  created_at: string;
}

// Aggregate-only activity summary for the AI assistant: totals and counts per
// currency, never references or provider details.
export function summarizeAccountActivity(rows: readonly AccountActivityRow[], today: string) {
  const month = today.slice(0, 7);
  const out: Record<string, { balance: AccountBalance; thisMonth: Record<LedgerKind, { count: number; completedTotal: number }>; pendingCount: number; failedCount: number; totalEntries: number }> = {};
  for (const c of ACCOUNT_CURRENCIES) {
    const list = rows.filter((r) => r.currency === c);
    const thisMonth = { deposit: { count: 0, completedTotal: 0 }, withdrawal: { count: 0, completedTotal: 0 }, transfer_in: { count: 0, completedTotal: 0 }, transfer_out: { count: 0, completedTotal: 0 } };
    for (const r of list) {
      if (r.created_at.slice(0, 7) !== month) continue;
      thisMonth[r.kind].count++;
      if (r.status === "completed") thisMonth[r.kind].completedTotal += r.amount;
    }
    out[c] = {
      balance: computeAccountBalance(list),
      thisMonth,
      pendingCount: list.filter((r) => r.status === "pending").length,
      failedCount: list.filter((r) => r.status === "failed").length,
      totalEntries: list.length,
    };
  }
  return out;
}
