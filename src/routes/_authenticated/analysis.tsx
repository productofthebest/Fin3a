import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Download, ChevronRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { ForecastSimulator } from "@/components/forecast-simulator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analysisSearch, getAnalysis } from "@/lib/analysis.functions";
import { analysisCsv, type AnalysisFilters } from "@/lib/financial-analysis";
import { formatMoney } from "@/lib/fin3a";
import { settingsQuery } from "@/lib/queries";
import { pageMeta } from "@/lib/page-meta";
const analysisQuery = (filters: AnalysisFilters) => queryOptions({ queryKey: ["financial-analysis", filters], queryFn: () => getAnalysis({ data: filters }) });
export const Route = createFileRoute("/_authenticated/analysis")({
  head: () => pageMeta("Financial analysis", "Your Fin3a historical comparisons, category trends and transparent cash-flow forecasts."),
  validateSearch: analysisSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => { await context.queryClient.ensureQueryData(settingsQuery()); await context.queryClient.ensureQueryData(analysisQuery(deps)); },
  errorComponent: ({ error }) => <AnalysisError error={error}/>,
  notFoundComponent: () => <p>Financial analysis not found.</p>,
  pendingComponent: () => <p className="p-8 text-muted-foreground">Loading your financial history…</p>,
  component: AnalysisPage,
});
function AnalysisError({ error }: { error: unknown }) { const router = useRouter(); return <div className="p-8"><p role="alert">{error instanceof Error ? error.message : "Your financial analysis could not be loaded."}</p><Button className="mt-4" onClick={() => router.invalidate()}>Try again</Button><Link to="/spending" className="ml-4 text-primary">Spending</Link></div>; }
function AnalysisPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(analysisQuery(filters));
  const [category, setCategory] = useState<string | null | undefined>(undefined);
  const [dates, setDates] = useState({ start: data.range.start, end: data.range.end });
  useEffect(() => { setDates({ start: data.range.start, end: data.range.end }); }, [data.range.start, data.range.end]);
  const transactions = category === undefined ? data.transactions : data.transactions.filter(r => r.type === "expense" && r.category_id === category);
  const money = (v: number) => formatMoney(v, data.currency);
  const change = (v: number | null) => v === null ? "No percentage baseline" : `${v > 0 ? "+" : ""}${v}% vs comparison`;
  function update(patch: Partial<AnalysisFilters>) { setCategory(undefined); void navigate({ to: "/analysis", search: { ...filters, ...patch } }); }
  function download() { const url = URL.createObjectURL(new Blob([analysisCsv(data, data.currency)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `fin3a-${data.range.start}-${data.range.end}.csv`; a.click(); URL.revokeObjectURL(url); }
  const excluded = Object.values(data.current.excluded).reduce((s,n) => s+n,0);
  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-3xl font-bold">Financial analysis</h1><p className="mt-2 text-sm text-muted-foreground">{data.range.start} — {data.range.end} · {data.currency} · Actual recorded figures</p></div><Button variant="outline" onClick={download}><Download className="size-4"/>Export CSV</Button></div>
    <div className="mt-6 flex flex-wrap items-end gap-3">
      <div><Label>Period</Label><Select value={filters.period} onValueChange={value => update({ period: value as AnalysisFilters["period"], start: value === "custom" ? data.range.start : undefined })}><SelectTrigger aria-label="Period" className="mt-2 w-40"><SelectValue/></SelectTrigger><SelectContent>{(["week","month","quarter","year","custom"] as const).map(p => <SelectItem key={p} value={p}>{({ week: "Weekly", month: "Monthly", quarter: "Quarterly", year: "Annual", custom: "Custom" })[p]}</SelectItem>)}</SelectContent></Select></div>
      {filters.period === "custom" && <div><Label htmlFor="analysis-start">From</Label><Input id="analysis-start" className="mt-2 w-44" type="date" value={dates.start} max={dates.end} onChange={e => setDates(prev => ({ ...prev, start: e.target.value }))}/></div>}
      <div><Label htmlFor="analysis-end">Through</Label><Input id="analysis-end" className="mt-2 w-44" type="date" value={dates.end} min={filters.period === "custom" ? dates.start : undefined} max={data.today} onChange={e => setDates(prev => ({ ...prev, end: e.target.value }))}/></div>
      <Button variant="outline" disabled={!dates.end || dates.end > data.today || (filters.period === "custom" && (!dates.start || dates.start > dates.end))} onClick={() => update({ start: filters.period === "custom" ? dates.start : undefined, end: dates.end })}>Apply dates</Button>
      <div><Label>Compare with</Label><Select value={filters.comparison} onValueChange={value => update({ comparison: value as AnalysisFilters["comparison"] })}><SelectTrigger aria-label="Compare with" className="mt-2 w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="previous">Previous equal-length period</SelectItem><SelectItem value="year">Same dates last year</SelectItem></SelectContent></Select></div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Comparison: {data.range.comparisonStart} — {data.range.comparisonEnd} · UTC calendar dates · No currency conversion</p>
    <div className="mt-7 grid gap-5 border-y border-border py-6 sm:grid-cols-3">{[{ name: "Income", value: data.current.income, old: data.previous.income, delta: data.changes.income }, { name: "Spending", value: data.current.spending, old: data.previous.spending, delta: data.changes.spending }, { name: "Recorded net cash flow", value: data.current.recordedNet, old: data.previous.recordedNet, delta: null }].map(metric => <div key={metric.name}><p className="text-sm text-muted-foreground">{metric.name}</p><p className="mt-2 break-words font-display text-2xl font-semibold">{money(metric.value)}</p><p className="mt-2 text-xs text-muted-foreground">Comparison {money(metric.old)}</p>{metric.name !== "Recorded net cash flow" && <p className="mt-1 text-xs text-muted-foreground">{change(metric.delta)}</p>}</div>)}</div>
    <p className="mt-3 text-xs text-muted-foreground">Completed regular records only · Not a bank balance · Pending expenses {money(data.current.pendingExpenses)}{excluded ? ` · ${excluded} records excluded due to currency, classification, date or review status` : ""} · {data.comparisonCount} eligible comparison records. Missing records are not proof of zero real-world spending.</p>
    <section className="mt-8"><h2 className="font-display text-xl font-semibold">Income & spending</h2>{data.transactions.length === 0 ? <div className="mt-5 border-l-2 border-primary pl-4"><p className="text-sm text-muted-foreground">No eligible completed records in this period.</p><Button asChild variant="link" className="px-0"><Link to="/activity">View Activity<ChevronRight className="size-4"/></Link></Button></div> : <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={60} tickFormatter={v => v.slice(5)}/><Tooltip formatter={(v: number) => money(v)} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--foreground)" }}/><Area dataKey="income" name="Income" stroke="var(--positive)" fill="var(--positive)" fillOpacity={0.08}/><Area dataKey="spending" name="Spending" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15}/></AreaChart></ResponsiveContainer></div>}</section>
    <section className="mt-8"><h2 className="font-display text-xl font-semibold">Category comparison</h2><div className="mt-4 divide-y divide-border">{data.categories.length ? data.categories.map(c => <div key={c.id ?? "none"} className="flex items-center justify-between gap-4 py-3"><Button variant="ghost" className="min-w-0 justify-start px-0" onClick={() => setCategory(c.id)}><span>{c.icon}</span><span className="truncate">{c.name}</span><ChevronRight className="size-4"/></Button><div className="text-right"><p className="text-sm font-medium">{money(c.spending)}</p><p className="text-xs text-muted-foreground">{money(c.previous)} before · {change(c.change)}</p></div></div>) : <p className="text-sm text-muted-foreground">No eligible category spending recorded.</p>}</div></section>
    <section className="mt-8"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Underlying transactions ({transactions.length})</h2>{category !== undefined && <Button variant="ghost" onClick={() => setCategory(undefined)}>All transactions</Button>}</div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Date</th><th className="pr-4">Description</th><th className="pr-4">Source</th><th className="text-right">Amount</th></tr></thead><tbody className="divide-y divide-border">{transactions.map(r => <tr key={r.id}><td className="whitespace-nowrap py-3 pr-4">{r.occurred_at}</td><td className="min-w-40 pr-4">{r.description ?? r.categories?.name ?? "Transaction"}</td><td className="pr-4 text-xs text-muted-foreground">{r.source === "document" ? "Imported" : "Manual"}</td><td className={`whitespace-nowrap text-right ${r.type === "income" ? "text-positive" : ""}`}>{r.type === "income" ? "+" : "−"}{money(Number(r.amount))}</td></tr>)}</tbody></table>{!transactions.length && <p className="py-4 text-sm text-muted-foreground">No transactions to display.</p>}</div></section>
    <ForecastSimulator history={data.history} currency={data.currency}/>
  </AppShell>;
}