import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { beginAiUsage, finishAiUsage } from "@/lib/api-auth.server";
import { publicSearchQuery } from "@/lib/web-access";

const MODEL = "gpt-5-mini";
const HOURLY_LIMIT = 40;

const bodySchema = z.object({
  threadId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        id: z.string().max(100),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.any()).max(50),
      }).passthrough(),
    )
    .min(1)
    .max(200),
});

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textOf(parts: unknown[]): string {
  return parts
    .map((p) => (p && typeof p === "object" && (p as { type?: string }).type === "text" ? String((p as { text?: string }).text ?? "") : ""))
    .join("");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const openaiKey = process.env["OPENAI_API_KEY"];
        if (!url || !key) return json(500, "Server is not configured.");
        if (!openaiKey) return json(500, "The AI assistant is not configured yet.");

        const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
        if (token.split(".").length !== 3) return json(401, "Please sign in again.");

        const supabase = createClient<Database>(url, key, {
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (authErr || !userId) return json(401, "Please sign in again.");

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json(400, "Invalid request.");
        }

        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id, title")
          .eq("id", body.threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return json(404, "Conversation not found.");

        const last = body.messages[body.messages.length - 1];
        if(!last)return json(400,"Message is empty.");
        const userText = textOf(last.parts).trim();
        if (last.role !== "user" || !userText) return json(400, "Message is empty.");
        if (userText.length > 4000) return json(400, "Message is too long (max 4,000 characters).");

        // Rate limit: user messages in the last hour.
        const since = new Date(Date.now() - 3600_000).toISOString();
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("role", "user")
          .gte("created_at", since);
        if ((count ?? 0) >= HOURLY_LIMIT) {
          return json(429, "You've reached the hourly message limit. Please try again a little later.");
        }

        const usage = await beginAiUsage(supabase, "assistant", `chat:${thread.id}:${last.id}`.slice(0, 200));
        if (!usage.allowed) return json(usage.reason === "duplicate" ? 409 : 429, usage.message);

        const { error: saveErr } = await supabase.from("chat_messages").upsert(
          {
            thread_id: thread.id,
            user_id: userId,
            message_id: last.id,
            role: "user",
            parts: [{ type: "text", text: userText }],
          },
          { onConflict: "thread_id,message_id" },
        );
        if (saveErr) {
          console.error("save user message", saveErr);
          return json(500, "Could not save your message.");
        }
        const threadPatch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
        if (thread.title === "New conversation") threadPatch.title = userText.slice(0, 60);
        await supabase.from("chat_threads").update(threadPatch).eq("id", thread.id);

        const { buildFinancialSnapshot, ASSISTANT_INSTRUCTIONS } = await import("@/lib/assistant-context.server");
        const snapshot = await buildFinancialSnapshot(supabase, userId);

        const { streamText, convertToModelMessages } = await import("ai");
        const { createOpenAI } = await import("@ai-sdk/openai");
        const openai = createOpenAI({ apiKey: openaiKey });
        const { finishWeb, reserveWeb, searchPublicInformation, webEvidence } = await import("@/lib/web-access.server");
        const query = publicSearchQuery(userText);
        let evidence = "";
        let sources: import("@/lib/web-access").WebSource[] = [];
        let webInput: number | undefined;
        let webOutput: number | undefined;
        if (query) {
          if (!(await reserveWeb(supabase, usage.usageId, false))) {
            await finishAiUsage(supabase, usage.usageId, false, { model: MODEL }, "web_budget");
            return json(429, "Web search is unavailable within the current spending allowance.");
          }
          try {
            const web = await searchPublicInformation(query, openaiKey, request.signal);
            evidence = webEvidence(web.text);
            sources = web.sources;
            webInput = web.input;
            webOutput = web.output;
          } catch {
            await finishWeb(supabase, usage.usageId, false, false);
            return json(503, "Web search could not be completed. Please try again later.");
          }
        }

        // Only the last 30 text turns are sent, stripped to plain text.
        const history = body.messages.slice(-30).map((m) => ({
          id: m.id,
          role: m.role === "system" ? ("user" as const) : m.role,
          parts: [{ type: "text" as const, text: textOf(m.parts).slice(0, 8000) }],
        }));

        const result = streamText({
          model: openai.responses(MODEL),
          system: `${ASSISTANT_INSTRUCTIONS}${evidence}\nWithout public web evidence do not claim live information.\n\nUSER FINANCIAL SNAPSHOT (JSON):\n${JSON.stringify(snapshot)}`,
          messages: await convertToModelMessages(history),
          maxOutputTokens: 1200,
          maxRetries: 0,
          abortSignal: request.signal,
          providerOptions: { openai: { store: false, reasoningEffort: "low" } },
          onFinish: ({ totalUsage }) => query
            ? finishWeb(supabase, usage.usageId, false, true, webInput !== undefined && totalUsage.inputTokens !== undefined ? webInput + totalUsage.inputTokens : undefined, webOutput !== undefined && totalUsage.outputTokens !== undefined ? webOutput + totalUsage.outputTokens : undefined)
            : finishAiUsage(supabase, usage.usageId, true, { model: MODEL, input: totalUsage.inputTokens ?? null, cached: totalUsage.inputTokenDetails?.cacheReadTokens ?? null, output: totalUsage.outputTokens ?? null }),
          onError: () => query ? finishWeb(supabase, usage.usageId, false, false) : finishAiUsage(supabase, usage.usageId, false, { model: MODEL }, "stream_error"),
          onAbort: () => query ? finishWeb(supabase, usage.usageId, false, false) : finishAiUsage(supabase, usage.usageId, false, { model: MODEL }, "aborted"),
        });

        return result.toUIMessageStreamResponse({
          ...(usage.warning ? { headers: { "x-ai-usage-warning": encodeURIComponent(usage.warning) } } : {}),
          originalMessages: history,
          messageMetadata: ({ part }) => part.type === "start" ? { webSources: sources } : undefined,
          generateMessageId: () => crypto.randomUUID(),
          onError: (err) => {
            console.error("assistant stream error", err);
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 401) return "The OpenAI key was rejected. Please check it in project settings.";
            if (status === 429) return "OpenAI is rate-limiting or out of quota. Please try again shortly.";
            return "The assistant couldn't answer right now. Please try again.";
          },
          onFinish: async ({ responseMessage }) => {
            const text = textOf(responseMessage.parts as unknown[]);
            if (!text) return;
            const { error } = await supabase.from("chat_messages").upsert(
              {
                thread_id: thread.id,
                user_id: userId,
                message_id: responseMessage.id || crypto.randomUUID(),
                role: "assistant",
                parts: [{ type: "text", text }],
              },
              { onConflict: "thread_id,message_id" },
            );
            if (error) console.error("save assistant message", error);
          },
        });
      },
    },
  },
});
