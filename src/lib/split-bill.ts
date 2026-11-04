// Pure split-bill arithmetic. All money math runs in integer cents to avoid
// floating-point drift; never mark payments paid here — only the server does.

export const SPLIT_CURRENCIES = ["NGN", "USD"] as const;
export type SplitCurrency = (typeof SPLIT_CURRENCIES)[number];

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Equal split with largest-remainder rounding so shares always sum to the
 * total. e.g. ₦100,000 across 3 people → 3333334, 3333333, 3333333 cents.
 */
export function equalSplit(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error("Total must be a positive amount");
  if (!Number.isInteger(count) || count <= 0) throw new Error("Need at least one participant");
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Returns an error message, or null when the custom shares are valid. */
export function validateCustomSplit(totalCents: number, shares: readonly number[]): string | null {
  if (shares.length === 0) return "Add at least one participant";
  if (shares.some((s) => !Number.isInteger(s) || s <= 0)) return "Every share must be a positive amount";
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum !== totalCents) {
    const diff = totalCents - sum;
    return diff > 0
      ? `Shares are ${fromCents(diff).toFixed(2)} short of the total`
      : `Shares exceed the total by ${fromCents(-diff).toFixed(2)}`;
  }
  return null;
}

export type ShareDisplayStatus = "paid" | "pending" | "overdue";

export function shareDisplayStatus(
  status: "pending" | "paid",
  deadline: string | null,
  today: string,
): ShareDisplayStatus {
  if (status === "paid") return "paid";
  if (deadline && deadline < today) return "overdue";
  return "pending";
}

export interface ShareForProgress {
  amount: number;
  status: "pending" | "paid";
  is_creator: boolean;
}

export interface BillProgress {
  collected: number;
  outstanding: number;
  paidCount: number;
  pendingCount: number;
}

/** Creator's own share counts as collected — they do not pay themselves. */
export function billProgress(shares: readonly ShareForProgress[]): BillProgress {
  let collected = 0;
  let outstanding = 0;
  let paidCount = 0;
  let pendingCount = 0;
  for (const share of shares) {
    if (share.status === "paid" || share.is_creator) {
      collected += share.amount;
      if (!share.is_creator) paidCount++;
    } else {
      outstanding += share.amount;
      pendingCount++;
    }
  }
  return { collected, outstanding, paidCount, pendingCount };
}

/** Split a total by whole/decimal percentages (must sum to exactly 100). Remainder cents go to the first shares. */
export function percentSplit(totalCents: number, percents: readonly number[]): number[] | string {
  if (percents.length === 0) return "Add at least one recipient";
  if (percents.some((p) => !Number.isFinite(p) || p <= 0)) return "Every percentage must be above 0";
  const basis = percents.map((p) => Math.round(p * 100));
  if (basis.reduce((a, b) => a + b, 0) !== 10000) return "Percentages must add up to 100%";
  const shares = basis.map((b) => Math.floor((totalCents * b) / 10000));
  let rest = totalCents - shares.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % shares.length, rest--) shares[i]! += 1;
  if (shares.some((s) => s <= 0)) return "Each share must be at least 0.01";
  return shares;
}
