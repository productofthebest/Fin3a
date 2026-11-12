import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { FLUTTERWAVE_FX_MINIMUM_USD_EQUIVALENT, supportsFlutterwaveFxPair } from "@/lib/flutterwave-capabilities";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssistantComposerSizeReference } from "@/components/assistant-composer-frame";
import { AccountTransferDialog } from "@/components/account-transfer-dialog";
import { ArrowDownToLine, ArrowLeftRight, Copy, QrCode, Share2, Users, Globe, Eye, EyeOff, Clock3, Layers3 } from "lucide-react";

const accountsQuery = () =>
  queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => pageMeta("Wallet", "Your Fin3a local-currency and USD wallet balances, activity and crypto deposit addresses."),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery()),
  component: Page,
});

const fmt = (currency: string, amount: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(amount);
const sym = (currency: string) => (currency === "NGN" ? "₦" : currency === "USD" ? "$" : (new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find(p => p.type === "currency")?.value ?? currency));

function Page() {
  const { data } = useSuspenseQuery(accountsQuery());
  const swapLocal = data.accounts.find(a => a.currency !== "USD")?.currency ?? null;
  const availableSwapPairs = swapLocal
    ? [{ from: swapLocal, to: "USD" }, { from: "USD", to: swapLocal }].filter(pair => supportsFlutterwaveFxPair(pair.from, pair.to))
    : [];
  const [hiddenBalances, setHiddenBalances] = useState<Record<string, boolean>>({});
  const [swapOpen, setSwapOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [swapAmount, setSwapAmount] = useState("");
  const [swapCurrency, setSwapCurrency] = useState<string>("local");
  const requestedSwapFrom = swapCurrency === "USD" ? "USD" : (swapLocal ?? "USD");
  const selectedSwapPair = availableSwapPairs.find(pair => pair.from === requestedSwapFrom) ?? availableSwapPairs[0] ?? null;
  const swapFrom = selectedSwapPair?.from ?? (swapLocal ?? "USD");
  const swapTo = selectedSwapPair?.to ?? "USD";
  return (
    <AppShell>
      <h1 className="-mt-4 font-display text-3xl font-bold">Wallet</h1>
      <div className="mt-2 grid gap-2 sm:mt-3 sm:gap-3">
        {data.accounts.map((account) => {
          const balanceHidden = Boolean(hiddenBalances[account.id]);
          const masked = "••••••";
          return (
            <div key={account.id} className="grid min-w-0">
              <div className="col-start-1 row-start-1"><AssistantComposerSizeReference /></div>
              <section
                className="relative isolate col-start-1 row-start-1 min-w-0 overflow-hidden rounded-[18px] border border-violet-100 bg-white px-3 py-2.5 text-slate-950 shadow-[0_6px_18px_rgba(91,48,150,0.08)] sm:rounded-[22px] sm:px-5 sm:py-3"
                aria-label={`${account.currency} balance card`}
              >
                <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-14 h-32 w-64 rounded-full bg-gradient-to-l from-violet-200/75 via-violet-100/45 to-transparent blur-2xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 h-28 w-72 -rotate-12 rounded-[100%] border-t border-violet-100 bg-gradient-to-l from-violet-100/75 via-violet-50/45 to-transparent" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-semibold tracking-tight">{account.currency} Wallet</h2>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 sm:size-8">
                      {sym(account.currency)}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:mt-2">
                    <p className="break-all font-display text-xl font-bold tracking-tight sm:text-2xl">
                      {balanceHidden ? masked : fmt(account.currency, account.balance.available)}
                    </p>
                    <button
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      aria-label={balanceHidden ? "Show balance" : "Hide balance"}
                      aria-pressed={balanceHidden}
                      onClick={() => setHiddenBalances(current => ({ ...current, [account.id]: !current[account.id] }))}
                    >
                      {balanceHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <p className="text-xs text-slate-500">Available balance</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-violet-100 pt-2 sm:mt-3 sm:gap-2 sm:pt-3">
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-700 sm:size-8">
                        <Clock3 className="size-3 sm:size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] leading-3 text-slate-500 sm:text-xs">Pending Balance</p>
                        <p className="break-all text-xs font-semibold text-slate-950 sm:text-sm">
                          {balanceHidden ? masked : fmt(account.currency, account.balance.pending)}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 border-l border-violet-100 pl-2 sm:gap-2.5 sm:pl-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-700 sm:size-8">
                        <Layers3 className="size-3 sm:size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] leading-3 text-slate-500 sm:text-xs">Total Balance</p>
                        <p className="break-all text-xs font-semibold text-slate-950 sm:text-sm">
                          {balanceHidden ? masked : fmt(account.currency, account.balance.total)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
        <Link
          to="/accounts/share"
          className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary/50 sm:items-start sm:gap-3 sm:rounded-xl sm:p-3"
        >
          <Share2 className="size-4 shrink-0 text-primary" />
          <span>
            <span className="block font-display text-xs font-semibold leading-4 sm:text-base">Share Payment</span>
            <span className="mt-0.5 hidden text-xs leading-5 text-muted-foreground sm:block">
              Send money to several Fin3a users at once, split by percentage. Add people by ID or QR scan.
            </span>
          </span>
        </Link>
        <Link
          to="/accounts/split"
          className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary/50 sm:items-start sm:gap-3 sm:rounded-xl sm:p-3"
        >
          <Users className="size-4 shrink-0 text-primary" />
          <span>
            <span className="block font-display text-xs font-semibold leading-4 sm:text-base">Split Bill</span>
            <span className="mt-0.5 hidden text-xs leading-5 text-muted-foreground sm:block">
              Share an expense with other Fin3a users and collect their shares from their Fin3a balance.
            </span>
          </span>
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
        <Button className="h-9 w-full justify-center px-2 text-xs sm:w-auto sm:px-4 sm:text-sm" onClick={() => setSwapOpen(true)}><ArrowLeftRight className="size-4" />Swap</Button>
        <Button className="h-9 w-full justify-center px-2 text-xs sm:w-auto sm:px-4 sm:text-sm" asChild variant="outline"><Link to="/accounts/actions" search={{ action: "deposit" }}><ArrowDownToLine className="size-4" />Deposit</Link></Button>
        <Button className="h-9 w-full justify-center px-2 text-xs sm:w-auto sm:px-4 sm:text-sm" asChild variant="outline"><Link to="/accounts/international-withdrawal"><Globe className="size-4" />Withdraw</Link></Button>
                <Button className="h-9 w-full justify-center px-2 text-xs sm:w-auto sm:px-4 sm:text-sm" variant="outline" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="size-4" />Transfer</Button>
      </div>
      <AccountTransferDialog open={transferOpen} onOpenChange={setTransferOpen} balances={data.accounts} country={data.country ?? "NG"} />
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Swap</DialogTitle>
            <DialogDescription>Swaps are currently unavailable. A live quote is required before confirmation.</DialogDescription>
          </DialogHeader>
          {availableSwapPairs.length ? <div className="grid grid-cols-2 gap-2" role="group" aria-label="Supported swap directions">
            {availableSwapPairs.map(pair => <Button key={`${pair.from}-${pair.to}`} variant={swapFrom === pair.from ? "default" : "outline"} aria-pressed={swapFrom === pair.from} onClick={() => setSwapCurrency(pair.from === "USD" ? "USD" : "local")}>{sym(pair.from)} → {sym(pair.to)}</Button>)}
          </div> : null}
          {availableSwapPairs.length
            ? <p role="status" className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">Flutterwave currently documents this FX direction, with a minimum trade of {fmt("USD", FLUTTERWAVE_FX_MINIMUM_USD_EQUIVALENT)} equivalent. Fin3a execution remains disabled until merchant FX activation, live quotes and settlement checks are completed.</p>
            : <p role="status" className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">{swapLocal ? `No supported Flutterwave FX direction is currently available for ${swapLocal} ↔ USD.` : "No supported local-currency FX direction is currently available for this country."}</p>}
          <div className="space-y-2">
            <Label htmlFor="swap-amount">Amount ({sym(swapFrom)})</Label>
            <Input id="swap-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={swapAmount} onChange={event => setSwapAmount(event.target.value)} />
          </div>
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Rate</dt><dd>Unavailable</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Fin3a fee</dt><dd>0.1%</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Fee amount</dt><dd>Awaiting quote</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Provider / network charges</dt><dd>Unavailable</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">You receive ({sym(swapTo)})</dt><dd>Awaiting quote</dd></div>
          </dl>
          <Button disabled>{availableSwapPairs.length ? "Swap unavailable until FX is enabled" : "Swap unavailable"}</Button>
        </DialogContent>
      </Dialog>
      {!data.providerConnected ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Local-currency deposits and external bank transfers appear when the relevant country and merchant payment routes are enabled. Use Transfer for Fin3a-user payments and supported bank payouts. Crypto receiving addresses are separate below.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Crypto Addresses</h2>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
          {data.cryptoAssets.map((asset) => (            <div key={asset.id} className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm" aria-label={`${asset.name} wallet card`}>
              <div className="flex min-w-0 flex-col gap-0.5 text-[11px] leading-[14px]">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-medium">{asset.name}</p>
                  <p className="break-words text-muted-foreground">
                    {asset.symbol} · {asset.network}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium">{asset.symbol}</span>
              </div>
              {asset.address ? (
                <div>
                  <p className="break-all rounded-md bg-secondary px-2 py-1 font-mono text-[11px]">{asset.address.address}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
                      <Copy className="size-3" /> Copy
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
                      <QrCode className="size-3" /> QR code
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-md bg-secondary px-2 py-0.5 text-muted-foreground">
                  Provider not connected. Address not available yet.
                </p>
              )}
              {asset.min_deposit != null ? (
                <p className="text-muted-foreground">
                  Minimum deposit: {asset.min_deposit} {asset.symbol}
                </p>
              ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

