import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssistantComposerSizeReference } from "@/components/assistant-composer-frame";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Copy, QrCode, AlertTriangle, Share2, Users } from "lucide-react";

const accountsQuery = () =>
  queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => pageMeta("Accounts", "Your Fin3a NGN and USD account balances, activity and crypto deposit addresses."),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery()),
  component: Page,
});

const fmt = (currency: string, amount: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

function Page() {
  const { data } = useSuspenseQuery(accountsQuery());
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapAmount, setSwapAmount] = useState("");
  const [swapCurrency, setSwapCurrency] = useState<"NGN" | "USD">("NGN");
  const splitRef = useRef<HTMLAnchorElement>(null);
  const walletsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reference = splitRef.current;
    const wallets = walletsRef.current;
    if (!reference || !wallets) return;
    const sync = () => wallets.style.setProperty("--wallet-reference-height", `${reference.getBoundingClientRect().height}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(reference);
    return () => observer.disconnect();
  }, []);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">Accounts</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your NGN and USD balances, activity and deposit addresses</p>

      <div className="mt-6 grid gap-4">
        {data.accounts.map((account) => (
          <div key={account.id} className="grid min-w-0">
          <div className="col-start-1 row-start-1"><AssistantComposerSizeReference /></div>
          <section className="col-start-1 row-start-1 min-w-0 rounded-[22px] border border-border bg-card px-4 py-4 shadow-sm sm:px-5" aria-label={`${account.currency} balance card`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">{account.currency} Account</h2>
              <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">{account.currency}</span>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
            <p className="break-all font-display text-xl font-bold">{fmt(account.currency, account.balance.available)}</p>
            <p className="text-[11px] text-muted-foreground">Available balance</p>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-3 text-[11px]">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-lg border border-border/70 px-2 py-1">
                <p className="text-muted-foreground">Pending Balance</p>
                <p className="break-all font-medium">{fmt(account.currency, account.balance.pending)}</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-lg border border-border/70 px-2 py-1">
                <p className="text-muted-foreground">Total Balance</p>
                <p className="break-all font-medium">{fmt(account.currency, account.balance.total)}</p>
              </div>
            </div>
            <div className="mt-1 text-[11px] leading-4">
              <p className="font-medium text-muted-foreground">Recent activity{account.recent.length === 0 ? ": No account transactions yet." : ""}</p>
              {account.recent.length === 0 ? (
                null
              ) : (
                <ul className="space-y-0.5">
                  {account.recent.map((tx) => (
                    <li key={tx.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="break-words capitalize text-muted-foreground">{tx.kind.replace("_", " ")} · {tx.status}</span>
                      <span className="min-w-0 break-all font-medium">{fmt(tx.currency, tx.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          to="/accounts/share"
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <Share2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="block font-display text-lg font-semibold">Share Payment</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Send money to several Fin3a users at once, split by percentage. Add people by ID or QR scan.
            </span>
          </span>
        </Link>
        <Link
          to="/accounts/split"
          ref={splitRef}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <Users className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="block font-display text-lg font-semibold">Split Bill</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Share an expense with other Fin3a users and collect their shares from their Fin3a balance.
            </span>
          </span>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => setSwapOpen(true)}><ArrowLeftRight className="size-4" />Swap</Button>
        {[
          { icon: ArrowDownToLine, label: "Deposit" },
          { icon: ArrowUpFromLine, label: "Withdraw" },
          { icon: ArrowLeftRight, label: "Transfer" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            disabled
            title="Available once the payment provider is connected"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground opacity-60"
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Swap</DialogTitle>
            <DialogDescription>Swaps are currently unavailable. A live quote is required before confirmation.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Swap direction">
            {(["NGN", "USD"] as const).map(currency => <Button key={currency} variant={swapCurrency === currency ? "default" : "outline"} aria-pressed={swapCurrency === currency} onClick={() => setSwapCurrency(currency)}>{currency} → {currency === "NGN" ? "USD" : "NGN"}</Button>)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="swap-amount">Amount ({swapCurrency})</Label>
            <Input id="swap-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={swapAmount} onChange={event => setSwapAmount(event.target.value)} />
          </div>
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Rate</dt><dd>Unavailable</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Fin3a fee</dt><dd>0.1%</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Fee amount</dt><dd>Awaiting quote</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Provider / network charges</dt><dd>Unavailable</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">You receive ({swapCurrency === "NGN" ? "USD" : "NGN"})</dt><dd>Awaiting quote</dd></div>
          </dl>
          <Button disabled>Confirm swap</Button>
        </DialogContent>
      </Dialog>
      {!data.providerConnected ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Deposits, withdrawals and external transfers are unavailable until provider integration and settlement verification are complete. Crypto deposits convert directly to your chosen NGN or USD balance; a conversion fee of 1% below USD 5,000 (0.5% at or above) is deducted and shown before you confirm.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Crypto Addresses</h2>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Always send funds through the exact network shown for each address. Sending through a different network can
            permanently lose your funds.
          </p>
        </div>
        <div ref={walletsRef} className="mt-4 grid items-start gap-4 sm:grid-cols-2">
          {data.cryptoAssets.map((asset) => (            <div key={asset.id} className="min-h-[var(--wallet-reference-height)] min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm" aria-label={`${asset.name} wallet card`}>
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

