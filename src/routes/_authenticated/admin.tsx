import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { budgetUse } from "@/lib/ai-usage-rules";
import { getAiOverview, getIsAdmin, setModelPrice, setUserAiLimit, updateAiSettings, type AiOverview } from "@/lib/admin.functions";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageMeta("AI usage admin", "Monitor Fin3a AI usage, estimated spend, budgets and limits."),
  ssr: false,
  component: AdminPage,
});

const usd = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `$${Number(n).toFixed(4)}`);
const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString();
const optNum = (v: string) => (v.trim() === "" ? null : Number(v));

function AdminPage() {
  const isAdmin = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => getIsAdmin() });
  const overview = useQuery({ queryKey: ["admin", "ai-overview"], queryFn: () => getAiOverview(), enabled: isAdmin.data === true });

  if (isAdmin.isLoading) return <AppShell><Loader2 className="mx-auto mt-16 size-6 animate-spin text-muted-foreground" /></AppShell>;
  if (!isAdmin.data) {
    return (
      <AppShell>
        <div className="mx-auto mt-16 max-w-md text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 font-display text-2xl font-semibold">Administrators only</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page is not available for your account.</p>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">AI usage</h1>
      <p className="mt-1 text-sm text-muted-foreground">Usage counts and estimated OpenAI spend. Times are UTC. No financial records are shown here.</p>
      {overview.isLoading || !overview.data ? (
        <Loader2 className="mx-auto mt-10 size-6 animate-spin text-muted-foreground" />
      ) : (
        <AdminBody data={overview.data} />
      )}
    </AppShell>
  );
}

