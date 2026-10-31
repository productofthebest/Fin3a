import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BanknoteArrowDown, Plus, Trash2 } from "lucide-react";
import type { Frequency } from "@/lib/fin3a";

import { AppShell } from "@/components/app-shell";
import { addBill, deleteBill, recordBillPayment, toggleBillActive } from "@/lib/bills.functions";
import { billsQuery, categoriesQuery, settingsQuery } from "@/lib/queries";
import { formatMoney, FREQUENCY_LABELS, today } from "@/lib/fin3a";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { pageMeta } from "@/lib/page-meta";

const FREQUENCIES: Frequency[] = ["weekly", "monthly", "quarterly", "yearly"];

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => pageMeta("Bills", "Manage your recurring bills and payment records in Fin3a."),
  ssr: false,
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    await context.queryClient.ensureQueryData(billsQuery());
    await context.queryClient.ensureQueryData(categoriesQuery());
  },
  component: BillsPage,
});

function AddBillDialog({ currency }: { currency: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly" as Frequency,
    next_due_date: today(),
    category_id: "",
    notes: "",
  });
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const addMut = useMutation({
    mutationFn: () =>
      addBill({
        data: {
          name: form.name,
          amount: Number(form.amount),
          frequency: form.frequency,
          next_due_date: form.next_due_date,
          category_id: form.category_id || null,
          notes: form.notes || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Bill added");
      setOpen(false);
      setForm((f) => ({ ...f, name: "", amount: "", notes: "" }));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add bill"),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a name and a valid amount");
      return;
    }
    addMut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add bill
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New recurring bill</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bill-name">Name</Label>
            <Input
              id="bill-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Electricity"
              maxLength={120}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bill-amount">Amount ({currency})</Label>
              <Input
                id="bill-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as Frequency }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {FREQUENCY_LABELS[freq]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Next due</Label>
              <Input
                type="date"
                value={form.next_due_date}
                onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
                required
              />
            </div>
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
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addMut.isPending} className="w-full">
              {addMut.isPending ? "Saving…" : "Save bill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BillsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const { data: bills } = useSuspenseQuery(billsQuery());
  const currency = settings?.currency ?? "USD";

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }

  const payMut = useMutation({
    mutationFn: (id: string) => recordBillPayment({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Payment recorded — bill moved to its next due date");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to record payment"),
  });

  const toggleMut = useMutation({
    mutationFn: (input: { id: string; active: boolean }) => toggleBillActive({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success("Bill updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update bill"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBill({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Bill deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete bill"),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Bills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Money that leaves on a schedule — rent, power, subscriptions.
          </p>
        </div>
        <AddBillDialog currency={currency} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-xl">All bills</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No bills yet. Add rent, utilities or subscriptions so they're never a surprise.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {bills.map((bill) => (
                <li key={bill.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="text-lg leading-none">{bill.category?.icon ?? "🧾"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {FREQUENCY_LABELS[bill.frequency]} · next due {bill.next_due_date}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(Number(bill.amount), currency)}
                  </span>
                  <Switch
                    checked={bill.active}
                    onCheckedChange={(active) => toggleMut.mutate({ id: bill.id, active })}
                    aria-label={`Toggle ${bill.name}`}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!bill.active || payMut.isPending}
                    onClick={() => payMut.mutate(bill.id)}
                  >
                    <BanknoteArrowDown className="size-4" /> Paid
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${bill.name}`}
                    onClick={() => deleteMut.mutate(bill.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
