import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight, Bell, Camera, FileText, Loader2, LogOut, Mic,
  PiggyBank, QrCode, Search, Send, Settings, Square, Target, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AssistantUploadMenu } from "@/components/assistant-upload-menu";
import { AssistantComposerFrame } from "@/components/assistant-composer-frame";
import { supabase } from "@/integrations/supabase/client";
import { createThread, getThreadMessages } from "@/lib/assistant.functions";
import { analyzeDocument, createDocument } from "@/lib/documents.functions";
import { getIsAdmin } from "@/lib/admin.functions";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { logQrScan, resolveQrRequest, type QrRequestDetails } from "@/lib/qr-payments.functions";
import { formatQrAmount, parseScannedQr } from "@/lib/qr-payments";
import { cn } from "@/lib/utils";
import { metadataWebSources, safeWebSources } from "@/lib/web-access";
import robot from "@/assets/fin3a-robot.png";
import { CryptoQrReview } from "@/components/crypto-qr-review";
import type { CryptoQr } from "@/lib/crypto-qr";
import { accountHelpIntent, ACCOUNT_HELP_TEXT, type AccountHelpIntent } from "@/lib/account-help";

const QrScanner = lazy(() => import("@/components/qr-scanner").then(module => ({ default: module.QrScanner })));

const SUGGESTIONS = [
  { icon: TrendingUp, text: "How much did I spend last month?" },
  { icon: FileText, text: "What category consumes most of my money?" },
  { icon: PiggyBank, text: "Can I afford a ₦500,000 purchase?" },
  { icon: Wallet, text: "How long can my current balance sustain me?" },
  { icon: FileText, text: "Why are my expenses increasing?" },
  { icon: Target, text: "How much should I save monthly to reach my target?" },
];

const PRIMARY_NAV = [
  { to: "/assistant", label: "Dashboard" },
  { to: "/spending", label: "Spending" },
  { to: "/activity", label: "Activity" },
  { to: "/bills", label: "Bills" },
  { to: "/analysis", label: "Analysis" },
  { to: "/planning", label: "Planning" },
  { to: "/goals", label: "Goals" },
  { to: "/insights", label: "Insights" },
  { to: "/documents", label: "Scan" },
] as const;

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Fin3a AI" },
      { name: "description", content: "Chat with Fin3a AI about your own financial records." },
      { property: "og:title", content: "Dashboard — Fin3a AI" },
      { property: "og:description", content: "Chat with Fin3a AI about your own financial records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ params, context }) => {
    return getThreadMessages({ data: { threadId: params.threadId } });
  },
  component: AssistantPage,
});


function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

function AssistantPage() {
  const { threadId } = Route.useParams();
  const loaded = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery());
  const { data: isAdmin } = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => getIsAdmin(), staleTime: 300_000 });
  const name = settings?.display_name?.trim();

  async function newThread() {
    const t = await createThread();
    await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: t.id } });
  }
  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
    <div className="mx-auto max-w-6xl pb-8 sm:pb-10">

          {loaded ? (
            <ChatWindow key={threadId} threadId={threadId} name={name} />
          ) : (
            <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Conversation not found.</div>
          )}
    </div>
    </AppShell>
  );
}

