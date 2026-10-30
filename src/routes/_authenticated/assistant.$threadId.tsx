import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2, MessageSquarePlus, Square, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { createThread, deleteThread, getThreadMessages, listThreads } from "@/lib/assistant.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What category consumes most of my money?",
  "Compare my spending this month with last month.",
  "How long can my current money sustain me?",
  "What happens if my income increases by 20%?",
  "Identify unusual spending patterns.",
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
              Spending, runway, affordability and what-if scenarios — calculated from what you've recorded in Fin3a.
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
            <div key={m.id} className="prose prose-sm prose-invert max-w-none text-sm text-foreground [&_table]:text-xs">
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
        <textarea
          ref={inputRef}
          value={input}
          maxLength={4000}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          placeholder="Ask about your spending, runway, a purchase…"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {busy ? (
          <Button type="button" size="icon" variant="secondary" onClick={() => stop()} aria-label="Stop">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
    </section>
  );
}
