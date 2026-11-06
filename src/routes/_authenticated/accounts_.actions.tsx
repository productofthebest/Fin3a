import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, ArrowLeft, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { accountCurrencies } from "@/lib/country-currency";
import { getBankPayoutCapability, getCollectionCapability, googlePayAvailability, supportsApplePay } from "@/lib/flutterwave-capabilities";
import { NgnTopupPanel } from "@/components/ngn-topup-panel";

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
  const mode = "deposit" as const;
  const options = [accountCurrencies(data.country)[0] ?? "NGN"];
  const [selectedCurrency, setCurrency] = useState<string>(options[0] ?? "USD");
  const currency = options.includes(selectedCurrency) ? selectedCurrency : (options[0] ?? "USD");
  const unsupported = currency !== "NGN" && currency !== "USD";
  const country = (data.country ?? "NG").toUpperCase();
  const collection = getCollectionCapability(country);
  const payout = getBankPayoutCapability(country);
  const collectionMethods = collection?.methods ?? [];
  return <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button>
    </header>
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6">
      <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h1 className="font-display text-3xl font-semibold">Deposit</h1>
      <dl className="my-6 divide-y divide-border text-sm">{data.accounts.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-2 py-3"><dt>{a.currency === "NGN" ? "₦" : a.currency === "USD" ? "$" : a.currency} available balance</dt><dd className="break-all font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: a.currency, currencyDisplay: "narrowSymbol" }).format(a.balance.available)}</dd></div>)}</dl>
      <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Balance currency">{options.map(v => <Button key={v} variant={currency === v ? "default" : "outline"} aria-pressed={currency === v} onClick={() => setCurrency(v)}>{v} {v === "NGN" ? "₦" : v === "USD" ? "$" : ""}</Button>)}</div>

      <section className="mb-6 rounded-xl border border-border bg-card p-4" aria-label="Flutterwave country payment methods">
        <div className="mb-2 flex items-center gap-2 font-medium"><CreditCard className="size-4" />Payment methods for {country}</div>
        {mode === "deposit" ? collection ? <>
          <p className="mb-2 text-xs text-muted-foreground">Flutterwave documents these collection methods for {collection.name} ({collection.currency}):</p>
          <div className="flex flex-wrap gap-2">{collectionMethods.map(method => <span key={method} className="rounded-full border border-border px-2.5 py-1 text-xs">{methodLabel[method] ?? method}</span>)}</div>
          {supportsApplePay(country) && <p className="mt-3 flex items-center gap-2 text-xs">Apple Pay is listed for this region, subject to merchant enablement.</p>}
          <p className="mt-2 flex items-center gap-2 text-xs"><Smartphone className="size-4" />Google Pay: {googlePayAvailability() === "merchant-checkout-only" ? "not a country-specific V3 payment_options method; it may appear only if enabled for the Fin3a merchant checkout." : "availability varies."}</p>
        </> : <p className="text-xs text-muted-foreground">No country-specific Flutterwave collection methods are listed for this country.</p> : payout ? <p className="text-xs text-muted-foreground">Flutterwave documents bank payouts in {payout.name} using {payout.currency}. Bank codes, account verification, merchant approval and live payout readiness must still be checked.</p> : <p className="text-xs text-muted-foreground">No bank-account payout for this country is listed in the current Flutterwave bank-transfer coverage table.</p>}
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Provider coverage is not the same as Fin3a activation. A method is usable only after the Top Floor merchant account is approved and the country, currency, limits and payout route are verified. No option shown here moves money by itself.</p>
      </section>

      <h2 className="mb-3 font-display text-xl font-semibold">{currency === "NGN" ? "NGN top-up" : `${currency} local-currency deposit`}</h2>
            {currency === "NGN" ? <NgnTopupPanel /> : unsupported ? <div role="status" className="space-y-3 text-sm text-muted-foreground"><p>{currency} local-currency deposits are not yet enabled in Fin3a. Flutterwave coverage alone does not activate a payment route.</p><p>Your balance remains available in your wallet; no funds will move through an unverified route.</p></div> : <div role="status" className="space-y-3 text-sm text-muted-foreground"><p>Local-currency deposits for this country are not active yet. No funds will move until the merchant route, settlement currency and verified callback are enabled.</p></div>}
      {currency !== "NGN" && <Button className="mt-5 w-full" disabled>Local deposit unavailable</Button>}
    </main>
  </div>;
}
