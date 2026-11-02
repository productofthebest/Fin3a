// Pure helpers for AI usage accounting (client-safe; mirrors the database estimate).
export type ModelPrice = { input_per_mtok: number; cached_input_per_mtok: number | null; output_per_mtok: number };

/** Estimated USD cost from real token counts and admin-entered prices; null when either is unknown. */
export function estimateCostUsd(price: ModelPrice | null, input: number | null, cached: number | null, output: number | null): number | null {
  if (!price || input === null || output === null) return null;
  const c = cached ?? 0;
  return (Math.max(input - c, 0) * price.input_per_mtok + c * (price.cached_input_per_mtok ?? price.input_per_mtok) + output * price.output_per_mtok) / 1_000_000;
}

/** Fraction of a budget used, or null if no budget is set. */
export function budgetUse(spent: number | null, budget: number | null): number | null {
  if (budget === null || budget <= 0) return null;
  return (spent ?? 0) / budget;
}

/** Duplicate-request key for a scan: same document within the same minute is treated as a repeat click. */
export function scanRequestKey(documentId: string, now = Date.now()): string {
  return `scan:${documentId}:${Math.floor(now / 60_000)}`;
}
