import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BanknoteArrowDown, Globe, Receipt, Smartphone, Trash2, Tv, Wifi, Zap } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { deleteBill, recordBillPayment, toggleBillActive } from "@/lib/bills.functions";
import { checkBillPayment, getBillBillers, getBillPayments, payBillFn, validateBillCustomerFn, type BillBillerView, type BillCategory } from "@/lib/bills-pay.functions";
import { billsQuery, categoriesQuery, settingsQuery } from "@/lib/queries";
import { formatMoney, FREQUENCY_LABELS } from "@/lib/fin3a";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { pageMeta } from "@/lib/page-meta";

const ngn = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol" }).format(n);

const PAYMENT_CATEGORIES = [
  { id: "airtime", name: "Airtime", icon: Smartphone },
  { id: "data", name: "Data", icon: Wifi },
  { id: "electricity", name: "Electricity", icon: Zap },
  { id: "cable", name: "Cable TV", icon: Tv },
  { id: "internet", name: "Internet", icon: Globe },
  { id: "tax", name: "Tax", icon: Receipt },
] as const;

function BillPaymentServices() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<(typeof PAYMENT_CATEGORIES)[number] | null>(null);
  const [biller, setBiller] = useState<BillBillerView | null>(null);
  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);

  const category = selected?.id as BillCategory | undefined;
  const { data: billerData, isFetching: billersLoading } = useQuery({
    queryKey: ["bill-billers", category],
    queryFn: () => getBillBillers({ data: { category: category! } }),
    enabled: Boolean(category),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const { data: history } = useQuery({ queryKey: ["bill-payments"], queryFn: () => getBillPayments(), staleTime: 15_000 });
  const billers = billerData?.billers ?? [];
  const value = biller?.amount && biller.amount > 0 ? biller.amount : Number(amount);
  const fixedAmount = Boolean(biller?.amount && biller.amount > 0);
  const valid = Boolean(biller) && customer.trim().length >= 4 && Number.isFinite(value) && value >= 50 && value <= 5000000;

  function reset() {
    setSelected(null); setBiller(null); setCustomer(""); setCustomerName(null); setAmount(""); setConfirming(false); setReference(null); setFinalStatus(null);
  }

  async function validateCustomer() {
    if (!biller || customer.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      const r = await validateBillCustomerFn({ data: { billerCode: biller.billerCode, itemCode: biller.itemCode, customer: customer.trim() } });
      if (r.valid) { setCustomerName(r.customerName); if (r.customerName) toast.success(`Confirmed: ${r.customerName}`); else toast.success("Customer confirmed by the biller."); }
      else toast.error(r.error ?? "We couldn't confirm this customer.");
    } catch { toast.error("We couldn't confirm this customer. Please try again."); }
    finally { setBusy(false); }
  }

  async function pay() {
    if (!biller || !category || !valid || busy) return;
    setBusy(true);
    try {
      const r = await payBillFn({ data: { category, billerCode: biller.billerCode, billerName: biller.shortName ?? biller.name, itemCode: biller.itemCode, customer: customer.trim(), amount: value, idempotencyKey: crypto.randomUUID() } });
      if (!r.ok) { toast.error(r.error); setConfirming(false); return; }
      setReference(r.reference);
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["bill-payments"] });
      toast.success("Payment started. We'll confirm when the biller completes it.");
    } catch { toast.error("Payment could not be started. No money was moved."); setConfirming(false); }
    finally { setBusy(false); }
  }

  async function refresh() {
    if (!reference || busy) return;
    setBusy(true);
    try {
      const r = await checkBillPayment({ data: { reference } });
      setFinalStatus(r.status);
      if (r.status !== "pending") {
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        await queryClient.invalidateQueries({ queryKey: ["bill-payments"] });
      }
    } catch { toast.error("Status check failed. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-6" aria-labelledby="bill-payment-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bill-payment-heading" className="font-display text-xl font-semibold">Pay bills</h2>
        <span className="text-xs text-muted-foreground">Paid from your NGN wallet · No Fin3a fee</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PAYMENT_CATEGORIES.map((category) => (
          <Button key={category.id} variant="outline" className="h-auto min-w-0 flex-col gap-3 whitespace-normal bg-card px-3 py-5" onClick={() => setSelected(category)} aria-label={`Select ${category.name}`}>
            <category.icon className="text-primary" aria-hidden="true" />
            <span>{category.name}</span>
          </Button>
        ))}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !busy) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{selected?.name} payment</DialogTitle></DialogHeader>
          {reference ? (
            <div className="space-y-4" role="status">
              <p className="text-sm font-medium">{(finalStatus ?? "pending") === "successful" ? "Payment completed." : (finalStatus ?? "pending") === "failed" ? "The payment failed. Your wallet was not charged." : "Payment in progress. Most bill payments complete within minutes."}</p>
              {(finalStatus ?? "pending") === "pending" ? (
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => void refresh()}>{busy ? "Checking…" : "Check status"}</Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={reset}>Done</Button>
              )}
            </div>
          ) : confirming && biller ? (
            <div className="space-y-4">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted-foreground">Biller</dt><dd className="break-words">{biller.name}</dd></div>
                <div><dt className="text-muted-foreground">Customer</dt><dd className="break-words">{customerName ? `${customerName} · ` : ""}{customer}</dd></div>
                <div><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">{ngn(value)}</dd></div>
                <div><dt className="text-muted-foreground">Fin3a fee</dt><dd>{ngn(0)}</dd></div>
              </dl>
              <Button className="w-full" disabled={busy} onClick={() => void pay()}>{busy ? "Paying…" : "Confirm payment"}</Button>
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {billersLoading && <p className="text-sm text-muted-foreground">Loading providers…</p>}
              {billerData?.error && <p role="alert" className="text-sm text-destructive">{billerData.error}</p>}
              <div>
                <Label htmlFor="bill-biller">Provider</Label>
                <Input id="bill-biller" list="bill-billers" value={biller?.name ?? ""} onChange={e => { const match = billers.find(b => b.name === e.target.value); setBiller(match ?? null); setCustomerName(null); if (match?.amount) setAmount(String(match.amount)); }} placeholder={billers.length ? "Search provider" : "Loading providers…"} />
                <datalist id="bill-billers">{billers.map(b => <option key={`${b.billerCode}:${b.itemCode}`} value={b.name} />)}</datalist>
              </div>
              <div>
                <Label htmlFor="bill-customer">{biller?.labelName ?? "Customer ID / phone / meter number"}</Label>
                <Input id="bill-customer" value={customer} onChange={e => { setCustomer(e.target.value.trim()); setCustomerName(null); }} maxLength={120} />
              </div>
              {biller && customer.trim().length >= 4 && !customerName && (
                <Button variant="outline" disabled={busy} onClick={() => void validateCustomer()}>{busy ? "Checking…" : "Confirm customer"}</Button>
              )}
              {customerName && <p role="status" className="break-words text-sm font-medium">{customerName}</p>}
              {!fixedAmount && (
                <div>
                  <Label htmlFor="bill-amount">Amount (₦)</Label>
                  <Input id="bill-amount" type="number" min="50" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
              )}
              {fixedAmount && biller && <p className="text-sm text-muted-foreground">Fixed package: {ngn(value)}</p>}
              <p className="text-xs text-muted-foreground">Paid from your NGN wallet. No Fin3a fee. Your balance is held only until the biller confirms.</p>
              <DialogFooter><Button className="w-full" disabled={busy || !valid} onClick={() => setConfirming(true)}>Review payment</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <section className="mt-8 border-t border-border pt-6" aria-labelledby="bill-history-heading">
        <h2 id="bill-history-heading" className="font-display text-xl font-semibold">Bills history</h2>
        {!history?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">No wallet bill payments yet. Recurring bill records below are not confirmed wallet payments.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {history.map(p => (
              <li key={p.reference} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate">{p.billerName} · {p.customer}</span>
                <span className="tabular-nums">{ngn(p.amount)}</span>
                <span className={`text-xs ${p.status === "successful" ? "text-primary" : p.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{p.status}</span>
              </li>
            ))}
          </ul>
        )}
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
      </div>

      <BillPaymentServices />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <div>
          <h2 className="font-display text-xl font-semibold">Recurring bills</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manual expense records only — recording a payment does not send money or debit your wallet.</p>
        </div>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-xl">All bills</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No recurring bills yet.
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
