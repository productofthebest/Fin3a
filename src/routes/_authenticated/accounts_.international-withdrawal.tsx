import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { internationalHistory } from "@/components/international-withdrawal-panel";
import { WithdrawalWorkspace } from "@/components/withdrawal-workspace";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { getWithdrawalAvailability } from "@/lib/ngn-withdrawal.functions";
import { RecordCurrencySelect } from "@/components/record-currency-select";
import { z } from "zod";
import { pageMeta } from "@/lib/page-meta";
const overview = queryOptions({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
const availability = queryOptions({ queryKey: ["withdrawal", "availability"], queryFn: () => getWithdrawalAvailability() });

export const Route = createFileRoute("/_authenticated/accounts_/international-withdrawal")({
  head: () => pageMeta("Withdraw", "Country-aware bank withdrawal details and withdrawal history. Payout routes remain locked until verified."),
  validateSearch: z.object({ currency: z.string().regex(/^[A-Z]{3}$/).optional() }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(overview), context.queryClient.ensureQueryData(availability), context.queryClient.ensureQueryData(internationalHistory)]); },
  component: Page,
});
function Page() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(overview);
  const { data: gate } = useSuspenseQuery(availability);
  const { data: history } = useSuspenseQuery(internationalHistory);
  const account = data.accounts.find(row => row.currency === search.currency) ?? data.accounts[0];
  const currency = account?.currency ?? "";
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"><Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link><Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button></header>
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:px-6"><Wallet className="mb-5 size-8 text-primary" /><h1 className="mb-6 font-display text-3xl font-semibold">Withdraw</h1>
      {data.country === "US" ? null : <div className="mb-5"><RecordCurrencySelect value={currency} currencies={data.accounts.map(row => row.currency)} onChange={value => navigate({ to: "/accounts/international-withdrawal", search: { currency: value } })} /></div>}
      <WithdrawalWorkspace key={`${data.country}:${currency}`} country={data.country} currency={currency} available={account?.balance.available ?? 0} ngnEnabled={gate.enabled} history={history} />
    </main>
  </div>;
}