function ChatWindow({ threadId, name }: { threadId: string; name?: string | undefined }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [accountHelp, setAccountHelp] = useState<AccountHelpIntent | null>(null);
  const [cryptoReview, setCryptoReview] = useState<CryptoQr | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: [],
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      body: { threadId },
    }),
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      inputRef.current?.focus();
    },
    onError: (e) => {
      let msg = e.message;
      try { msg = JSON.parse(e.message).error ?? msg; } catch { /* plain text */ }
      toast.error(msg);
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => () => { void stop(); }, [stop]);
  useEffect(() => {
    const chat = chatScrollRef.current;
    chat?.scrollTo({ top: chat.scrollHeight });
  }, [messages, status]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const help = accountHelpIntent(t);
    if (help) {
      setAccountHelp(help);
      setInput("");
      return;
    }
    setAccountHelp(null);
    sendMessage({ text: t });
    setInput("");
    inputRef.current?.focus();
  }

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Camera / photo scan state
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // QR payment detection state — detection never pays; it only shows a review card.
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [qrCard, setQrCard] = useState<
    | { kind: "request"; details: QrRequestDetails }
    | { kind: "profile"; fin3aId: string }
    | { kind: "external"; url: string }
    | { kind: "invalid" }
    | null
  >(null);

  async function handleQrScan(text: string) {
    const parsed = parseScannedQr(text);
    if (parsed.kind === "crypto") {
      setQrScanOpen(false);
      setCryptoReview(parsed);
    } else if (parsed.kind === "fin3a_request") {
      setQrScanOpen(false);
      try {
        const details = await resolveQrRequest({ data: { requestId: parsed.requestId } });
        setQrCard({ kind: "request", details });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read this payment request");
      }
    } else if (parsed.kind === "fin3a_profile") {
      setQrScanOpen(false);
      void logQrScan({ data: { kind: "fin3a_profile", detail: parsed.fin3aId } });
      setQrCard({ kind: "profile", fin3aId: parsed.fin3aId });
    } else if (parsed.kind === "external") {
      void logQrScan({ data: { kind: "external", detail: parsed.url } });
      setQrCard({ kind: "external", url: parsed.url });
    } else {
      void logQrScan({ data: { kind: "invalid" } });
      setQrCard({ kind: "invalid" });
    }
  }

  async function handleCameraCapture(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image file is larger than 15 MB.");
      return;
    }
    setScanningPhoto(true);
    toast.info("Uploading & scanning receipt/bill…");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again.");

      const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { document, duplicateOf } = await createDocument({
        data: {
          filename: file.name,
          mime_type: file.type || "image/jpeg",
          size_bytes: file.size,
          storage_path: path,
        },
      });

      if (duplicateOf) {
        toast.warning(`This file looks similar to an earlier upload (${duplicateOf.filename}).`);
      }

      const res = await analyzeDocument({ data: { documentId: document.id } });
      await qc.invalidateQueries({ queryKey: ["documents"] });
      await qc.invalidateQueries({ queryKey: ["drafts"] });

      toast.success(res.summary);

      // Submit context message directly to the assistant to categorize and review
      send(`I just took a photo of a receipt/bill (${file.name}). Scan result: ${res.summary}. Please break down the items, category, and date for my records.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to scan photo");
    } finally {
      setScanningPhoto(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return;
        setTranscribing(true);
        try {
          const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
          const fd = new FormData();
          fd.append("file", blob, `recording.${ext}`);
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: fd,
            headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
          const j = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(j.error ?? "Transcription failed.");
          if (!j.text) throw new Error("We didn't catch that. Try speaking a little louder.");
          setInput((prev) => (prev ? `${prev} ${j.text}` : (j.text ?? "")));
          inputRef.current?.focus();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access was blocked. Allow it in your browser to use voice.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const empty = messages.length === 0;

  return (
    <section className="flex flex-col">
      {empty ? (
        <>
          <div className="grid items-center gap-4">
            <div>
              <p className="text-sm font-medium text-foreground/80">{greeting()}{name ? `, ${name}` : ""} 👋</p>
              <h1 className="mt-3 text-4xl font-medium leading-[1.15] tracking-tight sm:text-[46px]">
                How Can I <span className="text-primary">Assist</span>
                <br /><span className="text-primary">You</span> Today?
              </h1>
              <p className="mt-5 max-w-[290px] text-sm leading-relaxed text-muted-foreground">
                Your AI finance assistant to simplify, analyze and help you make smarter financial decisions.
              </p>
            </div>
          </div>

          <h2 className="order-1 mt-8 text-[15px] font-medium">Try Asking Fin3a.</h2>
          <div className="order-3">
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => send(s.text)}
                disabled={busy}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-4 text-left shadow-sm transition-colors hover:border-accent"
              >
                <s.icon className="size-6 shrink-0 text-primary" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">{s.text}</span>
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-foreground group-hover:text-primary">
                  <ArrowRight className="size-4" />
                </span>
              </button>
            ))}
          </div>
          </div>
        </>
      ) : null}

      {qrCard ? (
        <div className="mt-4 flex gap-2">
          <img src={robot} alt="" width={1024} height={1024} className="size-8 shrink-0 object-contain" />
          <div className="min-w-0 flex-1 rounded-2xl border border-accent/40 bg-card p-4 text-sm shadow-sm">
            {qrCard.kind === "request" ? (
              <>
                <p className="font-medium">I've detected a Fin3a payment request.</p>
                {qrCard.details.status === "open" && !qrCard.details.isOwn ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>Recipient: <span className="font-medium text-foreground">{qrCard.details.recipientName}</span></p>
                    <p>Amount: <span className="font-medium text-foreground">{formatQrAmount(qrCard.details.amount ?? null, qrCard.details.currency ?? "NGN")}</span></p>
                    {qrCard.details.description ? <p>For: <span className="text-foreground">{qrCard.details.description}</span></p> : null}
                    <p>Reference: FIN3A payment request</p>
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    {qrCard.details.isOwn ? "This is your own payment request." : `This request is ${qrCard.details.status}.`}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {qrCard.details.status === "open" && !qrCard.details.isOwn && qrCard.details.requestId ? (
                    <Button asChild size="sm"><Link to="/pay/qr/$requestId" params={{ requestId: qrCard.details.requestId }}>Review Payment</Link></Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setQrCard(null)}>Dismiss</Button>
                </div>
              </>
            ) : qrCard.kind === "profile" ? (
              <>
                <p className="font-medium">I've detected a Fin3a payment profile.</p>
                <p className="mt-2 text-muted-foreground">Account: <span className="font-mono text-primary">{qrCard.fin3aId}</span></p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm"><Link to="/pay/$fin3aId" params={{ fin3aId: qrCard.fin3aId }}>Review Payment</Link></Button>
                  <Button variant="ghost" size="sm" onClick={() => setQrCard(null)}>Dismiss</Button>
                </div>
              </>
            ) : qrCard.kind === "external" ? (
              <>
                <p className="font-medium">This is an external QR code, not a Fin3a payment.</p>
                <p className="mt-2 break-all rounded-md bg-secondary p-2 text-xs text-muted-foreground">{qrCard.url}</p>
                <p className="mt-2 text-xs text-muted-foreground">I won't open it automatically. Only visit links you trust.</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(qrCard.url).then(() => toast.success("Link copied"))}>Copy link</Button>
                  <Button variant="ghost" size="sm" onClick={() => setQrCard(null)}>Dismiss</Button>
                </div>
              </>
            ) : (
              <>
                <p className="font-medium">I couldn't read a Fin3a payment from that QR code.</p>
                <p className="mt-2 text-muted-foreground">It may be damaged or not a payment code. No payment was created.</p>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setQrCard(null)}>Dismiss</Button>
              </>
            )}
          </div>
        </div>
      ) : null}
      {qrScanOpen ? <Suspense fallback={<Loader2 className="mt-4 size-5 animate-spin" aria-label="Opening scanner" />}><QrScanner title="Scan a payment QR" onScan={(t) => void handleQrScan(t)} onClose={() => setQrScanOpen(false)} /></Suspense> : null}
      <CryptoQrReview value={cryptoReview} onClose={() => setCryptoReview(null)} />
      {accountHelp && <div role="status" className="order-2 my-4 space-y-3 border-y border-border py-4 text-sm">
        <p>{ACCOUNT_HELP_TEXT[accountHelp]}</p>
        <Button asChild><Link to="/accounts/actions">Open account details &amp; payments</Link></Button>
        <Button variant="ghost" onClick={() => setAccountHelp(null)}>Dismiss</Button>
      </div>}

      <div className={cn("order-2 mt-2 min-w-0", !empty && "overflow-hidden rounded-[22px] border border-accent/40 bg-card shadow-[var(--shadow-lavender)]")} aria-label="Fin3a assistant chat">
      {!empty ? (
        <div ref={chatScrollRef} role="log" aria-label="Fin3a conversation" className="max-h-[420px] min-h-[220px] space-y-4 overflow-y-auto overscroll-contain px-4 py-6 sm:px-5">
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const sources = safeWebSources([...m.parts
              .filter((p) => p.type === "source-url")
              .map((p) => ({ url: (p as { url?: string }).url ?? "", title: (p as { title?: string }).title ?? "" }))
              .filter((s) => s.url), ...metadataWebSources(m.metadata)]);
            return m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] break-words whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{text}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2">
                <img src={robot} alt="" width={1024} height={1024} className="size-8 shrink-0 object-contain" />
                <div className="min-w-0 max-w-[85%] flex-1 space-y-2 rounded-2xl rounded-tl-sm bg-muted/50 px-4 py-3 text-sm break-words leading-relaxed text-foreground [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-border [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border/50 [&_td]:py-1 [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                  {sources.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sources.map((s) => (
                        <a
                          key={s.url}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent hover:text-primary"
                        >
                          {s.title || s.url.replace(/^https?:\/\//, "").split("/")[0]}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Analysing your records…</div>
          ) : null}
          {error && !busy ? <p className="text-sm text-destructive">The last message failed. Please try again.</p> : null}
        </div>
      ) : null}
      <AssistantComposerFrame
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className={cn(!empty && "rounded-none border-0 border-t border-border shadow-none")}
      >
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCameraCapture(f); e.target.value = ""; }}
        />
        <textarea
          ref={inputRef}
          value={input}
          maxLength={4000}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask Fin3a about your finances…"
          className="max-h-40 w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border px-1.5 py-1">
            <AssistantUploadMenu disabled={busy} />
            <span className="pr-2 text-sm font-medium">Attach</span>
          </div>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanningPhoto || recording || busy}
            aria-label="Snap receipt or bill with camera"
            className="grid size-10 place-items-center rounded-full border border-border text-foreground hover:text-primary disabled:opacity-50"
          >
            {scanningPhoto ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setQrScanOpen(true)}
            disabled={busy}
            aria-label="Scan a payment QR code"
            title="Scan a payment QR code"
            className="grid size-10 place-items-center rounded-full border border-border text-foreground hover:text-primary disabled:opacity-50"
          >
            <QrCode className="size-4" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing || busy || scanningPhoto}
              aria-label={recording ? "Stop recording" : "Record voice"}
              className={cn("flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium disabled:opacity-50", recording && "border-destructive text-destructive")}
            >
              <span className="hidden sm:inline">{recording ? "Stop" : "Voice"}</span>
              {transcribing ? <Loader2 className="size-4 animate-spin" /> : recording ? <Square className="size-4" /> : <Mic className="size-4 text-muted-foreground" />}
            </button>
            {busy ? (
              <button type="button" onClick={() => stop()} aria-label="Stop" className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
                <Square className="size-4" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || recording || scanningPhoto} aria-label="Send" className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-md disabled:opacity-60">
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Answers from your own records · not financial advice</p>
      </AssistantComposerFrame>
      </div>
    </section>
  );
}
