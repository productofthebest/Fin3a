import { accountCurrencies, localCurrency } from "@/lib/country-currency";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getIsAdmin } from "@/lib/admin.functions";
import { decideAdjustment, getAuditFeed, getUserDetail, getUserStats, listUsers, requestAdjustment, setAccountStatus, setVerification, updateUserProfile, type UserDetail } from "@/lib/admin-users.functions";
import { ACCOUNT_STATUSES, VERIFICATION_STATUSES, growthPercent, validAdjustmentAmount } from "@/lib/admin-users";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/admin-users")({
  head: () => pageMeta("Admin users", "Fin3a user statistics, growth and protected user management for administrators."),
  ssr: false,
  component: AdminUsers,
});

const LIVE_MS = 15_000;
const money = (c: string, n: number) => `${c === "NGN" ? "₦" : "$"}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sym = (currency: string) => (currency === "NGN" ? "₦" : currency === "USD" ? "$" : currency);
const when = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

function AdminUsers() {
  const access = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => getIsAdmin() });
  if (access.isPending) return <AppShell><Loader2 className="mx-auto mt-16 size-6 animate-spin" aria-label="Checking administrator access" /></AppShell>;
  if (access.data !== true) return <AppShell><div className="mx-auto mt-16 max-w-md text-center"><ShieldAlert className="mx-auto size-8 text-muted-foreground" /><h1 className="mt-3 text-2xl font-semibold">Administrators only</h1><p className="mt-2 text-sm text-muted-foreground">This page is not available for your account.</p></div></AppShell>;
  return <AdminShell section="users"><Stats /><Management /><AuditSection /></AdminShell>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}
const growthNote = (cur: number, prev: number, label: string) => { const g = growthPercent(cur, prev); return g == null ? `No ${label} baseline yet` : `${g >= 0 ? "+" : ""}${g}% vs ${label}`; };

function Stats() {
  const fetchStats = useServerFn(getUserStats);
  const stats = useQuery({ queryKey: ["admin", "user-stats"], queryFn: () => fetchStats(), refetchInterval: LIVE_MS });
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const d = stats.data;
  const series = (d?.series ?? []).filter((s) => s.period === period).map((s) => ({ ...s, label: new Date(s.bucket).toLocaleDateString(undefined, period === "yearly" ? { year: "numeric" } : period === "monthly" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" }) }));
  return (
    <section>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm text-primary">Administration</p><h1 className="mt-1 text-3xl font-bold">Users</h1><p className="mt-2 text-sm text-muted-foreground">Registered Fin3a accounts · updates every 15 seconds · periods in UTC</p></div>
        <Button variant="outline" size="icon" aria-label="Refresh statistics" disabled={stats.isFetching} onClick={() => void stats.refetch()}><RefreshCw className={stats.isFetching ? "animate-spin" : ""} /></Button>
      </header>
      {stats.isError ? <p role="alert" className="mt-6 text-destructive">Could not load user statistics.</p> : !d ? <Loader2 className="mt-8 size-6 animate-spin" aria-label="Loading statistics" /> : <>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Total users" value={d.total.toLocaleString()} note="All registered accounts" />
          <Metric label="Active users" value={d.active.toLocaleString()} note={`Activity in the last ${d.active_window_days} days`} />
          <Metric label="Inactive users" value={d.inactive.toLocaleString()} note={`No activity for ${d.active_window_days}+ days`} />
          <Metric label="New today" value={d.new_today.toLocaleString()} note={growthNote(d.new_today, d.new_yesterday, "yesterday")} />
          <Metric label="New this week" value={d.new_week.toLocaleString()} note={growthNote(d.new_week, d.new_last_week, "last week")} />
          <Metric label="New this month" value={d.new_month.toLocaleString()} note={growthNote(d.new_month, d.new_last_month, "last month")} />
        </div>
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">User growth and registrations</h2>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}><TabsList>{(["daily", "weekly", "monthly", "yearly"] as const).map((p) => <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>)}</TabsList></Tabs>
          </div>
          <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="total" name="Total users" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} />
            <Area type="monotone" dataKey="new" name="New registrations" stroke="var(--color-accent-foreground)" fill="var(--color-accent)" fillOpacity={0.4} />
          </AreaChart></ResponsiveContainer></div>
        </div>
      </>}
    </section>
  );
}

function Management() {
  const fetchUsers = useServerFn(listUsers);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const users = useQuery({ queryKey: ["admin", "users", query, page], queryFn: () => fetchUsers({ data: { search: query, page } }), refetchInterval: LIVE_MS });
  const pages = users.data ? Math.max(1, Math.ceil(users.data.total / 25)) : 1;
  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-xl font-semibold">User management</h2>
      <form className="mt-4 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search.trim()); }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone or Fin3a ID" aria-label="Search users" maxLength={120} />
        <Button type="submit"><Search />Search</Button>
      </form>
      <div className="mt-4 overflow-x-auto border-y border-border">
        <table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["Name", "Email", "Phone", "Fin3a ID", "₦", "$", "Status", "Verification", "Registered"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {users.data?.rows.map((u) => <tr key={u.user_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(u.user_id)}>
              <td className="px-4 py-3"><button className="font-medium text-primary underline-offset-2 hover:underline">{u.display_name || "Unnamed"}</button></td>
              <td className="px-4 py-3">{u.email ?? "—"}</td><td className="px-4 py-3">{u.phone ?? "—"}</td><td className="px-4 py-3">{u.fin3a_id ?? "—"}</td>
              <td className="px-4 py-3 tabular-nums">{money("NGN", u.ngn)}</td><td className="px-4 py-3 tabular-nums">{money("USD", u.usd)}</td>
              <td className="px-4 py-3"><StatusBadge value={u.status} /></td><td className="px-4 py-3 capitalize">{u.verification}</td>
              <td className="whitespace-nowrap px-4 py-3">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>)}
            {users.data?.rows.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-muted-foreground">No users match this search.</td></tr>}
          </tbody></table>
        {users.isPending && <Loader2 className="m-4 size-5 animate-spin" aria-label="Loading users" />}
        {users.isError && <p role="alert" className="p-4 text-destructive">Could not load users.</p>}
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} of {pages} · {users.data?.total.toLocaleString() ?? "…"} users</span><Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
      <UserSheet userId={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  return <Badge variant={value === "active" ? "secondary" : "destructive"} className="capitalize">{value}</Badge>;
}

type Confirm = { title: string; description: string; noteLabel: string; minNote: number; extra?: ReactNode; run: (note: string) => Promise<unknown> };

function ConfirmDialog({ confirm, onClose }: { confirm: Confirm | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const m = useMutation({ mutationFn: (n: string) => confirm!.run(n), onSuccess: () => { toast.success("Saved and recorded in the audit log."); setNote(""); onClose(); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed") });
  return (
    <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) { setNote(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{confirm?.title}</DialogTitle><DialogDescription>{confirm?.description}</DialogDescription></DialogHeader>
        {confirm?.extra}
        <label className="text-sm font-medium">{confirm?.noteLabel}<Textarea className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={m.isPending || note.trim().length < (confirm?.minNote ?? 5)} onClick={() => m.mutate(note.trim())}>{m.isPending && <Loader2 className="animate-spin" />}Confirm</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getUserDetail);
  const detail = useQuery({ queryKey: ["admin", "user-detail", userId], queryFn: () => fetchDetail({ data: { userId: userId! } }), enabled: !!userId, staleTime: 60_000 });
  const statusFn = useServerFn(setAccountStatus), verifyFn = useServerFn(setVerification), profileFn = useServerFn(updateUserProfile), adjustFn = useServerFn(requestAdjustment);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [name, setName] = useState("");
  const [adj, setAdj] = useState({ currency: "NGN" as "NGN" | "USD", direction: "credit" as "credit" | "debit", amount: "" });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin"] }); };
  const d: (UserDetail & { country: string; localBalance: { available: number; with_pending: number } | null }) | undefined = detail.data;
  const p = d?.profile;
  const amount = validAdjustmentAmount(adj.amount);
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader><SheetTitle>{p?.display_name || "User profile"}</SheetTitle><SheetDescription>This view is recorded in the audit log. Passwords, codes and credentials are never shown.</SheetDescription></SheetHeader>
        {detail.isError ? <p role="alert" className="mt-6 text-destructive">Could not load this user.</p> : !d || !p ? <Loader2 className="mt-6 size-6 animate-spin" aria-label="Loading user" /> : <div className="mt-6 space-y-6 px-1 pb-8 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {[["Email", p.email], ["Phone", p.phone], ["Fin3a ID", p.fin3a_id], ["User ID", p.user_id], ["Registered", when(p.created_at)], ["Last activity", when(p.last_active)], ["Preferred currency", `${localCurrency(d.country)} (local) · USD`], ["Preferred country", `${new Intl.DisplayNames(["en"], { type: "region" }).of(d.country) ?? d.country} (${d.country})`], ["Verification", `${p.verification}${p.verification_note ? ` — ${p.verification_note}` : ""}`]].map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-all font-medium">{v || "—"}</dd></div>)}
            <div><dt className="text-muted-foreground">Account status</dt><dd><StatusBadge value={p.status} /></dd></div>
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">{accountCurrencies(d.country).map((c) => { const b = c === "NGN" || c === "USD" ? d.balances[c] : d.localBalance; const f = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: c, currencyDisplay: "narrowSymbol" }).format(n); return <div key={c} className="rounded-xl border border-border bg-card p-4"><p className="text-muted-foreground">{c} balance</p><p className="mt-1 text-xl font-bold tabular-nums">{f(b?.available ?? 0)}</p><p className="text-xs text-muted-foreground">Including pending: {f(b?.with_pending ?? 0)}</p></div>; })}</div>
          <p className="text-xs text-muted-foreground">Country: {d.country} · Accounts: {accountCurrencies(d.country).join(" and ")}{localCurrency(d.country) !== "NGN" && localCurrency(d.country) !== "USD" ? ` · ${localCurrency(d.country)} account can't be moved yet` : ""}</p>
                    <p className="text-xs text-muted-foreground">Transfers, Share Payment and Split Bill move only NGN and USD. NGN bank transfers and withdrawals use the ₦50 NGN withdrawal fee, deducted from the payout. Local-currency accounts outside Nigeria (for example GHS or KES) can't be moved yet.</p>
          <div><h3 className="font-semibold">Crypto wallets</h3>{d.crypto.length ? <ul className="mt-2 space-y-1">{d.crypto.map((w) => <li key={w.address} className="break-all">{w.symbol} · {w.network} · {w.address} ({w.status})</li>)}</ul> : <p className="mt-1 text-muted-foreground">No crypto wallet addresses issued.</p>}</div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="font-semibold">Account actions</h3>
            {p.is_admin && <p className="text-xs text-muted-foreground">This is an administrator account.</p>}
            <div className="flex flex-wrap gap-2">{ACCOUNT_STATUSES.filter((s) => s !== p.status).map((s) => <Button key={s} size="sm" variant={s === "active" ? "default" : "outline"} className="capitalize" onClick={() => setConfirm({ title: `${s === "active" ? "Reactivate" : s.charAt(0).toUpperCase() + s.slice(1)} this account?`, description: s === "restricted" ? "The user can sign in but cannot send, swap or request money." : s === "active" ? "The user regains normal access." : "The user is signed out of new sessions and cannot sign in or move money.", noteLabel: "Reason (required)", minNote: 5, run: (note) => statusFn({ data: { userId: p.user_id, status: s, reason: note } }).then(refresh) })}>{s === "active" ? "Reactivate" : s === "restricted" ? "Restrict" : s === "suspended" ? "Suspend" : "Deactivate"}</Button>)}</div>
            <div className="flex flex-wrap gap-2">{VERIFICATION_STATUSES.filter((v) => v !== p.verification).map((v) => <Button key={v} size="sm" variant="outline" onClick={() => setConfirm({ title: `Mark as ${v}?`, description: "Manual administrator check. Identity document checks (KYC) are not part of Fin3a yet.", noteLabel: "What did you check? (required)", minNote: 5, run: (note) => verifyFn({ data: { userId: p.user_id, verification: v, note } }).then(refresh) })}>Mark {v}</Button>)}</div>
            <div className="flex gap-2"><Input placeholder={p.display_name ?? "Display name"} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="New display name" /><Button size="sm" variant="outline" disabled={!name.trim()} onClick={() => setConfirm({ title: "Change display name?", description: `From “${p.display_name ?? "—"}” to “${name.trim()}”. Email, phone and sign-in details can only be changed by the user.`, noteLabel: "Reason (required)", minNote: 5, run: (note) => profileFn({ data: { userId: p.user_id, displayName: name.trim(), reason: note } }).then(() => { setName(""); refresh(); }) })}>Update name</Button></div>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="font-semibold">Request a balance adjustment</h3>
            <p className="text-xs text-muted-foreground">A second administrator must approve it. Approval adds a new ledger entry; existing records are never edited.</p>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Currency" className="h-9 rounded-md border border-input bg-background px-2" value={adj.currency} onChange={(e) => setAdj({ ...adj, currency: e.target.value as "NGN" | "USD" })}><option value="NGN">₦</option><option value="USD">$</option></select>
              <select aria-label="Direction" className="h-9 rounded-md border border-input bg-background px-2" value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value as "credit" | "debit" })}><option value="credit">Credit</option><option value="debit">Debit</option></select>
              <Input className="w-36" inputMode="decimal" placeholder="Amount" aria-label="Adjustment amount" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />
              <Button size="sm" disabled={amount == null} onClick={() => amount != null && setConfirm({ title: "Submit adjustment for approval?", description: `${adj.direction === "credit" ? "Credit" : "Debit"} ${money(adj.currency, amount)} on this user's ${adj.currency} balance. Nothing changes until another administrator approves.`, noteLabel: "Reason (at least 10 characters)", minNote: 10, run: (note) => adjustFn({ data: { userId: p.user_id, currency: adj.currency, direction: adj.direction, amount, reason: note } }).then(() => { setAdj({ ...adj, amount: "" }); refresh(); }) })}>Submit</Button>
            </div>
          </div>

          <Tabs defaultValue="ledger">
            <TabsList className="flex-wrap"><TabsTrigger value="ledger">Wallet activity</TabsTrigger><TabsTrigger value="transfers">Transfers</TabsTrigger><TabsTrigger value="swaps">Swaps</TabsTrigger><TabsTrigger value="records">Records</TabsTrigger><TabsTrigger value="adjust">Adjustments</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger></TabsList>
            <TabsContent value="ledger">
              <p className="mb-2 text-xs text-muted-foreground">Pending {d.ledger_status.pending ?? 0} · Successful {d.ledger_status.completed ?? 0} · Failed {d.ledger_status.failed ?? 0} · Reversed {d.ledger_status.reversed ?? 0} · Disputed 0 (no dispute records exist yet)</p>
              <Rows items={d.ledger} empty="No wallet activity." render={(l) => [new Date(l.created_at).toLocaleString(), l.kind.replace("_", " "), money(l.currency, l.amount), l.status, l.provider === "admin_adjustment" ? "Admin adjustment" : l.reference ?? ""]} />
            </TabsContent>
            <TabsContent value="transfers"><Rows items={d.transfers} empty="No transfers." render={(t) => [new Date(t.created_at).toLocaleString(), t.direction, money(t.currency, t.amount), t.status, t.reference ?? ""]} /></TabsContent>
            <TabsContent value="swaps"><Rows items={d.swaps} empty="No swaps." render={(s) => [new Date(s.created_at).toLocaleString(), `${s.from_currency}→${s.to_currency}`, money(s.from_currency, s.source_amount), money(s.to_currency, s.destination_amount), s.status]} /></TabsContent>
            <TabsContent value="records"><Rows items={d.records} empty="No tracked records." render={(r) => [r.occurred_at, r.type, `${r.currency ?? "?"} ${Number(r.amount).toLocaleString()}`, r.status, r.merchant || r.description || ""]} /></TabsContent>
            <TabsContent value="adjust"><Rows items={d.adjustments} empty="No adjustments." render={(a) => [new Date(a.created_at).toLocaleString(), a.direction, money(a.currency, a.amount), a.status, a.reason]} /></TabsContent>
            <TabsContent value="audit"><Rows items={d.audit} empty="No admin actions." render={(a) => [new Date(a.created_at).toLocaleString(), a.action.replace(/_/g, " "), a.admin_email ?? "—", describe(a.detail)]} /></TabsContent>
          </Tabs>
        </div>}
        <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      </SheetContent>
    </Sheet>
  );
}