function AdminBody({ data }: { data: AiOverview }) {
  const s = data.settings;
  const dayUse = budgetUse(data.today.est_cost_usd, s.daily_budget_usd);
  const monthUse = budgetUse(data.month.est_cost_usd, s.monthly_budget_usd);
  const warn = s.warn_percent / 100;
  return (
    <div className="mt-6 space-y-6">
      {!s.ai_enabled && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">AI services are paused for all users.</p>}
      {(dayUse !== null && dayUse >= warn) || (monthUse !== null && monthUse >= warn) ? (
        <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">Spend is at {Math.round(Math.max(dayUse ?? 0, monthUse ?? 0) * 100)}% of a budget.</p>
      ) : null}
      {data.prices.length === 0 && (
        <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          No model prices entered yet, so cost estimates show “—”. Add prices from OpenAI's official pricing page below. Budgets only apply to priced usage.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requests today" value={num(data.today.requests)} sub={`${num(data.today.failed)} failed`} />
        <Stat label="Est. spend today" value={usd(data.today.est_cost_usd)} sub={s.daily_budget_usd !== null ? `of ${usd(s.daily_budget_usd)} budget` : "no daily budget"} />
        <Stat label="Requests this month" value={num(data.month.requests)} sub={`${num(data.month.input_tokens + data.month.output_tokens)} tokens`} />
        <Stat label="Est. spend this month" value={usd(data.month.est_cost_usd)} sub={`failed ${usd(data.month.failed_cost_usd)} · ${num(data.month.unpriced)} unpriced`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By feature (this month)</CardTitle></CardHeader>
        <CardContent>
          <Table head={["Feature", "Requests", "Failed", "Input tokens", "Output tokens", "Est. cost"]}
            rows={data.by_feature.map((f) => [f.feature, num(f.requests), num(f.failed), num(f.input_tokens), num(f.output_tokens), usd(f.est_cost_usd)])} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Daily (last 30 days)</CardTitle></CardHeader>
        <CardContent>
          <Table head={["Day", "Requests", "Est. cost"]} rows={data.daily.map((d) => [d.day, num(d.requests), usd(d.est_cost_usd)])} />
        </CardContent>
      </Card>

      <SettingsCard data={data} />
      <UsersCard data={data} />
      <PricesCard data={data} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No usage recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground">{head.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="py-2 pr-4 tabular-nums">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "ai-overview"] });
}

function SettingsCard({ data }: { data: AiOverview }) {
  const refresh = useRefresh();
  const s = data.settings;
  const [f, setF] = useState({
    ai_enabled: s.ai_enabled, daily: s.daily_budget_usd?.toString() ?? "", monthly: s.monthly_budget_usd?.toString() ?? "",
    req: String(s.user_daily_requests), scans: String(s.user_daily_scans), mscans: String(s.user_monthly_scans), warn: String(s.warn_percent),
  });
  useEffect(() => { setF((x) => ({ ...x, ai_enabled: s.ai_enabled })); }, [s.ai_enabled]);
  const save = useMutation({
    mutationFn: (enabled?: boolean) => updateAiSettings({ data: {
      ai_enabled: enabled ?? f.ai_enabled, daily_budget_usd: optNum(f.daily), monthly_budget_usd: optNum(f.monthly),
      user_daily_requests: Number(f.req), user_daily_scans: Number(f.scans), user_monthly_scans: Number(f.mscans), warn_percent: Number(f.warn),
    } }),
    onSuccess: () => { toast.success("AI settings saved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Budgets and default limits</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          AI services
          <Switch checked={f.ai_enabled} onCheckedChange={(v) => { setF({ ...f, ai_enabled: v }); save.mutate(v); }} aria-label="AI services enabled" />
        </label>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Daily budget (USD, blank = none)" value={f.daily} onChange={(v) => setF({ ...f, daily: v })} step="0.01" />
          <Field label="Monthly budget (USD, blank = none)" value={f.monthly} onChange={(v) => setF({ ...f, monthly: v })} step="0.01" />
          <Field label="AI requests per user per day" value={f.req} onChange={(v) => setF({ ...f, req: v })} required />
          <Field label="Warn at % of limit" value={f.warn} onChange={(v) => setF({ ...f, warn: v })} required />
          <Field label="Scans per user per day" value={f.scans} onChange={(v) => setF({ ...f, scans: v })} required />
          <Field label="Scans per user per month" value={f.mscans} onChange={(v) => setF({ ...f, mscans: v })} required />
          <div className="flex items-end"><Button type="submit" disabled={save.isPending}>Save limits</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, step = "1", required }: { label: string; value: string; onChange: (v: string) => void; step?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function UsersCard({ data }: { data: AiOverview }) {
  const refresh = useRefresh();
  const save = useMutation({
    mutationFn: (p: Parameters<typeof setUserAiLimit>[0]["data"]) => setUserAiLimit({ data: p }),
    onSuccess: () => { toast.success("User limit saved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Usage per user (this month)</CardTitle></CardHeader>
      <CardContent>
        <Table head={["Account", "Requests", "Today", "Scans", "Failed", "Tokens", "Est. cost", "AI access"]}
          rows={data.users.map((u) => [
            u.email ?? u.user_id.slice(0, 8), num(u.requests), num(u.today), num(u.scans), num(u.failed), num(u.tokens), usd(u.est_cost_usd),
            <Button key="b" size="sm" variant={u.blocked ? "default" : "outline"} disabled={save.isPending}
              onClick={() => save.mutate({ user_id: u.user_id, daily_requests: u.daily_requests, daily_scans: u.daily_scans, monthly_scans: u.monthly_scans, blocked: !u.blocked, note: null })}>
              {u.blocked ? "Restore" : "Pause"}
            </Button>,
          ])} />
        <UserLimitForm onSave={(p) => save.mutate(p)} pending={save.isPending} users={data.users} />
      </CardContent>
    </Card>
  );
}

function UserLimitForm({ onSave, pending, users }: { onSave: (p: Parameters<typeof setUserAiLimit>[0]["data"]) => void; pending: boolean; users: AiOverview["users"] }) {
  const [userId, setUserId] = useState("");
  const [req, setReq] = useState(""); const [scans, setScans] = useState(""); const [mscans, setMscans] = useState("");
  if (users.length === 0) return null;
  return (
    <form className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-5" onSubmit={(e) => {
      e.preventDefault(); if (!userId) return;
      const u = users.find((x) => x.user_id === userId);
      onSave({ user_id: userId, daily_requests: optNum(req), daily_scans: optNum(scans), monthly_scans: optNum(mscans), blocked: u?.blocked ?? false, note: null });
    }}>
      <div className="space-y-1.5">
        <Label className="text-xs">Account</Label>
        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Account">
          <option value="">Choose…</option>
          {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.email ?? u.user_id.slice(0, 8)}</option>)}
        </select>
      </div>
      <Field label="Requests/day (blank = default)" value={req} onChange={setReq} />
      <Field label="Scans/day (blank = default)" value={scans} onChange={setScans} />
      <Field label="Scans/month (blank = default)" value={mscans} onChange={setMscans} />
      <div className="flex items-end"><Button type="submit" disabled={pending || !userId}>Set user limit</Button></div>
    </form>
  );
}

function PricesCard({ data }: { data: AiOverview }) {
  const refresh = useRefresh();
  const [f, setF] = useState({ model: "", input: "", cached: "", output: "", note: "" });
  const save = useMutation({
    mutationFn: () => setModelPrice({ data: { model: f.model, input_per_mtok: Number(f.input), cached_input_per_mtok: optNum(f.cached), output_per_mtok: Number(f.output), source_note: f.note || null } }),
    onSuccess: () => { toast.success("Price saved"); setF({ model: "", input: "", cached: "", output: "", note: "" }); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Model prices (USD per 1M tokens)</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Models in use: gpt-5-mini (assistant, homepage chat, scanning), gpt-4o-mini-transcribe (voice). Enter prices from openai.com/api/pricing; estimates apply to usage recorded after a price is saved.</p>
        <Table head={["Model", "Input", "Cached input", "Output", "Source", "Updated"]}
          rows={data.prices.map((p) => [p.model, String(p.input_per_mtok), p.cached_input_per_mtok === null ? "—" : String(p.cached_input_per_mtok), String(p.output_per_mtok), p.source_note ?? "—", p.updated_at.slice(0, 10)])} />
        <form className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5"><Label className="text-xs">Model</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} required maxLength={100} placeholder="gpt-5-mini" /></div>
          <Field label="Input" value={f.input} onChange={(v) => setF({ ...f, input: v })} step="0.000001" required />
          <Field label="Cached input" value={f.cached} onChange={(v) => setF({ ...f, cached: v })} step="0.000001" />
          <Field label="Output" value={f.output} onChange={(v) => setF({ ...f, output: v })} step="0.000001" required />
          <div className="space-y-1.5"><Label className="text-xs">Source note</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} placeholder="OpenAI pricing page, date" /></div>
          <div className="flex items-end"><Button type="submit" disabled={save.isPending}>Save price</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
