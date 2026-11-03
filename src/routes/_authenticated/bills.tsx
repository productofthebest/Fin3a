import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BanknoteArrowDown, Globe, Layers, Plus, Receipt, Smartphone, Trash2, Tv, Wifi, Zap } from "lucide-react";
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

const PAYMENT_CATEGORIES = [
  { id: "airtime", name: "Airtime", icon: Smartphone },
  { id: "data", name: "Data", icon: Wifi },
  { id: "electricity", name: "Electricity", icon: Zap },
  { id: "cable", name: "Cable TV", icon: Tv },
  { id: "internet", name: "Internet", icon: Globe },
  { id: "tax", name: "Tax", icon: Receipt },
] as const;

function BillPaymentServices() {
  const [selected, setSelected] = useState<(typeof PAYMENT_CATEGORIES)[number] | null>(null);
  return (
    <section className="mt-6" aria-labelledby="bill-payment-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bill-payment-heading" className="font-display text-xl font-semibold">Pay bills</h2>
        <span className="text-xs text-muted-foreground">NGN wallet · Payments unavailable</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PAYMENT_CATEGORIES.map((category) => (
          <Button key={category.id} variant="outline" className="h-auto min-w-0 flex-col gap-3 whitespace-normal bg-card px-3 py-5" onClick={() => setSelected(category)} aria-label={`Select ${category.name}`}>
            <category.icon className="text-primary" aria-hidden="true" />
            <span>{category.name}</span>
          </Button>
        ))}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{selected?.name} payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Flutterwave bill payments are not connected. Providers and packages are unavailable until merchant support and funding are verified.</p>
          <p className="text-sm font-medium">No payment will be processed and your NGN wallet will not be charged.</p>
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <section className="mt-8 border-t border-border pt-6" aria-labelledby="bill-history-heading">
        <h2 id="bill-history-heading" className="font-display text-xl font-semibold">Bills history</h2>
        <p className="mt-3 text-sm text-muted-foreground">Payment history is unavailable until Flutterwave is connected. Recurring bill records below are not confirmed wallet payments.</p>
      </section>
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => pageMeta("Bills", "View Nigerian bill payment availability and manage recurring bills in Fin3a."),
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
            Utilities, subscriptions and recurring payments.
          </p>
        </div>
        <Button asChild variant="outline"><Link to="/categories"><Layers className="size-4" /> Manage categories</Link></Button>
      </div>

      <BillPaymentServices />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <div>
          <h2 className="font-display text-xl font-semibold">Recurring bills</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manual expense records only — recording a payment does not send money or debit your wallet.</p>
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
                    <BanknoteArrowDown className="size-4" /> Record payment
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
