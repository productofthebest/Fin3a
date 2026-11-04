import { createHmac } from "node:crypto";
import { GUEST_INSTRUCTIONS, GUEST_MAX_OUTPUT, GUEST_MODEL, guestLimitMessage, guestMessageSchema, isGuestOriginAllowed } from "./guest-chat";
import { homepageSearchQuestion } from "./homepage-web";
import { readOnlyAssistantOptions } from "./assistant-read-only";
import { finishWeb, reserveWeb, searchPublicInformation, webEvidence } from "./web-access.server";

export async function guestChatResponse(request: Request) {
  if (!isGuestOriginAllowed(request)) return Response.json({ error: "Please ask from the Fin3a homepage." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 12000) return Response.json({ error: "Message is too long." }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 12000) return Response.json({ error: "Message is too long." }, { status: 413 });
  const parsed = guestMessageSchema.safeParse(await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a question of up to 2,000 characters." }, { status: 400 });
  const publicQuestion = homepageSearchQuestion(parsed.data.message);
  if (publicQuestion.error) return Response.json({ error: publicQuestion.error }, { status: 400 });
  const apiKey = process.env["OPENAI_API_KEY"];
  const secret = process.env["GUEST_CHAT_HASH_SECRET"];
  if (!apiKey || !secret) return Response.json({ error: "Fin3a AI is not configured yet." }, { status: 503 });

  // Only the edge-supplied network identity is used. Missing identity shares a conservative bucket;
  // client cookies and untrusted forwarded headers cannot reset the allowance.
  const network = request.headers.get("cf-connecting-ip") ?? "shared-unidentified-network";
  const networkHash = createHmac("sha256", secret).update(`guest-chat:${network}`).digest("hex");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("ai_guest_begin", { _network_hash: networkHash });
  const admission = data as { allowed?: boolean; reason?: string; usage_id?: string; warning?: string } | null;
  if (error || !admission?.allowed || !admission.usage_id) return Response.json({ error: guestLimitMessage(admission?.reason) }, { status: error ? 503 : 429 });
  const usageId = admission.usage_id;
  // Company identity questions use the official Top Floor site retrieval, not a paid web search.
  const { isCompanyIdentityQuestion } = await import("./topfloor");
  const companyQuestion = isCompanyIdentityQuestion(parsed.data.message);
  const query = companyQuestion ? null : publicQuestion.query;
  let webReserved = false;
  let searchInput: number | undefined;
  let searchOutput: number | undefined;
  let evidence = "";
  let companyBlock = "";
  if (companyQuestion) {
    const { companyIdentityBlock, getTopFloorKnowledge } = await import("./topfloor-knowledge.server");
    companyBlock = companyIdentityBlock(await getTopFloorKnowledge(request.signal));
  }
  let sources: import("./web-access").WebSource[] = [];
  const finish = async (ok: boolean, input?: number, output?: number) => {
    if (webReserved) {
      await finishWeb(supabaseAdmin, usageId, true, ok, input !== undefined && searchInput !== undefined ? input + searchInput : undefined, output !== undefined && searchOutput !== undefined ? output + searchOutput : undefined);
      return;
    }
    // Null counts keep the reservation rather than turning an uncertain paid request into zero cost.
    const { error: finishError } = await supabaseAdmin.rpc("ai_guest_finish", { _id: usageId, _ok: ok, _input: input ?? -1, _output: output ?? -1 });
    if (finishError) console.error("Guest AI usage finalization failed");
  };
  try {
    if (query) {
      webReserved = await reserveWeb(supabaseAdmin, usageId, true);
      if (!webReserved) {
        await finish(false);
        return Response.json({ error: "Web search has reached its spending allowance. Please try again later." }, { status: 429 });
      }
      const web = await searchPublicInformation(query, apiKey, request.signal, true);
      searchInput = web.input;
      searchOutput = web.output;
      evidence = webEvidence(web.text);
      sources = web.sources;
    }
    const { streamText } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const result = streamText(readOnlyAssistantOptions({
      model: createOpenAI({ apiKey }).responses(GUEST_MODEL),
      system: GUEST_INSTRUCTIONS + companyBlock + evidence,
      messages: [{ role: "user", content: parsed.data.message }],
      maxOutputTokens: GUEST_MAX_OUTPUT,
      maxRetries: 0,
      abortSignal: request.signal,
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
      onFinish: ({ totalUsage }) => finish(true, totalUsage.inputTokens, totalUsage.outputTokens),
      onError: () => finish(false),
      onAbort: () => finish(false),
    }));
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (sources.length) headers.set("x-fin3a-web-sources", encodeURIComponent(JSON.stringify(sources)));
    if (admission.warning) headers.set("x-ai-usage-warning", encodeURIComponent(admission.warning));
    return result.toTextStreamResponse({ headers });
  } catch {
    await finish(false);
    return Response.json({ error: "Fin3a AI could not answer. Please try again later." }, { status: 503 });
  }
}