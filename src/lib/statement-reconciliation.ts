// Pure statement checks shared by the scanner and tests. All arithmetic is in integer minor units (cents).

export type StatementSummary = {
  opening_balance: number | null;
  closing_balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  currency: string | null;
};

export type ReconRow = { amount: number; type: "income" | "expense" };

export type CheckResult = { status: "matched" | "mismatch" | "not_printed"; printed: number | null; computed: number | null; difference: number | null };

export type Reconciliation = {
  status: "matched" | "mismatch" | "unverifiable";
  credits: CheckResult;
  debits: CheckResult;
  balance: CheckResult;
  message: string;
};

const cents = (n: number) => Math.round(n * 100);
const fromCents = (n: number) => n / 100;

function check(printed: number | null, computedCents: number | null): CheckResult {
  if (printed === null || !Number.isFinite(printed) || computedCents === null) {
    return { status: "not_printed", printed: printed ?? null, computed: computedCents === null ? null : fromCents(computedCents), difference: null };
  }
  const diff = computedCents - cents(printed);
  return { status: diff === 0 ? "matched" : "mismatch", printed, computed: fromCents(computedCents), difference: fromCents(diff) };
}

/**
 * Compares extracted transaction lines against the totals printed on the statement.
 * Never invents values: a check is only performed when the statement printed the number.
 */
export function reconcileStatement(summary: StatementSummary | null, rows: ReconRow[]): Reconciliation {
  const credit = rows.filter((r) => r.type === "income").reduce((s, r) => s + cents(r.amount), 0);
  const debit = rows.filter((r) => r.type === "expense").reduce((s, r) => s + cents(r.amount), 0);
  const s = summary ?? { opening_balance: null, closing_balance: null, total_credits: null, total_debits: null, currency: null };
  const credits = check(s.total_credits, credit);
  const debits = check(s.total_debits, debit);
  const balance =
    s.opening_balance !== null && s.closing_balance !== null
      ? check(s.closing_balance, cents(s.opening_balance) + credit - debit)
      : check(null, null);
  const checks = [credits, debits, balance];
  const performed = checks.filter((c) => c.status !== "not_printed");
  const status = performed.length === 0 ? "unverifiable" : performed.some((c) => c.status === "mismatch") ? "mismatch" : "matched";
  const message =
    status === "unverifiable"
      ? "Totals not verified: the document did not show opening/closing balances or totals."
      : status === "matched"
        ? "Totals verified: extracted lines match the statement's printed figures."
        : `Totals do not match the statement (${[
            credits.status === "mismatch" ? `credits off by ${credits.difference?.toFixed(2)}` : null,
            debits.status === "mismatch" ? `debits off by ${debits.difference?.toFixed(2)}` : null,
            balance.status === "mismatch" ? `closing balance off by ${balance.difference?.toFixed(2)}` : null,
          ].filter(Boolean).join(", ")}). Some lines may be missing or misread — review before importing.`;
  return { status, credits, debits, balance, message };
}

/** Merges per-chunk summaries: opening from the first chunk that printed one, closing from the last. */
export function mergeSummaries(parts: (StatementSummary | null)[]): StatementSummary | null {
  const present = parts.filter((p): p is StatementSummary => p !== null);
  if (present.length === 0) return null;
  const sumOrNull = (key: "total_credits" | "total_debits") => {
    const vals = present.map((p) => p[key]).filter((v): v is number => v !== null);
    // Totals printed once (usually the summary page) are used as-is; several printed totals are ambiguous.
    return vals.length === 1 ? vals[0]! : null;
  };
  return {
    opening_balance: present.find((p) => p.opening_balance !== null)?.opening_balance ?? null,
    closing_balance: [...present].reverse().find((p) => p.closing_balance !== null)?.closing_balance ?? null,
    total_credits: sumOrNull("total_credits"),
    total_debits: sumOrNull("total_debits"),
    currency: present.find((p) => p.currency)?.currency ?? null,
  };
}

