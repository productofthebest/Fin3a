import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InternationalWithdrawalPanel, internationalHistory, internationalOptions } from "@/components/international-withdrawal-panel";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/accounts_/international-withdrawal")({
  head: () => pageMeta("International withdrawals", "Review Fin3a international bank and mobile-money withdrawal availability. Payouts remain locked until verified."),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(internationalOptions), context.queryClient.ensureQueryData(internationalHistory)]); },
  component: Page,
});
function Page() {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"><Link to="/accounts" className="font-display text-xl font-semibold">Fin<span className="text-primary">3a</span></Link><Button asChild variant="ghost" size="sm"><Link to="/accounts"><ArrowLeft className="size-4" />Wallet</Link></Button></header>
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:px-6"><Globe className="mb-5 size-8 text-primary" /><h1 className="mb-6 font-display text-3xl font-semibold">International withdrawal</h1><InternationalWithdrawalPanel /></main>
  </div>;
}