import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { accountCurrencies } from "@/lib/country-currency";

const overview = queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
export const Route = createFileRoute("/_authenticated/accounts_/actions")({
  head: () => pageMeta("Deposits & withdrawals", "Your secure Fin3a NGN and USD deposit and withdrawal options."),
  validateSearch: (search: Record<string, unknown>): { action?: "deposit" | "withdraw" } => ({ action: search["action"] === "withdraw" ? "withdraw" : "deposit" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overview),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(overview);
  const { action = "deposit" } = Route.useSearch();
  const mode = action;
  const options = accountCurrencies(data.country);
  const [currency, setCurrency] = useState<string>(options[0] ?? "USD");
  const unsupported = currency !== "NGN" && currency !== "USD";
  const [asset, setAsset] = useState<"USDC" | "USDT">("USDC");
  return <div className="flex min-h-screen flex-col bg-background">
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link>
      <Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Accounts</Link></Button>
    </header>
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6">
      <div className="mb-7 flex size-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div>
      <h1 className="font-display text-3xl font-semibold">{mode === "deposit" ? "Deposit" : "Withdrawal"}</h1>
      <dl className="my-6 divide-y divide-border text-sm">{data.accounts.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-2 py-3"><dt>{a.currency === "NGN" ? "₦" : a.currency === "USD" ? "$" : a.currency} available balance</dt><dd className="break-all font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: a.currency, currencyDisplay: "narrowSymbol" }).format(a.balance.available)}</dd></div>)}</dl>
      <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Balance currency">{options.map(v => <Button key={v} variant={currency === v ? "default" : "outline"} aria-pressed={currency === v} onClick={() => setCurrency(v)}>{v} {v === "NGN" ? "₦" : v === "USD" ? "$" : ""}</Button>)}</div>
      <h2 className="mb-3 font-display text-xl font-semibold">{unsupported ? `${currency} ${mode === "deposit" ? "bank top-up" : "bank withdrawal"}` : mode === "deposit" ? currency === "NGN" ? "NGN top-up" : "Crypto deposit" : currency === "NGN" ? "Bank withdrawal" : "USD withdrawal"}</h2>
      {mode === "withdraw" && currency === "USD" && <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Withdrawal stablecoin">{(["USDC", "USDT"] as const).map(v => <Button key={v} variant={asset === v ? "default" : "outline"} aria-pressed={asset === v} onClick={() => setAsset(v)}>{v}</Button>)}</div>}
      {unsupported ? <div role="status" className="space-y-3 text-sm text-muted-foreground"><p>{mode === "deposit" ? `${currency} bank top-ups are not supported in your country yet.` : `${currency} bank withdrawals are not supported in your country yet.`}</p><p>Use your USD account instead.</p></div> : <div role="status" className="space-y-3 text-sm text-muted-foreground">
        <p>{mode === "deposit" ? currency === "NGN" ? "Bank transfer instructions are not available yet. No bank account number has been issued." : "Crypto deposits convert directly to the receiving balance selected for that individual deposit. Coins, networks, rates and receiving currencies must be confirmed by the payment provider." : currency === "NGN" ? "Bank withdrawals are not available yet. Bank details will be entered here, not in AI chat, once payments are verified." : `${asset} withdrawals are not available yet. Network support, the rate and all charges must be verified before you confirm.`}</p>
        <p>{currency === "NGN" ? mode === "deposit" ? "NGN bank top-up fee: ₦50, deducted from the credited amount." : "NGN bank withdrawal fee: ₦50, deducted from the payout." : mode === "deposit" ? "Crypto conversion fee: 1% below $5,000; 0.5% at or above $5,000, for all supported crypto." : "USD withdrawal fee: 1% below $5,000; 0.5% at or above $5,000."}</p>
        <p>Rate and third-party / network charges: unavailable. No funds will move without a verified quote and confirmation.</p>
      </div>}
      <Button className="mt-5 w-full" disabled>{mode === "deposit" ? "Deposit unavailable" : "Withdrawal unavailable"}</Button>
    </main>
  </div>;
}
