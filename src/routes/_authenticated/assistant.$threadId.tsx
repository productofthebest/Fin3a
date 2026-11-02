import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight, Bell, Camera, ChevronDown, FileText, History, Loader2, LogOut, MessageSquarePlus, Mic,
  PiggyBank, Search, Send, Settings, Square, Target, Trash2, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AssistantUploadMenu } from "@/components/assistant-upload-menu";
import { supabase } from "@/integrations/supabase/client";
import { createThread, deleteThread, getThreadMessages, listThreads } from "@/lib/assistant.functions";
import { analyzeDocument, createDocument } from "@/lib/documents.functions";
import { getIsAdmin } from "@/lib/admin.functions";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import robot from "@/assets/fin3a-robot.png";


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
  { to: "/categories", label: "Categories" },
  { to: "/bills", label: "Bills" },
  { to: "/analysis", label: "Analysis" },
  { to: "/planning", label: "Planning" },
  { to: "/goals", label: "Goals" },
  { to: "/insights", label: "Insights" },
  { to: "/documents", label: "Scan" },
] as const;

const threadsQuery = { queryKey: ["chat-threads"], queryFn: () => listThreads() };

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
    await context.queryClient.ensureQueryData(threadsQuery);
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
  const { data: threads = [] } = useQuery(threadsQuery);
  const { data: settings } = useQuery(settingsQuery());
  const { data: isAdmin } = useQuery({ queryKey: ["admin", "is-admin"], queryFn: () => getIsAdmin(), staleTime: 300_000 });
  const name = settings?.display_name?.trim();

  async function newThread() {
    const t = await createThread();
    await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: t.id } });
  }
  async function removeThread(id: string) {
    await deleteThread({ data: { threadId: id } });
    await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    if (id === threadId) navigate({ to: "/assistant" });
  }
  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    await navigate({ to: "/auth", replace: true });
  }

  const current = threads.find((t) => t.id === threadId);

  return (
    <AppShell>
    <div className="px-0 py-2">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10">

          {/* Conversations */}
          <div className="mt-5 flex items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex min-w-0 max-w-[60%] items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <History className="size-3.5 shrink-0" /><span className="truncate">{current?.title ?? "Conversations"}</span><ChevronDown className="size-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="theme-lavender max-h-80 w-72 overflow-y-auto">
                {threads.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <DropdownMenuItem asChild className={cn("flex-1 truncate", t.id === threadId && "bg-secondary")}>
                      <Link to="/assistant/$threadId" params={{ threadId: t.id }}><span className="truncate">{t.title}</span></Link>
                    </DropdownMenuItem>
                    <button type="button" aria-label="Delete conversation" onClick={() => removeThread(t.id)} className="rounded p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" onClick={newThread} className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              <MessageSquarePlus className="size-3.5" /> New
            </button>
          </div>

          {loaded ? (
            <ChatWindow key={threadId} threadId={threadId} initialMessages={loaded.messages as UIMessage[]} name={name} />
          ) : (
            <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Conversation not found.</div>
          )}
        </div>
      </div>
    </div>
    </AppShell>
  );
}

function ChatWindow({ threadId, initialMessages, name }: { threadId: string; initialMessages: UIMessage[]; name?: string | undefined }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
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

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
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
          <div className="grid items-center gap-4 md:grid-cols-[1fr_300px]">
            <div className="order-2 md:order-1">
              <p className="text-sm font-medium text-foreground/80">{greeting()}{name ? `, ${name}` : ""} 👋</p>
              <h1 className="mt-3 text-4xl font-medium leading-[1.15] tracking-tight sm:text-[46px]">
                How Can I <span className="text-primary">Assist</span>
                <br /><span className="text-primary">You</span> Today?
              </h1>
              <p className="mt-5 max-w-[290px] text-sm leading-relaxed text-muted-foreground">
                Your AI finance assistant to simplify, analyze and help you make smarter financial decisions.
              </p>
            </div>
            <div className="relative order-1 mx-auto size-48 md:order-2 md:size-[260px]">
              <div className="absolute inset-4 rounded-full bg-[var(--lavender-glow)] blur-2xl" />
              <img src={robot} alt="Fin3a assistant" width={1024} height={1024} className="relative size-full object-contain" />
            </div>
          </div>

          <h2 className="mt-8 text-[15px] font-medium">Try Asking Fin3a.</h2>
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
        </>
      ) : (
        <div className="mt-4 max-h-[60vh] min-h-[300px] space-y-4 overflow-y-auto rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            return m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{text}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2">
                <img src={robot} alt="" width={1024} height={1024} className="size-8 shrink-0 object-contain" />
                <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-foreground [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-border [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border/50 [&_td]:py-1 [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                </div>
              </div>
            );
          })}
          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Analysing your records…</div>
          ) : null}
          {error && !busy ? <p className="text-sm text-destructive">The last message failed. Please try again.</p> : null}
          <div ref={bottomRef} />
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-7 rounded-[22px] border border-accent/40 bg-card px-4 pb-4 pt-4 shadow-[var(--shadow-lavender)] sm:px-5"
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
      </form>
    </section>
  );
}