function describe(detail: { [key: string]: string | number | boolean | null }) {
  return Object.entries(detail).filter(([k]) => !k.endsWith("_id")).map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}

function Rows<T>({ items, render, empty }: { items: T[]; render: (t: T) => string[]; empty: string }) {
  if (!items.length) return <p className="py-3 text-muted-foreground">{empty}</p>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><tbody className="divide-y divide-border">{items.map((it, i) => <tr key={i}>{render(it).map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-2 capitalize first:normal-case">{c}</td>)}</tr>)}</tbody></table></div>;
}

function AuditSection() {
  const qc = useQueryClient();
  const fetchFeed = useServerFn(getAuditFeed);
  const decideFn = useServerFn(decideAdjustment);
  const feed = useQuery({ queryKey: ["admin", "audit-feed"], queryFn: () => fetchFeed(), refetchInterval: LIVE_MS });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-xl font-semibold">Adjustments awaiting approval</h2>
      {feed.isError ? <p role="alert" className="mt-4 text-destructive">Could not load the audit log.</p> : !feed.data ? <Loader2 className="mt-4 size-5 animate-spin" aria-label="Loading audit log" /> : <>
        {feed.data.pending_adjustments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No pending adjustments.</p> : <ul className="mt-3 divide-y divide-border border-y border-border">{feed.data.pending_adjustments.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <span>{a.direction === "credit" ? "Credit" : "Debit"} {money(a.currency, a.amount)} · {a.target_email ?? a.user_id} · requested by {a.requested_by_email ?? "—"} · “{a.reason}”</span>
          <span className="flex gap-2">{[true, false].map((approve) => <Button key={String(approve)} size="sm" variant={approve ? "default" : "outline"} onClick={() => setConfirm({ title: approve ? "Approve this adjustment?" : "Reject this adjustment?", description: approve ? `A new ledger entry will ${a.direction} ${money(a.currency, a.amount)}. This cannot be undone except by another adjustment. The requester cannot approve their own request.` : "The request will be closed without changing any balance.", noteLabel: "Decision note (required)", minNote: 5, run: (note) => decideFn({ data: { id: a.id, approve, note } }).then(() => qc.invalidateQueries({ queryKey: ["admin"] })) })}>{approve ? "Approve" : "Reject"}</Button>)}</span>
        </li>)}</ul>}
        <h2 className="mt-10 text-xl font-semibold">Admin audit log</h2>
        <div className="mt-4 max-h-[32rem] overflow-auto border-y border-border">
          <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted text-muted-foreground"><tr>{["Time", "Administrator", "Action", "User", "Details"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{feed.data.audit.map((a) => <tr key={a.id}><td className="whitespace-nowrap px-4 py-3">{new Date(a.created_at).toLocaleString()}</td><td className="px-4 py-3">{a.admin_email ?? "—"}</td><td className="px-4 py-3 capitalize">{a.action.replace(/_/g, " ")}</td><td className="px-4 py-3">{a.target_email ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{describe(a.detail)}</td></tr>)}
              {feed.data.audit.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted-foreground">No administrative actions recorded yet.</td></tr>}</tbody></table>
        </div>
      </>}
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </section>
  );
}
