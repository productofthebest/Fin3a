import type { Database } from "@/integrations/supabase/types";
import { HISTORY_PAGE_SIZE } from "./transaction-history";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export interface ActivityRow {
  id: string; recordId?: string; kind: string; title: string; date: string;
  status: string; amount: number | null; currency: string | null;
  direction: "in" | "out" | "none"; reference: string | null;
  categoryId?: string | null; category?: { name: string; icon: string } | null | undefined;
  deletable: boolean; detail?: string | undefined;
}
export interface ActivitySources {
  records: (Row<"transactions"> & { categories?: { name: string; icon: string } | null })[];
  ledger: Row<"account_ledger">[]; transfers: Row<"internal_transfers">[];
  topups: Row<"ngn_topup_requests">[]; withdrawals: Row<"ngn_withdrawals">[];
  payments: Row<"bill_payments">[]; splits: Row<"split_bills">[];
  shares: Row<"split_bill_participants">[]; requests: Row<"qr_payment_requests">[];
  swaps: Row<"currency_swaps">[]; quotes: Row<"payment_fee_snapshots">[];
  refunds: Row<"flw_topup_refunds">[];
}
export function canDeleteRecord(record: { source: string; import_identity?: string | null }) {
  return record.source === "document" && Boolean(record.import_identity);
}
export function buildActivity(s: ActivitySources, userId: string): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const linkedLedger = new Set<string>();
  const add = (row: Omit<ActivityRow, "deletable"> & { deletable?: boolean }) => rows.push({ deletable: false, ...row });
  for (const r of s.records) add({ id: `record:${r.id}`, recordId: r.id, kind: r.type, title: r.description || r.merchant || r.type, date: `${r.occurred_at}T00:00:00Z`, status: r.status, amount: Number(r.amount), currency: r.currency, direction: r.type === "income" ? "in" : "out", reference: r.reference, categoryId: r.category_id, category: r.categories, deletable: canDeleteRecord(r) });
  const splitTransfers = new Map(s.shares.filter(r => r.transfer_id).map(r => [r.transfer_id, r.bill_id]));
  const qrTransfers = new Set(s.requests.map(r => r.transfer_id).filter(Boolean));
  for (const r of s.transfers) {
    const splitId = splitTransfers.get(r.id);
    const split = s.splits.find(b => b.id === splitId);
    const kind = splitId ? "split_bill" : qrTransfers.has(r.id) ? "share_payment" : "transfer";
    add({ id: `transfer:${r.id}`, kind, title: split ? `Split Bill · ${split.title}` : kind === "share_payment" ? "Share Payment" : "Fin3a transfer", date: r.created_at, status: r.status, amount: Number(r.amount), currency: r.currency, direction: r.from_user_id === userId ? "out" : "in", reference: r.reference });
  }
  for (const r of s.topups) {
    if (r.ledger_id) linkedLedger.add(r.ledger_id);
    add({ id: `topup:${r.id}`, kind: "deposit", title: "NGN bank deposit", date: r.created_at, status: r.status, amount: Number(r.credited_amount ?? r.requested_amount), currency: "NGN", direction: "in", reference: r.tx_ref });
  }
  for (const r of s.withdrawals) {
    linkedLedger.add(r.ledger_id);
    add({ id: `withdrawal:${r.id}`, kind: "withdrawal", title: `Bank withdrawal · ${r.bank_name}`, date: r.created_at, status: r.status, amount: Number(r.amount), currency: "NGN", direction: "out", reference: r.reference, detail: `Payout ${r.payout} · Fee ${r.fin3a_fee}` });
  }
  for (const r of s.payments) {
    linkedLedger.add(r.ledger_id);
    add({ id: `bill:${r.id}`, kind: "bill_payment", title: r.biller_name, date: r.created_at, status: r.status, amount: Number(r.amount), currency: "NGN", direction: "out", reference: r.reference });
  }
  for (const r of s.splits) {
    const share = s.shares.find(p => p.bill_id === r.id && p.user_id === userId);
    add({ id: `split:${r.id}`, kind: "split_bill", title: `Split Bill · ${r.title}`, date: r.created_at, status: r.status, amount: Number(share?.amount ?? r.total_amount), currency: r.currency, direction: "none", reference: null, detail: r.creator_id === userId ? "Bill created" : "Your share" });
  }
  for (const r of s.requests) add({ id: `request:${r.id}`, kind: "share_payment", title: r.description || "Payment request", date: r.created_at, status: r.status, amount: r.amount === null ? null : Number(r.amount), currency: r.currency, direction: "none", reference: null });
  const swapIds = new Set(s.swaps.map(r => r.id));
  for (const r of s.swaps) add({ id: `swap:${r.id}`, kind: "swap", title: `Swap · ${r.from_currency} → ${r.to_currency}`, date: r.created_at, status: r.status, amount: Number(r.source_amount), currency: r.from_currency, direction: "out", reference: r.reference, detail: `${r.destination_amount} ${r.to_currency}` });
  const transfers = new Set(s.transfers.map(r => r.id));
  const ledgerIds = new Set(s.ledger.map(r => r.id));
  const quotes = new Map(s.quotes.filter(q => q.ledger_id).map(q => [q.ledger_id, q]));
  for (const r of s.ledger) {
    const internalId = r.provider === "internal" ? r.provider_ref?.replace(/:(in|out)$/, "") : undefined;
    if (linkedLedger.has(r.id) || (internalId && (transfers.has(internalId) || swapIds.has(internalId)))) continue;
    const q = quotes.get(r.id);
    const crypto = Boolean(q?.asset);
    add({ id: `ledger:${r.id}`, kind: crypto ? "crypto" : r.kind, title: crypto ? `${q?.asset} · ${r.kind.replaceAll("_", " ")}` : r.kind.replaceAll("_", " "), date: r.created_at, status: r.status, amount: Number(r.amount), currency: r.currency, direction: ["deposit", "transfer_in", "swap_in"].includes(r.kind) ? "in" : "out", reference: r.reference, detail: q?.asset ? `${q.original_amount} ${q.asset} · ${q.network ?? ""}` : undefined });
  }
  // A quote without a ledger is not a settled crypto payment.
  for (const q of s.quotes.filter(q => q.asset && (!q.ledger_id || !ledgerIds.has(q.ledger_id)))) add({ id: `quote:${q.id}`, kind: "crypto", title: `${q.asset} · ${q.service.replaceAll("_", " ")}`, date: q.created_at, status: "quoted", amount: Number(q.final_amount), currency: q.currency, direction: "none", reference: q.provider_reference, detail: `${q.original_amount} ${q.asset} · ${q.network ?? ""}` });
  for (const r of s.refunds) add({ id: `refund:${r.provider_refund_id}`, kind: "refund", title: "Bank deposit refund", date: r.provider_created_at ?? r.verified_at, status: r.review_state, amount: Number(r.amount), currency: "NGN", direction: "none", reference: r.provider_refund_id, detail: "Administrator review · wallet unchanged" });
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
export interface ActivityFilters { page: number; currency?: string | undefined; type?: string | undefined; status?: string | undefined; categoryId?: string | undefined; from?: string | undefined; to?: string | undefined; search?: string | undefined }
export function activityPage(rows: ActivityRow[], f: ActivityFilters) {
  const currencies = [...new Set(rows.map(r => r.currency).filter((c): c is string => Boolean(c)))].sort();
  const term = f.search?.trim().toLowerCase();
  const filtered = rows.filter(r => (!f.currency || r.currency === f.currency) && (!f.type || r.kind === f.type) && (!f.status || r.status === f.status) && (!f.categoryId || (f.categoryId === "uncategorized" ? !r.categoryId : r.categoryId === f.categoryId)) && (!f.from || r.date.slice(0, 10) >= f.from) && (!f.to || r.date.slice(0, 10) <= f.to) && (!term || `${r.title} ${r.reference ?? ""} ${r.detail ?? ""}`.toLowerCase().includes(term)));
  return { rows: filtered.slice((f.page - 1) * HISTORY_PAGE_SIZE, f.page * HISTORY_PAGE_SIZE), total: filtered.length, currencies };
}