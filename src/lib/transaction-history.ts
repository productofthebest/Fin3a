// Client-safe rules for paginated transaction history.
export const HISTORY_PAGE_SIZE = 50;
export const HISTORY_MAX_PAGE_SIZE = 100;

/** Removes characters that carry meaning in PostgREST filter syntax or LIKE patterns. */
export function sanitizeHistorySearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[%_*,()\\.:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Inclusive row range for a 1-based page. */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const size = Math.min(Math.max(1, Math.floor(pageSize)), HISTORY_MAX_PAGE_SIZE);
  const p = Math.max(1, Math.floor(page));
  return { from: (p - 1) * size, to: p * size - 1 };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
