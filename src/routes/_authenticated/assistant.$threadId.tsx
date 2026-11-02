import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Camera, Loader2, MessageSquarePlus, Mic, Square, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { createThread, deleteThread, getThreadMessages, listThreads } from "@/lib/assistant.functions";
import { analyzeDocument, createDocument } from "@/lib/documents.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "How much did I spend last month?",
  "What category consumes most of my money?",
  "Can I afford a ₦500,000 purchase?",
  "How long can my current balance sustain me?",
  "How much did I spend on transportation this year?",
  "Why are my expenses increasing?",
  "How much should I save monthly to reach my target?",
];

const threadsQuery = { queryKey: ["chat-threads"], queryFn: () => listThreads() };

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conversation — Fin3a AI Assistant" },
      { name: "description", content: "Chat with Fin3a AI about your own financial records." },
      { property: "og:title", content: "Conversation — Fin3a AI Assistant" },
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

function AssistantPage() {
  const { threadId } = Route.useParams();
  const loaded = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: threads = [] } = useQuery(threadsQuery);

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

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-border bg-card p-3 md:h-[calc(100vh-9rem)] md:overflow-y-auto">
          <Button onClick={newThread} className="mb-3 w-full" size="sm">
            <MessageSquarePlus className="size-4" /> New conversation
          </Button>
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {threads.map((t) => (
              <li key={t.id} className="group flex shrink-0 items-center gap-1">
                <Link
                  to="/assistant/$threadId"
                  params={{ threadId: t.id }}
                  className={cn(
                    "block max-w-[180px] truncate rounded-md px-2 py-1.5 text-sm md:max-w-none md:flex-1",
                    t.id === threadId ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.title}
                </Link>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={() => removeThread(t.id)}
                  className="rounded p-1 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {loaded ? (
          <ChatWindow key={threadId} threadId={threadId} initialMessages={loaded.messages as UIMessage[]} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Conversation not found.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
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
          const res = await fetch("/api/public/transcribe", { method: "POST", body: fd });
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

  return (
    <section className="flex h-[calc(100vh-13rem)] flex-col rounded-xl border border-border bg-card md:h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
          <TrendingUp className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Fin3a Assistant</p>
          <p className="text-xs text-muted-foreground">Answers from your own records · not financial advice</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-lg pt-6 text-center">
            <h2 className="font-display text-xl font-semibold">Ask about your money</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Spending, runway, affordability, and receipts — calculated from what you've recorded in Fin3a.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                {text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="max-w-none space-y-2 text-sm leading-relaxed text-foreground [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-border [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border/50 [&_td]:py-1 [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          );
        })}

        {status === "submitted" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Analysing your records…
          </div>
        ) : null}
        {error && !busy ? (
          <p className="text-sm text-destructive">The last message failed. Please try again.</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        {/* Hidden Camera Input for direct photo capture / file selection */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCameraCapture(f);
            e.target.value = "";
          }}
        />

        <textarea
          ref={inputRef}
          value={input}
          maxLength={4000}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          placeholder="Ask about your spending, runway, or snap a receipt…"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {/* Camera capture button */}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={() => cameraInputRef.current?.click()}
          disabled={scanningPhoto || recording || busy}
          aria-label="Snap receipt or bill with camera"
          title="Take photo of receipt or bill"
        >
          {scanningPhoto ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </Button>

        {/* Voice recording button */}
        <Button
          type="button"
          size="icon"
          variant={recording ? "destructive" : "secondary"}
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing || busy || scanningPhoto}
          aria-label={recording ? "Stop recording" : "Record voice"}
        >
          {transcribing ? <Loader2 className="size-4 animate-spin" /> : recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </Button>

        {busy ? (
          <Button type="button" size="icon" variant="secondary" onClick={() => stop()} aria-label="Stop">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim() || recording || scanningPhoto} aria-label="Send">
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
    </section>
  );
}
