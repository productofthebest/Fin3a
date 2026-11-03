// Phase 5 alert rules. Pure and deterministic: inputs are only Fin3a-internal
// records (recurring bills, split bills, scanned document drafts, Fin3a ledger
// transactions). No external data, no AI, no invented amounts.

export type AlertSeverity = "high" | "medium" | "info";
export interface Fin3aAlert {
  id: string;
  kind: "bill_overdue" | "bill_due_soon" | "split_unpaid" | "split_owed" | "scan_review" | "scan_failed" | "unusual_expense";
  severity: AlertSeverity;
  title: string;
  detail: string;
  link: "/bills" | "/accounts/split" | "/documents" | "/activity";
}

export interface AlertInputs {
  today: string; // YYYY-MM-DD (UTC)
  bills: { id: string; name: string; amount: number; next_due_date: string; active: boolean }[];
  splitOwedByMe: { id: string; title: string; amount: number; currency: string; deadline: string | null }[];
  splitOwedToMe: { id: string; title: string; unpaidCount: number; unpaidTotal: number; currency: string }[];
  pendingDrafts: { document_id: string; filename: string; count: number }[];
  failedDocuments: { id: string; filename: string }[];
  expenses: { id: string; amount: number; currency: string | null; occurred_at: string; description: string | null; status: string; classification: string; flag: string | null }[];
}

export const DUE_SOON_DAYS = 3;
export const UNUSUAL_MIN_HISTORY = 5;
export const UNUSUAL_MULTIPLIER = 3;
export const UNUSUAL_WINDOW_DAYS = 7;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}
const money = (n: number, c: string | null) => `${c ?? ""} ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function buildAlerts(i: AlertInputs): Fin3aAlert[] {
  const out: Fin3aAlert[] = [];
  for (const b of i.bills) {
    if (!b.active) continue;
    const d = daysBetween(i.today, b.next_due_date);
    if (d < 0) out.push({ id: `bill-${b.id}`, kind: "bill_overdue", severity: "high", title: `${b.name} is overdue`, detail: `Due ${b.next_due_date} (${-d} day${d === -1 ? "" : "s"} ago).`, link: "/bills" });
    else if (d <= DUE_SOON_DAYS) out.push({ id: `bill-${b.id}`, kind: "bill_due_soon", severity: "medium", title: `${b.name} due ${d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}`, detail: `Due ${b.next_due_date}.`, link: "/bills" });
  }
  for (const s of i.splitOwedByMe) {
    const late = s.deadline !== null && daysBetween(i.today, s.deadline) < 0;
    out.push({ id: `owe-${s.id}`, kind: "split_owed", severity: late ? "high" : "medium", title: `You owe ${money(s.amount, s.currency)} on ${s.title}`, detail: s.deadline ? `Deadline ${s.deadline}${late ? " has passed" : ""}.` : "No deadline set.", link: "/accounts/split" });
  }
  for (const s of i.splitOwedToMe) {
    if (s.unpaidCount <= 0) continue;
    out.push({ id: `split-${s.id}`, kind: "split_unpaid", severity: "info", title: `${s.unpaidCount} unpaid share${s.unpaidCount === 1 ? "" : "s"} on ${s.title}`, detail: `${money(s.unpaidTotal, s.currency)} outstanding.`, link: "/accounts/split" });
  }
  for (const d of i.pendingDrafts) {
    if (d.count <= 0) continue;
    out.push({ id: `scan-${d.document_id}`, kind: "scan_review", severity: "medium", title: `${d.count} scanned line${d.count === 1 ? "" : "s"} awaiting review`, detail: `From ${d.filename}. Not counted until you confirm.`, link: "/documents" });
  }
  for (const f of i.failedDocuments) out.push({ id: `fail-${f.id}`, kind: "scan_failed", severity: "medium", title: `Scan failed: ${f.filename}`, detail: "Upload again or try a clearer file.", link: "/documents" });

  // Unusual expense: a recent completed regular expense ≥ 3× the median of the
  // same currency's earlier completed regular expenses (needs ≥ 5 baseline records).
  const eligible = i.expenses.filter(e => e.status === "completed" && e.classification === "regular" && !e.flag && e.currency && e.amount > 0);
  const byCur = new Map<string, typeof eligible>();
  for (const e of eligible) byCur.set(e.currency!, [...(byCur.get(e.currency!) ?? []), e]);
  for (const [cur, list] of byCur) {
    const recent = list.filter(e => { const d = daysBetween(e.occurred_at.slice(0, 10), i.today); return d >= 0 && d <= UNUSUAL_WINDOW_DAYS; });
    const baseline = list.filter(e => daysBetween(e.occurred_at.slice(0, 10), i.today) > UNUSUAL_WINDOW_DAYS).map(e => e.amount);
    if (baseline.length < UNUSUAL_MIN_HISTORY) continue;
    const med = median(baseline);
    for (const e of recent) if (med > 0 && e.amount >= med * UNUSUAL_MULTIPLIER)
      out.push({ id: `unusual-${e.id}`, kind: "unusual_expense", severity: "info", title: `Unusually large expense: ${money(e.amount, cur)}`, detail: `${e.description ?? "Expense"} on ${e.occurred_at.slice(0, 10)} is ${(e.amount / med).toFixed(1)}× your typical ${money(med, cur)}.`, link: "/activity" });
  }
  const rank = { high: 0, medium: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
