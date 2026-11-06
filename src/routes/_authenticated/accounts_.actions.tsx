import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, ArrowLeft, Landmark, CreditCard, WalletCards, Smartphone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { accountCurrencies } from "@/lib/country-currency";
import { getCollectionCapability } from "@/lib/flutterwave-capabilities";
import { getDepositMethodEligibility, type DepositMethodId } from "@/lib/deposit-method-eligibility";
import { NgnTopupPanel } from "@/components/ngn-topup-panel";

const overview = queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
export const Route = createFileRoute("/_authenticated/accounts_/actions")({
  head: () => pageMeta("Deposits & withdrawals", "Your secure Fin3a local-currency deposit options."),
  validateSearch: (search: Record<string, unknown>): { action?: "deposit" | "withdraw" } => ({ action: search["action"] === "withdraw" ? "withdraw" : "deposit" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overview),
  component: Page,
});

const depositMethods: { id: DepositMethodId; label: string; description: string; Icon: typeof CreditCard }[] = [
  { id: "bank-transfer", label: "Bank Transfer", description: "Pay from your bank account", Icon: Landmark },
  { id: "debit-card", label: "Debit / Credit Card", description: "Pay with your card", Icon: CreditCard },
  { id: "apple-pay", label: "Apple Pay", description: "Pay securely with Apple Pay", Icon: WalletCards },
  { id: "google-pay", label: "Google Pay", description: "Pay securely with Google Pay", Icon: Smartphone },
];

function Page() {
  const { data } = useSuspenseQuery(overview);
  const options = [accountCurrencies(data.country)[0] ?? "NGN"];
  const [selectedCurrency] = useState<string>(options[0] ?? "NGN");
  const currency = options.includes(selectedCurrency) ? selectedCurrency : (options[0] ?? "NGN");
  const country = (data.country ?? "NG").toUpperCase();
  const collection = getCollectionCapability(country);
  const [selectedMethod, setSelectedMethod] = useState<DepositMethodId | null>(null);
  const selectedEligibility = selectedMethod ? getDepositMethodEligibility(selectedMethod, country, currency) : null;

  return <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button>
    </header>
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6">
      <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h1 className="font-display text-3xl font-semibold">Deposit</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose how you want to add {currency} to your {country} balance.</p>
      <dl className="my-6 divide-y divide-border text-sm">{data.accounts.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-2 py-3"><dt>{a.currency === "NGN" ? "₦" : a.currency === "USD" ? "$" : a.currency} available balance</dt><dd className="break-all font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: a.currency, currencyDisplay: "narrowSymbol" }).format(a.balance.available)}</dd></div>)}</dl>

      <section aria-label="Choose deposit method" className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Payment method</h2>
        <div className="grid grid-cols-2 gap-3">
          {depositMethods.map(({ id, label, description, Icon }) => {
            const active = selectedMethod === id;
            return <button
              key={id}
              type="button"
              aria-expanded={active}
              aria-controls={active ? "deposit-method-eligibility" : undefined}
              onClick={() => setSelectedMethod(active ? null : id)}
              className={`flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <span className="flex w-full items-center justify-between">
                <Icon className="size-5 text-primary" />
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${active ? "rotate-180" : ""}`} />
              </span>
              <span className="mt-3 block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
            </button>;
          })}
        </div>
      </section>

      {selectedMethod && selectedEligibility && <section id="deposit-method-eligibility" aria-live="polite" className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{depositMethods.find(method => method.id === selectedMethod)?.label}</h3>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">{selectedEligibility.usable ? "Available" : "Not enabled"}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{selectedEligibility.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">Country: {country} · Currency: {currency}. Merchant eligibility is checked separately from published country support.</p>
      </section>}

      {selectedMethod === "bank-transfer" && selectedEligibility?.usable && <div className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">NGN bank transfer</h2>
        <NgnTopupPanel />
      </div>}

      {!collection && <p className="mt-5 text-xs text-muted-foreground">Payment methods are not yet listed for this country. Select a method to see its eligibility details.</p>}
      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Payment options are checked against country coverage and Fin3a merchant eligibility. A displayed option does not mean the payment route is activated. Fin3a credits a wallet only after verified payment confirmation.</p>
    </main>
  </div>;
}
