import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ReceiptText, Coins, RefreshCw, RotateCcw, WalletCards, CircleDollarSign } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { activityQuery, categoriesQuery, settingsQuery } from "@/lib/queries";
import { HISTORY_PAGE_SIZE, pageCount } from "@/lib/transaction-history";
import { deleteTransaction } from "@/lib/dashboard.functions";
import type { ActivityRow } from "@/lib/activity-history";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { recordMoney } from "@/lib/record-currencies";
import { RecordCurrencySelect } from "@/components/record-currency-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pageMeta } from "@/lib/page-meta";
import { TransactionCheckoutCard } from "@/components/transaction-checkout-card";
import { formatUserDateTime } from "@/lib/user-date-time";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => pageMeta("Activity", "Your Fin3a wallet, transfers, withdrawals, bills, crypto and imported financial history."),
  ssr: false,
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    await context.queryClient.ensureQueryData(activityQuery({ page: 1 }));
    await context.queryClient.ensureQueryData(categoriesQuery());
  },
  component: ActivityPage,
});

function TransactionIcon({ kind, direction }: { kind: string; direction: "in" | "out" | "none" }) {
  const iconClass = "size-5";
  const Icon =
    kind === "deposit" || kind === "income" || kind === "transfer_in" || kind === "swap_in"
      ? ArrowDownLeft
      : kind === "withdrawal" || kind === "expense"
        ? ArrowUpRight
        : kind === "transfer" || kind === "share_payment" || kind === "split_bill"
          ? ArrowLeftRight
          : kind === "bill_payment"
            ? ReceiptText
            : kind === "crypto"
              ? Coins
              : kind === "swap"
                ? RefreshCw
                : kind === "refund"
                  ? RotateCcw
                  : direction === "in"
                    ? ArrowDownLeft
                    : direction === "out"
                      ? ArrowUpRight
                      : WalletCards;

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/70 text-foreground">
      <Icon className={iconClass} strokeWidth={1.8} />
    </span>
  );
}

function ActivityPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [currency, setCurrency] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<ActivityRow | null>(null);
  const { data: categories } = useSuspenseQuery(categoriesQuery());

  const filters = {
    page,
    ...(currency !== "all" ? { currency } : {}),
    ...(type !== "all" ? { type } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(categoryId !== "all" ? { categoryId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { data: result, isFetching, error } = useQuery(activityQuery(filters));
  const transactions = result?.rows;
  const total = result?.total ?? 0;
  const pages = pageCount(total, HISTORY_PAGE_SIZE);
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const hasFilters = currency !== "all" || type !== "all" || status !== "all" || categoryId !== "all" || from || to || search;

  const deleteMut = useMutation({
    mutationFn: async (row: ActivityRow) => {
      if (row.recordId) return deleteTransaction({ data: { id: row.recordId } });
      throw new Error("Only imported transaction records can be deleted.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setDeleteTarget(null);
      toast.success("Imported transaction deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete"),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Wallet and financial history, newest first.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <RecordCurrencySelect value={currency} currencies={["all", ...new Set([settings?.currency ?? "USD", "NGN", "USD", ...(result?.currencies ?? [])])]} onChange={resetPage(setCurrency)} />
        <Select value={type} onValueChange={resetPage(setType)}>
          <SelectTrigger className="w-44" aria-label="Activity type"><SelectValue /></SelectTrigger>
          <SelectContent>{([["all", "All activity"], ["deposit", "Deposits"], ["withdrawal", "Withdrawals"], ["transfer", "Transfers"], ["share_payment", "Share Payment"], ["split_bill", "Split Bill"], ["bill_payment", "Bill payments"], ["crypto", "Crypto"], ["swap", "Swaps"], ["refund", "Refunds"], ["income", "Income records"], ["expense", "Expense records"]] as const).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={resetPage(setStatus)}>
          <SelectTrigger className="w-44" aria-label="Activity status"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "pending", "completed", "credited", "failed", "reversed", "cancelled", "paid", "open", "expired", "disputed", "quoted", ...new Set(transactions?.map(r => r.status) ?? [])].filter((v,i,a) => a.indexOf(v) === i).map(v => <SelectItem key={v} value={v}>{v === "all" ? "All statuses" : v.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => resetPage(setSearch)(e.target.value)}
          placeholder="Search history or reference…"
          className="w-64"
          maxLength={120}
          aria-label="Search transactions"
        />
        <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
          <SelectTrigger className="w-44" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} className="w-40" aria-label="From date" />
        <Input type="date" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} className="w-40" aria-label="To date" />
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => { setCurrency("all"); setType("all"); setStatus("all"); setSearch(""); setCategoryId("all"); setFrom(""); setTo(""); setPage(1); }}>Clear</Button>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {error ? <div className="p-6"><p className="text-sm text-destructive">History could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["activity"] })}>Try again</Button></div> : isFetching && !transactions ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {hasFilters ? "No transactions match these filters." : "No transactions recorded yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <TransactionIcon kind={tx.kind} direction={tx.direction} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {tx.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatUserDateTime(tx.date, settings?.country)}
                    {tx.category ? ` · ${tx.category.name}` : ""}
                    {` · ${tx.status.replaceAll("_", " ")}`}
                  </p>
                  {tx.reference ? <p className="truncate text-xs text-muted-foreground" title={tx.reference}>{tx.reference}</p> : null}
                  {tx.detail ? <p className="text-xs text-muted-foreground">{tx.detail}</p> : null}
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCheckoutTarget(tx)}>
                  View receipt
                </Button>
                {tx.status === "pending" ? (
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    Pending
                  </Badge>
                ) : null}
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    tx.direction === "in" && "text-positive",
                  )}
                >
                  {tx.amount === null ? "Open amount" : <>{tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}{recordMoney(tx.amount, tx.currency)}</>}
                </span>
                {tx.deletable && tx.recordId ? <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete imported record"
                  title="Delete imported record"
                  disabled={deleteMut.isPending}
                  onClick={() => setDeleteTarget(tx)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {total > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(page * HISTORY_PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>Newer</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages || isFetching} onClick={() => setPage((p) => p + 1)}>Older</Button>
          </div>
        </div>
      ) : null}
      <TransactionCheckoutCard transaction={checkoutTarget} open={Boolean(checkoutTarget)} country={settings?.country} onOpenChange={open => { if (!open) setCheckoutTarget(null); }} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleteMut.isPending) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete imported record?</AlertDialogTitle>
            <AlertDialogDescription>This imported transaction will be removed from your recorded income or spending. Wallet payment history will remain.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteMut.isPending || !deleteTarget} onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget); }}>{deleteMut.isPending ? "Deleting…" : "Delete"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
