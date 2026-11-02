import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { categoriesQuery, settingsQuery, transactionPageQuery } from "@/lib/queries";
import { HISTORY_PAGE_SIZE, pageCount } from "@/lib/transaction-history";
import {
  addTransaction,
  deleteTransaction,
  type DashboardTxInput,
} from "@/lib/dashboard.functions";
import { formatMoney, today, TX_STATUS_LABELS, type TxStatus, type TxType } from "@/lib/fin3a";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => pageMeta("Activity", "Review and manage your personal Fin3a income and expenses."),
  ssr: false,
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    await context.queryClient.ensureQueryData(transactionPageQuery({ page: 1 }));
    await context.queryClient.ensureQueryData(categoriesQuery());
  },
  component: ActivityPage,
});

function AddTransactionDialog({ currency }: { currency: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as TxType,
    amount: "",
    category_id: "",
    occurred_at: today(),
    merchant: "",
    description: "",
    status: "completed" as TxStatus,
    notes: "",
  });
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const kindCategories = categories.filter((c) => c.kind === form.type);

  const addMut = useMutation({
    mutationFn: (input: DashboardTxInput) => addTransaction({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Transaction added");
      setOpen(false);
      setForm((f) => ({ ...f, amount: "", merchant: "", description: "", notes: "" }));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add"),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    addMut.mutate({
      type: form.type,
      amount,
      category_id: form.category_id || null,
      occurred_at: form.occurred_at,
      status: form.status,
      merchant: form.merchant || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t, category_id: "" }))}
                className={cn(
                  "rounded-md py-1.5 text-sm transition-colors",
                  form.type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {t === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Amount ({currency})</Label>
            <Input
              id="tx-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {kindCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                required
                value={form.occurred_at}
                onChange={(e) => setForm((f) => ({ ...f, occurred_at: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-merchant">Merchant</Label>
              <Input
                id="tx-merchant"
                value={form.merchant}
                onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="e.g. Shoprite"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as TxStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TX_STATUS_LABELS) as TxStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {TX_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Description</Label>
            <Input
              id="tx-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What was it for?"
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addMut.isPending} className="w-full">
              {addMut.isPending ? "Saving…" : "Save transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const [type, setType] = useState<"all" | TxType>("all");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const currency = settings?.currency ?? "USD";
  const { data: categories } = useSuspenseQuery(categoriesQuery());

  const filters = {
    page,
    ...(type !== "all" ? { type } : {}),
    ...(categoryId !== "all" ? { categoryId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { data: result, isFetching } = useQuery(transactionPageQuery(filters));
  const transactions = result?.rows;
  const total = result?.total ?? 0;
  const pages = pageCount(total, HISTORY_PAGE_SIZE);
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const hasFilters = type !== "all" || categoryId !== "all" || from || to || search;

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTransaction({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Transaction deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete"),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you've recorded, newest first.</p>
        </div>
        <AddTransactionDialog currency={currency} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["all", "income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => resetPage(setType)(t)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm capitalize transition-colors",
                type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => resetPage(setSearch)(e.target.value)}
          placeholder="Search description or merchant…"
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
          <Button variant="ghost" size="sm" onClick={() => { setType("all"); setSearch(""); setCategoryId("all"); setFrom(""); setTo(""); setPage(1); }}>Clear</Button>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {isFetching && !transactions ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {hasFilters ? "No transactions match these filters." : "Nothing here yet. Add your first transaction to see it in Spending."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg leading-none">{tx.category?.icon ?? "💠"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {tx.description || tx.merchant || (tx.type === "income" ? "Income" : "Expense")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.occurred_at}
                    {tx.category ? ` · ${tx.category.name}` : ""}
                    {tx.status !== "completed" ? ` · ${TX_STATUS_LABELS[tx.status]}` : ""}
                  </p>
                </div>
                {tx.status === "pending" ? (
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    Pending
                  </Badge>
                ) : null}
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    tx.type === "income" && "text-positive",
                  )}
                >
                  {tx.type === "income" ? "+" : "−"}
                  {formatMoney(Number(tx.amount), currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete transaction"
                  onClick={() => deleteMut.mutate(tx.id)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
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
    </AppShell>
  );
}
