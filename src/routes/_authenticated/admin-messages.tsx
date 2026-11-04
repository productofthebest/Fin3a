import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bell, Mail, MessageSquare, Search, ShieldAlert, Loader2, Eye, Send } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getIsAdmin } from "@/lib/admin.functions";
import { listUsers, getUserStats, type UserRow } from "@/lib/admin-users.functions";
import { messageDraftSchema, messagingBlocker, type MessageDraft } from "@/lib/admin-messaging";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/admin-messages")({
  head: () => pageMeta("Admin messages", "Protected Fin3a push notification, email and SMS message preparation."),
  ssr: false,
  component: AdminMessages,
});

function AdminMessages() {
  const checkAccess = useServerFn(getIsAdmin);
  const access = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => checkAccess() });
  if (access.isPending) return <AppShell><Loader2 className="mx-auto mt-16 size-6 animate-spin" aria-label="Checking administrator access" /></AppShell>;
  if (access.data !== true) return <AppShell><div className="mx-auto mt-16 max-w-md text-center"><ShieldAlert className="mx-auto size-8 text-muted-foreground" /><h1 className="mt-3 text-2xl font-semibold">Administrators only</h1><p className="mt-2 text-muted-foreground">This page is not available for your account.</p></div></AppShell>;
  return <AdminShell section="messages"><MessageComposer /></AdminShell>;
}

function MessageComposer() {
  const fetchUsers = useServerFn(listUsers);
  const fetchStats = useServerFn(getUserStats);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [audience, setAudience] = useState<MessageDraft["audience"]>("one");
  const [channel, setChannel] = useState<MessageDraft["channel"]>("push");
  const [purpose, setPurpose] = useState<MessageDraft["purpose"]>("account");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const users = useQuery({ queryKey: ["admin", "message-users", query, page], queryFn: () => fetchUsers({ data: { search: query, page } }), enabled: audience === "one" });
  const stats = useQuery({ queryKey: ["admin", "user-stats"], queryFn: () => fetchStats(), enabled: audience === "all" });
  const draft = messageDraftSchema.safeParse({ audience, userId: audience === "one" ? selected?.user_id ?? null : null, channel, purpose, title, body });
  const blocker = messagingBlocker(channel, audience, purpose);
  const recipient = audience === "all" ? `All registered users (${stats.data?.total ?? "…"})` : selected?.display_name || selected?.fin3a_id || "Selected user";
  return <>
    <header><p className="text-sm text-primary">Administration</p><h1 className="mt-1 text-3xl font-bold">Messages</h1></header>
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Recipients</h2>
      <Tabs value={audience} onValueChange={(v) => { setAudience(v as typeof audience); if (v === "all") setPurpose("announcement"); }} className="mt-3"><TabsList><TabsTrigger value="one">One user</TabsTrigger><TabsTrigger value="all">All users</TabsTrigger></TabsList></Tabs>
      {audience === "one" ? <>
        <form className="mt-4 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(0); }}><Input aria-label="Search message recipients" placeholder="Name, email, phone or Fin3a ID" value={search} maxLength={120} onChange={(e) => setSearch(e.target.value)} /><Button type="submit" size="icon" aria-label="Search recipients"><Search /></Button></form>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{users.data?.rows.map((u) => <Button key={u.user_id} variant={selected?.user_id === u.user_id ? "secondary" : "outline"} className="h-auto min-h-20 min-w-0 justify-start py-3 text-left" onClick={() => setSelected(u)}><span className="min-w-0"><span className="block truncate font-medium">{u.display_name || u.fin3a_id || "Unnamed account"}</span><span className="block truncate text-xs text-muted-foreground">{u.email || u.phone || u.user_id}</span><span className="block text-xs capitalize text-muted-foreground">{u.status}</span></span></Button>)}</div>
        {users.isPending && <Loader2 className="mt-4 size-5 animate-spin" aria-label="Loading recipients" />}
        {users.isError && <p role="alert" className="mt-3 text-destructive">Recipients could not be loaded.</p>}
        {users.data?.total === 0 && <p className="mt-3 text-sm text-muted-foreground">No matching users.</p>}
        <div className="mt-3 flex items-center gap-3"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page + 1}</span><Button variant="outline" size="sm" disabled={!users.data || (page + 1) * 25 >= users.data.total} onClick={() => setPage(page + 1)}>Next</Button></div>
      </> : <div className="mt-4"><p className="font-medium">{recipient}</p><p className="mt-1 text-sm text-muted-foreground">Eligible recipient count is unavailable until contact validity, account restrictions and consent are checked.</p>{stats.isError && <p role="alert" className="text-destructive">Registered user count could not be loaded.</p>}</div>}
    </section>
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Message</h2>
      <div className="mt-3 flex flex-wrap gap-2">{([{ id: "push", label: "Push", icon: Bell }, { id: "email", label: "Email", icon: Mail }, { id: "sms", label: "SMS", icon: MessageSquare }] as const).map((c) => <Button key={c.id} variant={channel === c.id ? "secondary" : "outline"} aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}><c.icon />{c.label}</Button>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant={purpose === "account" ? "secondary" : "outline"} disabled={audience === "all"} onClick={() => setPurpose("account")}>Account notice</Button><Button variant={purpose === "announcement" ? "secondary" : "outline"} onClick={() => setPurpose("announcement")}>Announcement / promotion</Button></div>
      <div className="mt-4 max-w-2xl space-y-4"><label className="block text-sm font-medium">Title<Input className="mt-2" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></label><label className="block text-sm font-medium">Message<Textarea className="mt-2 min-h-36" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} /></label><p className="text-xs text-muted-foreground">Do not include passwords, verification codes or private financial details.</p>
        <p role="status" className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">{blocker}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={!draft.success} onClick={() => setPreview(true)}><Eye />Review message</Button><Button disabled><Send />Send</Button></div>
      </div>
    </section>
    <section className="mt-8 border-t border-border pt-6"><h2 className="text-lg font-semibold">Delivery records</h2><p className="mt-2 text-sm text-muted-foreground">Sending has not been enabled. No messages have been submitted from this page.</p></section>
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Review message</DialogTitle><DialogDescription>Not sent · {channel.toUpperCase()} · {recipient}</DialogDescription></DialogHeader><h3 className="break-words font-semibold">{title}</h3><p className="whitespace-pre-wrap break-words text-sm">{body}</p><p className="text-sm text-muted-foreground">{blocker}</p><DialogFooter><Button variant="outline" onClick={() => setPreview(false)}>Back to message</Button><Button disabled><Send />Confirm send</Button></DialogFooter></DialogContent></Dialog>
  </>;
}