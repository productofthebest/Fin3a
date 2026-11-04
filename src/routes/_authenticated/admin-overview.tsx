import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, ShieldAlert, ArrowUpRight } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getAdminQrOverview, getAdminSplitOverview, getAiOverview, getIsAdmin } from "@/lib/admin.functions";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/admin-overview")({
  head: () => pageMeta("Admin overview", "Fin3a user administration, revenue, sharing and QR payment monitoring."),
  ssr: false,
  component: AdminOverview,
});

function AdminOverview() {
  const access = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => getIsAdmin() });
  const overview = useQuery({ queryKey: ["admin", "ai-overview"], queryFn: () => getAiOverview(), enabled: access.data === true });
  const split = useQuery({ queryKey: ["admin", "split-overview"], queryFn: () => getAdminSplitOverview(), enabled: access.data === true });
  const qr = useQuery({ queryKey: ["admin", "qr-overview"], queryFn: () => getAdminQrOverview(), enabled: access.data === true });
  if (access.isPending) return <AppShell><Loader2 className="mx-auto mt-16 size-6 animate-spin" aria-label="Checking administrator access" /></AppShell>;
  if (access.data !== true) return <AppShell><div className="mx-auto mt-16 max-w-md text-center"><ShieldAlert className="mx-auto size-8 text-muted-foreground" /><h1 className="mt-3 text-2xl font-semibold">Administrators only</h1><p className="mt-2 text-sm text-muted-foreground">This page is not available for your account.</p></div></AppShell>;
  const data = overview.data;
  return (
    <AdminShell section="overview">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm text-primary">Administration</p><h1 className="mt-1 text-3xl font-bold">Overview</h1><p className="mt-2 text-sm text-muted-foreground">Account operations · reporting periods in UTC</p></div>
        <Button variant="outline" size="icon" aria-label="Refresh overview" title="Refresh overview" disabled={split.isFetching || qr.isFetching} onClick={() => { void split.refetch(); void qr.refetch(); }}><RefreshCw className={split.isFetching || qr.isFetching ? "animate-spin" : ""} /></Button>
      </header>
      {overview.isError ? <p role="alert" className="mt-6 text-destructive">Could not load administration figures. Try refreshing.</p> : !data ? <Loader2 className="mt-8 size-6 animate-spin" aria-label="Loading overview" /> : <>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="AI requests today" value={data.today.requests.toLocaleString()} note={`${data.today.failed.toLocaleString()} failed`} />
          <Metric label="AI requests this month" value={data.month.requests.toLocaleString()} note="Account AI usage" />
          <Metric label="Estimated AI spend this month" value={data.month.est_cost_usd == null ? "Unavailable" : `$${data.month.est_cost_usd.toFixed(4)}`} note={`${data.month.unpriced.toLocaleString()} unpriced requests · USD`} />
          <Metric label="Account AI service" value={data.settings?.ai_enabled ? "Enabled" : "Paused"} note="Current recorded configuration" />
        </div>
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">AI activity by feature</h2><Button asChild variant="link"><Link to="/admin">AI usage and controls <ArrowUpRight /></Link></Button></div>
          <div className="mt-4 overflow-x-auto border-y border-border">
            <table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["Feature", "Requests", "Failed", "Estimated cost (USD)"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.by_feature.map(row => <tr key={row.feature}><td className="px-4 py-4">{row.feature}</td><td className="px-4 py-4 tabular-nums">{row.requests.toLocaleString()}</td><td className="px-4 py-4 tabular-nums">{row.failed.toLocaleString()}</td><td className="px-4 py-4 tabular-nums">{row.est_cost_usd == null ? "Unavailable" : `$${row.est_cost_usd.toFixed(4)}`}</td></tr>)}{data.by_feature.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-muted-foreground">No account AI usage recorded this month.</td></tr>}</tbody></table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Guest usage and web-search fees are not certified as included in this account AI report. Estimates are not provider invoices.</p>
        </section>
      </>}
      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">Sharing and split bills</h2>
        {split.isError ? <p role="alert" className="mt-4 text-destructive">Could not load sharing figures.</p> : !split.data ? <Loader2 className="mt-4 size-5 animate-spin" aria-label="Loading sharing figures" /> : <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Split bills created" value={split.data.bills_created.toLocaleString()} note={`${split.data.bills_open.toLocaleString()} still open`} />
            <Metric label="Shares paid" value={split.data.participants_paid.toLocaleString()} note={`${split.data.participants_pending.toLocaleString()} pending`} />
            <Metric label="Internal transfers completed" value={split.data.transfers_completed.toLocaleString()} note={`${split.data.transfers_failed.toLocaleString()} failed`} />
            <Metric label="Suspicious activity" value={split.data.suspicious.length.toLocaleString()} note="Accounts with 3+ failed transfers in 24h" />
          </div>
          <dl className="mt-4 divide-y divide-border">
            <div className="grid gap-2 py-3 sm:grid-cols-2"><dt className="text-sm font-medium">Total requested</dt><dd className="text-sm text-muted-foreground">{split.data.requested.length ? split.data.requested.map((r) => `${r.currency} ${Number(r.total).toLocaleString()}`).join(" · ") : "None yet"}</dd></div>
            <div className="grid gap-2 py-3 sm:grid-cols-2"><dt className="text-sm font-medium">Total collected</dt><dd className="text-sm text-muted-foreground">{split.data.collected.length ? split.data.collected.map((r) => `${r.currency} ${Number(r.total).toLocaleString()}`).join(" · ") : "None yet"}</dd></div>
            {split.data.suspicious.length > 0 ? <div className="grid gap-2 py-3 sm:grid-cols-2"><dt className="text-sm font-medium">Accounts to review</dt><dd className="text-sm text-muted-foreground">{split.data.suspicious.map((s) => `…${s.user_id.slice(-8)} (${s.failed_count} failed)`).join(" · ")}</dd></div> : null}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Monitoring only — no passwords, balances or private credentials are shown here.</p>
        </>}
      </section>
      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">QR payments</h2>
        {qr.isError ? <p role="alert" className="mt-4 text-destructive">Could not load QR payment figures.</p> : !qr.data ? <Loader2 className="mt-4 size-5 animate-spin" aria-label="Loading QR payment figures" /> : <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="QR scans" value={qr.data.scans.toLocaleString()} note="All scanned codes" />
            <Metric label="Payment requests" value={qr.data.requests.toLocaleString()} note={`${qr.data.pending.toLocaleString()} pending`} />
            <Metric label="QR payments completed" value={qr.data.paid.toLocaleString()} note={`${qr.data.failed.toLocaleString()} failed`} />
            <Metric label="Suspicious activity" value={qr.data.suspicious.toLocaleString()} note="Accounts with 10+ invalid/external scans in 24h" />
          </div>
          <dl className="mt-4 divide-y divide-border">
            <div className="grid gap-2 py-3 sm:grid-cols-2"><dt className="text-sm font-medium">Total QR payment value</dt><dd className="text-sm text-muted-foreground">{Object.keys(qr.data.valueByCurrency).length ? Object.entries(qr.data.valueByCurrency).map(([c, v]) => `${c} ${Number(v).toLocaleString()}`).join(" · ") : "None yet"}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Monitoring only — QR codes contain opaque identifiers, never balances or credentials.</p>
        </>}
      </section>
      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">Financial operations</h2>
        <Button asChild variant="link" className="mt-2"><Link to="/admin-revenue">Revenue and fee management <ArrowUpRight /></Link></Button>
        <dl className="mt-4 divide-y divide-border">{[["Customer directory and wallet totals", "Unavailable — verified administrative reads pending"], ["Flutterwave bank services", "Not connected"], ["Breet crypto services", "Not connected"], ["Treasury, revenue and settlement", "Unavailable — authoritative sources pending"], ["KYC and interest-bearing savings", "Unavailable — product and provider rules pending"]].map(([label, status]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-2"><dt className="text-sm font-medium">{label}</dt><dd className="text-sm text-muted-foreground">{status}</dd></div>)}</dl>
      </section>
    </AdminShell>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="min-w-0 rounded-lg border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 break-words text-2xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>;
}