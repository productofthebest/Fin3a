import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Mic, Send, Sparkles, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authenticationIntent, type AuthMethod } from "@/lib/auth-options";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How much should I keep as an emergency fund?",
  "What's a simple way to start budgeting?",
  "How do I know how long my money will last?",
  "Should I pay off debt or save first?",
];

export function LandingAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChoice, setAuthChoice] = useState<AuthMethod | "choose" | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const intent = authenticationIntent(content);
    if (intent) {
      setAuthChoice(intent);
      setInput("");
      setError(null);
      return;
    }
    setAuthChoice(null);
    setError(null);
    const history: Msg[] = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/public/visitor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Fin3a AI is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) throw new Error("No answer came back. Please try again.");
    } catch (e) {
      setMessages(history);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
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
        } catch (e) {
          setError(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser to use voice.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <section id="try-fin3a-ai" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-[0_0_80px_-30px] shadow-primary/50">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-8">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="size-4 text-primary" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">Try Fin3a AI</h2>
            <p className="text-xs text-muted-foreground">General guidance only — sign up for answers based on your own records.</p>
          </div>
        </div>

        <div ref={scrollRef} className="max-h-[420px] min-h-[220px] space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted/50 px-4 py-3 text-sm">
            Your money. Your time. Your intelligence. What would you like to understand about your finances?
          </div>
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted/50"}`}>
                {m.content || <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Thinking…</span>}
              </div>
            </div>
          ))}
          {authChoice && <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm">Welcome back! How would you like to access your account?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant={authChoice === "email" ? "secondary" : "default"}><Link to="/auth" search={{ method: "phone", mode: "signin" }}>Continue with phone number</Link></Button>
              <Button asChild variant={authChoice === "phone" ? "secondary" : "default"} className="whitespace-normal"><Link to="/auth" search={{ method: "email", mode: "signin" }}>Continue with email and password</Link></Button>
            </div>
          </div>}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.length >= 2 && !loading && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              Want answers based on your real income and spending?
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm"><Link to="/auth" search={{ mode: "signup", method: "email" }}>Sign up free</Link></Button>
                <Button asChild size="sm" variant="ghost"><Link to="/auth">Log in</Link></Button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          {error && <p className="mb-2 px-1 text-xs text-destructive">{error}</p>}
          {(recording || transcribing) && (
            <p className="mb-2 flex items-center gap-2 px-1 text-xs text-primary">
              {recording ? <><span className="size-2 animate-pulse rounded-full bg-destructive" />Recording… tap stop when you're done</> : <><Loader2 className="size-3 animate-spin" />Turning your voice into text…</>}
            </p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask about budgeting, saving, debt…"
              rows={1}
              maxLength={2000}
              className="min-h-11 resize-none"
              aria-label="Your question"
            />
            <Button type="button" size="icon" variant={recording ? "destructive" : "secondary"} className="size-11 shrink-0"
              onClick={recording ? stopRecording : startRecording} disabled={transcribing || loading}
              aria-label={recording ? "Stop recording" : "Record voice"}>
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button type="submit" size="icon" className="size-11 shrink-0" disabled={loading || !input.trim() || recording} aria-label="Send">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
