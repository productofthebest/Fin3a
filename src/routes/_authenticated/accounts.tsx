import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { pageMeta } from "@/lib/page-meta";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, History, Copy, QrCode, AlertTriangle, Share2, Users } from "lucide-react";

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

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">Accounts</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your NGN and USD balances, activity and deposit addresses</p>

      <div className="mt-6 grid gap-4">
        {data.accounts.map((account) => (
          <section key={account.id} className="min-w-0 rounded-[22px] border border-border bg-card px-4 py-4 shadow-sm sm:px-5" aria-label={`${account.currency} balance card`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{account.currency} Account</h2>
              <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">{account.currency}</span>
            </div>
            <p className="mt-3 break-all font-display text-3xl font-bold">{fmt(account.currency, account.balance.available)}</p>
            <p className="text-xs text-muted-foreground">Available balance</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-lg border border-border/70 px-3 py-1">
                <p className="text-xs text-muted-foreground">Pending Balance</p>
                <p className="break-all font-medium">{fmt(account.currency, account.balance.pending)}</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-lg border border-border/70 px-3 py-1">
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p className="break-all font-medium">{fmt(account.currency, account.balance.total)}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
              {account.recent.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No account transactions yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {account.recent.map((tx) => (
                    <li key={tx.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="break-words capitalize text-muted-foreground">{tx.kind.replace("_", " ")} · {tx.status}</span>
                      <span className="min-w-0 break-all font-medium">{fmt(tx.currency, tx.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          to="/accounts/share"
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <Share2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="block font-display text-lg font-semibold">Share Account</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Share your Fin3a account ID, payment link or QR code so other Fin3a users can pay you.
            </span>
          </span>
        </Link>
        <Link
          to="/accounts/split"
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
        <Link
          to="/activity"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-secondary"
        >
          <History className="size-4" /> View transaction history
        </Link>
      </div>
      {!data.providerConnected ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Deposits, withdrawals and transfers switch on automatically once the payment provider is connected.
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
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
          {data.cryptoAssets.map((asset) => (
            <div key={asset.id} className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm" aria-label={`${asset.name} wallet card`}>
              <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{asset.name}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {asset.symbol} · {asset.network}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium">{asset.symbol}</span>
              </div>
              {asset.address ? (
                <div>
                  <p className="break-all rounded-md bg-secondary p-2 font-mono text-xs">{asset.address.address}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
                      <Copy className="size-3" /> Copy
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
                      <QrCode className="size-3" /> QR code
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-md bg-secondary p-2 text-xs text-muted-foreground">
                  Deposit address not available yet — the crypto provider is not connected. No address is shown until a
                  real one is generated for your account.
                </p>
              )}
              {asset.min_deposit != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
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
