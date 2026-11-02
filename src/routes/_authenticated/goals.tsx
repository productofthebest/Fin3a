import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PlanningWorkspace } from "@/components/planning-workspace";
import { planningQuery } from "./planning";
import { pageMeta } from "@/lib/page-meta";
export const Route=createFileRoute("/_authenticated/goals")({head:()=>pageMeta("Financial goals","Track your Fin3a savings targets, recorded progress and estimated goal contributions."),loader:({context})=>context.queryClient.ensureQueryData(planningQuery()),errorComponent:()=> <div className="p-8"><p role="alert">Saved goals become available when this draft is accepted.</p><Link to="/analysis" className="text-primary">Return to analysis</Link></div>,notFoundComponent:()=> <p>Goals not found.</p>,component:Page});
function Page(){const {data}=useSuspenseQuery(planningQuery());return <AppShell><h1 className="font-display text-3xl font-bold">Financial goals</h1><p className="mt-2 text-sm text-muted-foreground">{data.currency} · Recorded progress and estimated contributions</p><PlanningWorkspace data={data} view="goals"/></AppShell>;}