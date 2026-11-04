import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { beginAiUsage, consumeQuota, finishAiUsage, jsonError, verifyBearer } from "@/lib/api-auth.server";
import { homepageSearchQuestion } from "@/lib/homepage-web";
import { readOnlyAssistantOptions, adminInformationRequest, ADMIN_INFORMATION_REFUSAL } from "@/lib/assistant-read-only";

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
        if (adminInformationRequest(parsed.data.messages.at(-1)?.content ?? "")) return jsonError(403, ADMIN_INFORMATION_REFUSAL);
        const publicQuestion = homepageSearchQuestion(parsed.data.messages.at(-1)?.content ?? "");
        if (publicQuestion.error) return jsonError(400, publicQuestion.error);
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
        const { finishWeb, reserveWeb, searchPublicInformation, webEvidence } = await import("@/lib/web-access.server");
        // Company identity questions use the official Top Floor site retrieval, not a paid web search.
        const { isCompanyIdentityQuestion } = await import("@/lib/topfloor");
        const companyQuestion = isCompanyIdentityQuestion(parsed.data.messages.at(-1)?.content ?? "");
        const query = companyQuestion ? null : publicQuestion.query;
        let evidence = "";
        let sources: import("@/lib/web-access").WebSource[] = [];
        let webInput: number | undefined;
        let webOutput: number | undefined;
        let companyBlock = "";
        if (companyQuestion) {
          const { companyIdentityBlock, getTopFloorKnowledge } = await import("@/lib/topfloor-knowledge.server");
          companyBlock = companyIdentityBlock(await getTopFloorKnowledge(request.signal));
        }
        if (query) {
          if (!(await reserveWeb(auth.supabase, usage.usageId, false))) {
            await finishAiUsage(auth.supabase, usage.usageId, false, { model: MODEL }, "web_budget");
            return jsonError(429, "Web search is unavailable within the current spending allowance.");
          }
          try {
            const web = await searchPublicInformation(query, apiKey, request.signal, true);
            evidence = webEvidence(web.text);
            sources = web.sources;
            webInput = web.input;
            webOutput = web.output;
          } catch {
            await finishWeb(auth.supabase, usage.usageId, false, false);
            return jsonError(503, "Web search could not be completed. Please try again later.");
          }
        }
        const result = streamText({
          ...readOnlyAssistantOptions(),
          model: openai.responses(MODEL),
          system: `${ASSISTANT_INSTRUCTIONS}\nYou may also answer general public questions on science, technology, sports, history, travel and current events. Do not force unrelated questions into a financial interpretation. Retain ordinary safety restrictions.${companyBlock}${evidence}\nWithout public web evidence do not claim live information.\nVERIFIED FINANCIAL SNAPSHOT:\n${JSON.stringify(snapshot)}`,
          // Never accept browser-authored assistant/system history as trusted context.
          messages: [{ role: "user", content: parsed.data.messages.at(-1)?.content ?? "" }],
          maxOutputTokens: 1200,
          providerOptions: { openai: { store: false, reasoningEffort: "low" } },
          maxRetries: 0,
          abortSignal: request.signal,
          onFinish: ({ totalUsage }) => query
            ? finishWeb(auth.supabase, usage.usageId, false, true, webInput !== undefined && totalUsage.inputTokens !== undefined ? webInput + totalUsage.inputTokens : undefined, webOutput !== undefined && totalUsage.outputTokens !== undefined ? webOutput + totalUsage.outputTokens : undefined)
            : finishAiUsage(auth.supabase, usage.usageId, true, { model: MODEL, input: totalUsage.inputTokens ?? null, cached: totalUsage.inputTokenDetails?.cacheReadTokens ?? null, output: totalUsage.outputTokens ?? null }),
          onError: () => query ? finishWeb(auth.supabase, usage.usageId, false, false) : finishAiUsage(auth.supabase, usage.usageId, false, { model: MODEL }, "stream_error"),
          onAbort: () => query ? finishWeb(auth.supabase, usage.usageId, false, false) : finishAiUsage(auth.supabase, usage.usageId, false, { model: MODEL }, "aborted"),
        });
        const headers = new Headers({ "Cache-Control": "no-store" });
        if (usage.warning) headers.set("x-ai-usage-warning", encodeURIComponent(usage.warning));
        if (sources.length) headers.set("x-fin3a-web-sources", encodeURIComponent(JSON.stringify(sources)));
        return result.toTextStreamResponse({ headers });
      },
    },
  },
});
