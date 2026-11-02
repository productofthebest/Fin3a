import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PlanningWorkspace } from "@/components/planning-workspace";
import { getPlanning } from "@/lib/planning.functions";
import { pageMeta } from "@/lib/page-meta";
export const planningQuery=()=>queryOptions({queryKey:["planning"],queryFn:()=>getPlanning()});
export const Route=createFileRoute("/_authenticated/planning")({head:()=>pageMeta("Financial planning","Confirmed balances, saved financial scenarios, affordability and savings projections in Fin3a."),loader:({context})=>context.queryClient.ensureQueryData(planningQuery()),errorComponent:()=> <div className="p-8"><p role="alert">Financial planning is unavailable until this draft's saved-feature changes are accepted.</p><Link to="/analysis" className="text-primary">Return to analysis</Link></div>,notFoundComponent:()=> <p>Planning not found.</p>,component:Page});
function Page(){const {data}=useSuspenseQuery(planningQuery());return <AppShell><h1 className="font-display text-3xl font-bold">Financial planning</h1><p className="mt-2 text-sm text-muted-foreground">{data.currency} · Actual confirmations, estimates and projections · UTC</p><PlanningWorkspace data={data} view="planning"/></AppShell>;}