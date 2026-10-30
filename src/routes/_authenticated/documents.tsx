import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, ScanLine, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  analyzeDocument,
  createDocument,
  deleteDocument,
  deleteDraft,
  importDrafts,
  listDocuments,
  listDrafts,
  updateDraft,
} from "@/lib/documents.functions";
import { settingsQuery } from "@/lib/queries";
import { formatMoney } from "@/lib/fin3a";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const docsQuery = () => queryOptions({ queryKey: ["documents"], queryFn: () => listDocuments() });
const draftsQuery = (documentId: string) =>
  queryOptions({ queryKey: ["drafts", documentId], queryFn: () => listDrafts({ data: { documentId } }) });

export const Route = createFileRoute("/_authenticated/documents")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Scan Documents — Fin3a AI" },
      { name: "description", content: "Scan bank statements, bills and receipts into your Fin3a ledger." },
      { property: "og:title", content: "Scan Documents — Fin3a AI" },
      { property: "og:description", content: "Scan bank statements, bills and receipts into your Fin3a ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const settings = await context.queryClient.ensureQueryData(settingsQuery());
    if (!settings?.onboarding_completed) throw redirect({ to: "/onboarding" });
    await context.queryClient.ensureQueryData(docsQuery());
  },
  component: DocumentsPage,
});

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls";

function DocumentsPage() {
  const qc = useQueryClient();
  const { data: docs } = useSuspenseQuery(docsQuery());
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const currency = settings?.currency ?? "USD";
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 15 * 1024 * 1024) return toast.error("File is larger than 15 MB.");
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { document, duplicateOf } = await createDocument({
        data: { filename: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size, storage_path: path },
      });
      if (duplicateOf) toast.warning(`This looks like a file you uploaded before (${duplicateOf.filename}).`);
      await qc.invalidateQueries({ queryKey: ["documents"] });
      setSelected(document.id);
      toast.info("Scanning… this can take up to a minute.");
      const res = await analyzeDocument({ data: { documentId: document.id } });
      toast.success(res.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["drafts"] });
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Scan documents</h1>
          <p className="text-muted-foreground">Bank statements, bills, receipts and POS slips. You review everything before it's saved.</p>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {busy ? "Scanning…" : "Upload & scan"}
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Your documents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {docs.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <ScanLine className="mx-auto mb-2 h-8 w-8" />No documents yet. Upload a PDF, photo, CSV or Excel file.
              </div>
            )}
            {docs.map((d) => (
              <button key={d.id} onClick={() => setSelected(d.id)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${selected === d.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.status === "failed" ? <span className="text-destructive">Failed</span> : d.status}
                    {d.pending_count > 0 && ` · ${d.pending_count} to review`}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected ? <DraftReview documentId={selected} doc={docs.find((d) => d.id === selected)} currency={currency} onDeleted={() => setSelected(null)} />
          : <Card><CardContent className="py-16 text-center text-muted-foreground">Select a document to review its transactions.</CardContent></Card>}
      </div>
    </AppShell>
  );
}

function DraftReview({ documentId, doc, currency, onDeleted }: {
  documentId: string; doc: Awaited<ReturnType<typeof listDocuments>>[number] | undefined; currency: string; onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { data: drafts = [], isLoading } = useQuery(draftsQuery(documentId));
  const pending = drafts.filter((d) => d.status === "pending");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["drafts", documentId] }); qc.invalidateQueries({ queryKey: ["documents"] }); };

  const save = useMutation({ mutationFn: (p: { id: string; txn_date?: string | null; merchant?: string | null; amount?: number; type?: "income" | "expense" }) => updateDraft({ data: p }), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: (id: string) => deleteDraft({ data: { id } }), onSuccess: refresh });
  const imp = useMutation({
    mutationFn: () => importDrafts({ data: { documentId } }),
    onSuccess: (r) => { toast.success(`${r.imported} transactions added to your ledger`); refresh(); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: () => deleteDocument({ data: { documentId } }), onSuccess: () => { refresh(); onDeleted(); } });
  const rescan = useMutation({ mutationFn: () => analyzeDocument({ data: { documentId } }), onSuccess: refresh, onError: (e: Error) => { toast.error(e.message); refresh(); } });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{doc?.filename ?? "Document"}</CardTitle>
          {doc?.error_message && <p className="mt-1 text-sm text-destructive">{doc.error_message}</p>}
          {doc?.summary && !doc.error_message && <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => rescan.mutate()} disabled={rescan.isPending}>
            {rescan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rescan
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete document" onClick={() => del.mutate()}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
        {!isLoading && pending.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">
          {drafts.length ? "Everything from this document is in your ledger." : "No transactions to review."}</p>}
        {pending.map((d) => (
          <div key={d.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[130px_1fr_120px_110px_auto] sm:items-center">
            <Input type="date" defaultValue={d.txn_date ?? ""} onBlur={(e) => e.target.value !== (d.txn_date ?? "") && save.mutate({ id: d.id, txn_date: e.target.value || null })} />
            <div>
              <Input defaultValue={d.merchant ?? d.description ?? ""} placeholder="Description"
                onBlur={(e) => e.target.value !== (d.merchant ?? d.description ?? "") && save.mutate({ id: d.id, merchant: e.target.value || null })} />
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {d.confidence === "low" && <span className="text-warning">Low confidence — check this</span>}
                {d.duplicate_of && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />Possible duplicate</span>}
                {!d.txn_date && <span className="text-destructive">Missing date</span>}
              </div>
            </div>
            <Input type="number" step="0.01" defaultValue={d.amount ?? ""} aria-label={`Amount (${d.currency ?? currency})`}
              onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== d.amount) save.mutate({ id: d.id, amount: v }); }} />
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={d.type}
              onChange={(e) => save.mutate({ id: d.id, type: e.target.value as "income" | "expense" })}>
              <option value="expense">Expense</option><option value="income">Income</option>
            </select>
            <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => remove.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {pending.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">
              {pending.length} lines · {formatMoney(pending.reduce((s, d) => s + (d.type === "expense" ? -1 : 1) * Number(d.amount ?? 0), 0), currency)} net
            </span>
            <Button onClick={() => imp.mutate()} disabled={imp.isPending}>
              {imp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add {pending.length} to ledger
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
