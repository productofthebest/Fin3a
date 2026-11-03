import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { beginAiUsage, consumeQuota, finishAiUsage, jsonError, verifyBearer } from "@/lib/api-auth.server";

// Signed-in homepage requests use only the verified caller's aggregate financial records.
const MODEL = "gpt-5-mini";
const HOURLY_LIMIT = 20;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.literal("user").or(z.literal("assistant")), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(12),
});

export const Route = createFileRoute("/api/landing-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyBearer(request);
        if ("error" in auth) return auth.error;
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return jsonError(400, "Invalid message.");
        // Only the latest turn may be a user turn; earlier assistant turns are context only.
        if (parsed.data.messages.at(-1)?.role !== "user") return jsonError(400, "Invalid message.");
        const apiKey = process.env["OPENAI_API_KEY"];
        if (!apiKey) return jsonError(500, "Fin3a AI is not configured yet.");
        if (!(await consumeQuota(auth.supabase, "landing_chat", HOURLY_LIMIT, 3600))) {
          return jsonError(429, "You've reached the hourly limit here. Open the Assistant in your dashboard to continue.");
        }

        const usage = await beginAiUsage(auth.supabase, "landing_chat", null);
        if (!usage.allowed) return jsonError(429, usage.message);

        const { buildFinancialSnapshot, ASSISTANT_INSTRUCTIONS } = await import("@/lib/assistant-context.server");
        let snapshot;
        try {
          snapshot = await buildFinancialSnapshot(auth.supabase, auth.userId);
        } catch {
          await finishAiUsage(auth.supabase, usage.usageId, false, { model: MODEL }, "snapshot_error");
          return jsonError(503, "Your records could not be read. Please try again later.");
        }
        const { streamText } = await import("ai");
        const { createOpenAI } = await import("@ai-sdk/openai");
        const openai = createOpenAI({ apiKey });
        const result = streamText({
          model: openai.responses(MODEL),
          system: `${ASSISTANT_INSTRUCTIONS}\nNo web search tool is available in this homepage conversation; do not claim live information.\nVERIFIED FINANCIAL SNAPSHOT:\n${JSON.stringify(snapshot)}`,
          // Never accept browser-authored assistant/system history as trusted context.
          messages: [{ role: "user", content: parsed.data.messages.at(-1)?.content ?? "" }],
          maxOutputTokens: 1200,
          providerOptions: { openai: { store: false, reasoningEffort: "low" } },
          onFinish: ({ totalUsage }) => finishAiUsage(auth.supabase, usage.usageId, true, { model: MODEL, input: totalUsage.inputTokens ?? null, cached: totalUsage.inputTokenDetails?.cacheReadTokens ?? null, output: totalUsage.outputTokens ?? null }),
          onError: () => finishAiUsage(auth.supabase, usage.usageId, false, { model: MODEL }, "stream_error"),
        });
        return result.toTextStreamResponse(usage.warning ? { headers: { "x-ai-usage-warning": encodeURIComponent(usage.warning) } } : undefined);
      },
    },
  },
});
