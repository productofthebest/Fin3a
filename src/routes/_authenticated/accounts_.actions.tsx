import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, ArrowLeft, Landmark, CreditCard, WalletCards, Smartphone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { accountCurrencies } from "@/lib/country-currency";
import { getCollectionCapability } from "@/lib/flutterwave-capabilities";
import { getDepositMethodEligibility } from "@/lib/deposit-method-eligibility";
import { NgnTopupPanel } from "@/components/ngn-topup-panel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const overview = queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
export const Route = createFileRoute("/_authenticated/accounts_/actions")({
  head: () => pageMeta("Deposits & withdrawals", "Your secure Fin3a local-currency and USD deposit and withdrawal options."),
  validateSearch: (search: Record<string, unknown>): { action?: "deposit" | "withdraw" } => ({ action: search["action"] === "withdraw" ? "withdraw" : "deposit" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overview),
  component: Page,
});

const methodLabel: Record<string, string> = {
  card: "Debit / credit card",
  ussd: "USSD",
  banktransfer: "Bank transfer",
  account: "Pay by bank account",
  internetbanking: "Internet banking",
  nqr: "NQR",
  enaira: "eNaira",
  opay: "OPay",
  ghanamobilemoney: "Ghana mobile money",
  mobilemoneyxaf: "Francophone mobile money",
  mobilemoneyxof: "Francophone mobile money",
  "1voucher": "1Voucher",
  mobilemoneymalawi: "Malawi mobile money",
  mpesa: "M-Pesa",
  mobilemoneyuganda: "Uganda mobile money",
  mobilemoneyrwanda: "Rwanda mobile money",
  mobilemoneytanzania: "Tanzania mobile money",
  fawrypay: "FawryPay",
  mobilemoneyzambia: "Zambia mobile money",
};

function Page() {
  const { data } = useSuspenseQuery(overview);
  const options = [accountCurrencies(data.country)[0] ?? "NGN"];
  const [selectedCurrency, setCurrency] = useState<string>(options[0] ?? "NGN");
  const currency = options.includes(selectedCurrency) ? selectedCurrency : (options[0] ?? "NGN");
  const country = (data.country ?? "NG").toUpperCase();
  const collection = getCollectionCapability(country);
  const collectionMethods: readonly string[] = collection?.methods ?? [];
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const hiddenNgnDepositMethods = new Set(["account", "internetbanking", "nqr", "opay", "ussd"]);
  const visibleCollectionMethods = country === "NG"
    ? collectionMethods.filter(method => !hiddenNgnDepositMethods.has(method))
    : collectionMethods;
  const paymentCards = [
    ...visibleCollectionMethods.map(method => ({ id: method, label: methodLabel[method] ?? method, description: method === "card" ? "Pay with your debit or credit card" : method === "banktransfer" ? "Pay directly from your bank" : "Pay using " + (methodLabel[method] ?? method), Icon: method === "banktransfer" || method === "account" || method === "internetbanking" ? Landmark : method === "card" ? CreditCard : Smartphone })),
    ...(collection?.applePay ? [{ id: "apple-pay", label: "Apple Pay", description: "Pay securely with Apple Pay", Icon: WalletCards }] : []),
    { id: "google-pay", label: "Google Pay", description: "Availability checked at merchant checkout", Icon: WalletCards },
  ];
  const selectedCard = paymentCards.find(method => method.id === selectedMethod);
  const selectedEligibility = selectedMethod === "banktransfer" ? getDepositMethodEligibility("bank-transfer", country, currency)
    : selectedMethod === "card" ? getDepositMethodEligibility("debit-card", country, currency)
    : selectedMethod === "apple-pay" ? getDepositMethodEligibility("apple-pay", country, currency)
    : selectedMethod === "google-pay" ? getDepositMethodEligibility("google-pay", country, currency)
    : selectedMethod && collectionMethods.includes(selectedMethod)
      ? { usable: false, message: (selectedCard?.label ?? selectedMethod) + " is listed for this country, but Fin3a has not confirmed an active merchant route and verified payment flow for this method yet. It is not enabled until that confirmation is available." }
      : null;
  const unsupported = currency !== "NGN" && currency !== "USD";

  return <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button>
    </header>
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6">
      <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h1 className="font-display text-3xl font-semibold">Deposit</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose how you want to add {currency} to your {country} balance.</p>
      <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Balance currency">{options.map(v => <Button key={v} variant={currency === v ? "default" : "outline"} aria-pressed={currency === v} onClick={() => setCurrency(v)}>{v} {v === "NGN" ? "₦" : v === "USD" ? "$" : ""}</Button>)}</div>

      <section aria-label="Choose deposit method" className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Payment method</h2>
        <div className="grid grid-cols-2 gap-3">
          {paymentCards.map(({ id, label, description, Icon }) => {
            const active = selectedMethod === id;
            return <button key={id} type="button" aria-expanded={active}
              onClick={() => setSelectedMethod(id)}
              className={"flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (active ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <span className="flex w-full items-center justify-between"><Icon className="size-5 text-primary" /><ChevronDown className={"size-4 text-muted-foreground transition-transform " + (active ? "rotate-180" : "")} /></span>
              <span className="mt-3 block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
            </button>;
          })}
        </div>
        {paymentCards.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No deposit methods are currently available for this country.</p>}
      </section>

      <Dialog open={Boolean(selectedMethod)} onOpenChange={open => { if (!open) setSelectedMethod(null); }}>
        {selectedMethod && <DialogContent className="max-h-[85vh] overflow-y-auto" onOpenAutoFocus={event => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{selectedCard?.label ?? selectedMethod}</DialogTitle>
            <DialogDescription>{selectedCard?.description ?? "Review this deposit payment method."}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Availability</span><span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">{selectedEligibility?.usable ? "Available" : "Not enabled"}</span></div>
          <p className="text-sm text-muted-foreground">{selectedEligibility?.message}</p>
          <p className="text-xs text-muted-foreground">Country: {country} · Currency: {currency}. This payment method is not enabled until Fin3a confirms that it can accept and verify the payment.</p>
          {country === "NG" && currency === "NGN" && selectedMethod === "banktransfer" && selectedEligibility?.usable && <section className="space-y-3 border-t border-border pt-4" aria-label="NGN bank transfer top-up"><h2 className="font-display text-lg font-semibold">NGN bank transfer</h2><NgnTopupPanel /></section>}
        </DialogContent>}
      </Dialog>

      {unsupported ? <div role="status" className="mt-6 space-y-3 text-sm text-muted-foreground"><p>{currency} local-currency deposits are not yet enabled in Fin3a. This payment route is not active for this currency yet.</p><p>Your balance remains available in your wallet; no funds will move through an unverified route.</p></div> : currency !== "NGN" ? <div role="status" className="mt-6 space-y-3 text-sm text-muted-foreground"><p>Local-currency deposits for this country are not active yet. No funds will move until the merchant route, settlement currency and verified callback are enabled.</p></div> : null}
      {currency !== "NGN" && <Button className="mt-5 w-full" disabled>Local deposit unavailable</Button>}
      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Fin3a only credits your wallet after the payment has been securely verified.</p>
    </main>
  </div>;
}