/** Splits a page count into contiguous chunks. */
export function planPageChunks(pageCount: number, chunkSize: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (let start = 0; start < pageCount; start += chunkSize) out.push({ start, end: Math.min(pageCount, start + chunkSize) });
  return out;
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export const DUPLICATE_DAY_WINDOW = 3;

export type DupDraft = { id: string; txn_date: string | null; amount: number | null; merchant: string | null; reference: string | null; currency: string | null; type: string };
export type DupTx = { id: string; amount: number; occurred_at: string; merchant: string | null; reference: string | null; currency: string | null; type: string };

const DAY = 86_400_000;
const day = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime();

/** Query bounds that include the full ± window around every draft date (inclusive end-of-day). */
export function duplicateSearchRange(dates: string[]): { from: string; toExclusive: string } | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  const from = new Date(day(sorted[0]!) - DUPLICATE_DAY_WINDOW * DAY).toISOString().slice(0, 10);
  const toExclusive = new Date(day(sorted[sorted.length - 1]!) + (DUPLICATE_DAY_WINDOW + 1) * DAY).toISOString().slice(0, 10);
  return { from, toExclusive };
}

export type DuplicateMatch = { txId: string; confidence: "exact" | "likely"; reason: string };

const NOISE = new Set(["pos", "trf", "transfer", "nip", "web", "purchase", "payment", "debit", "credit", "to", "from", "for", "ref", "the", "ltd", "limited", "ng", "lagos", "via", "card"]);

/** Normalises a transaction name: lowercase, strips punctuation, long digit runs and bank boilerplate words. */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w) && !/^\d{4,}$/.test(w))
    .join(" ");
}

/** Token overlap (Jaccard) between two normalised names, 0..1. */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = new Set(normalizeName(a).split(" ").filter(Boolean));
  const y = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

const normRef = (s: string | null) => s?.replace(/\s+/g, "").toLowerCase() || null;

/**
 * Matches drafts to existing transactions by date, amount, name, type and currency.
 * - exact: same day + same amount + (same reference or same normalised name)
 * - likely: within the day window + same amount + (same reference or similar name)
 * Same amount on a different date with an unrelated name is never a match.
 * Each existing transaction backs at most one draft, so legitimate repeats (two 5,000 purchases) are preserved.
 */
export function findDuplicates(drafts: (DupDraft & { description?: string | null })[], txs: (DupTx & { description?: string | null })[]): Map<string, DuplicateMatch> {
  const used = new Set<string>();
  const result = new Map<string, DuplicateMatch>();
  const name = (r: { merchant: string | null; description?: string | null }) => r.merchant || r.description || null;
  const eligible = (d: DupDraft, tx: DupTx) =>
    !used.has(tx.id) && cents(Number(tx.amount)) === cents(Number(d.amount)) && tx.currency === d.currency && tx.type === d.type;
  // Pass 1: exact matches first so they claim their transaction before fuzzy ones.
  for (const pass of ["exact", "likely"] as const) {
    for (const d of drafts) {
      if (result.has(d.id) || !d.txn_date || d.amount === null) continue;
      let best: { tx: DupTx; score: number; reason: string } | null = null;
      for (const tx of txs) {
        if (!eligible(d, tx)) continue;
        const gap = Math.abs(day(tx.occurred_at) - day(d.txn_date)) / DAY;
        const refMatch = !!normRef(d.reference) && normRef(d.reference) === normRef(tx.reference);
        const sim = nameSimilarity(name(d), name(tx));
        if (pass === "exact") {
          if (gap !== 0) continue;
          if (refMatch) { best = { tx, score: 2, reason: "Same date, amount and transaction reference" }; break; }
          if (sim === 1) { if (!best || best.score < 1) best = { tx, score: 1, reason: "Same date, amount and name" }; }
        } else {
          if (gap > DUPLICATE_DAY_WINDOW) continue;
          if (refMatch || sim >= 0.5) {
            const score = (refMatch ? 1 : sim) - gap * 0.1;
            if (!best || score > best.score) best = { tx, score, reason: refMatch ? `Same amount and reference, ${gap} day(s) apart` : `Same amount, similar name, ${gap === 0 ? "same day" : `${gap} day(s) apart`}` };
          }
        }
      }
      if (best) { used.add(best.tx.id); result.set(d.id, { txId: best.tx.id, confidence: pass, reason: best.reason }); }
    }
  }
  return result;
}

/** Each existing transaction can be the duplicate candidate of at most one draft. */
export function matchDuplicates(drafts: DupDraft[], txs: DupTx[]): Map<string, string> {
  return new Map([...findDuplicates(drafts, txs)].map(([k, v]) => [k, v.txId]));
}
