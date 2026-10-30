import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public, anonymous Fin3a AI preview for landing-page visitors.
// No database access and no personal data: general financial education only.
const MODEL = "gpt-5-mini";
const hits = new Map<string, number[]>();

const VISITOR_INSTRUCTIONS = `You are Fin3a AI, a personal financial intelligence assistant, talking to a visitor on the public website who is NOT signed in.
- You have NO access to their financial records. Never pretend to know their income, spending or balances.
- Give clear, practical, general financial guidance (budgeting, saving, emergency funds, debt, cash flow, runway) in plain language. Keep answers short (under 180 words) and use simple markdown-free text with short lists when helpful.
- When the question needs their real numbers, explain the general method and invite them to create a free Fin3a account for personalized analysis.
- Do not give crypto, trading or specific investment-product recommendations.`;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(12),
});

export const Route = createFileRoute("/api/public/visitor-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "anon";
        const now = Date.now();
        const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
        if (recent.length >= 15) {
          return Response.json({ error: "You've reached the visitor limit. Sign up free to keep chatting." }, { status: 429 });
        }
        recent.push(now);
        hits.set(ip, recent);

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid message." }, { status: 400 });

        const apiKey = process.env["OPENAI_API_KEY"];
        if (!apiKey) return Response.json({ error: "Fin3a AI is not configured yet." }, { status: 500 });

        const { streamText } = await import("ai");
        const { createOpenAI } = await import("@ai-sdk/openai");
        const openai = createOpenAI({ apiKey });
        const result = streamText({
          model: openai.responses(MODEL),
          system: VISITOR_INSTRUCTIONS,
          messages: parsed.data.messages,
          providerOptions: { openai: { store: false, reasoningEffort: "low" } },
        });
        return result.toTextStreamResponse();
      },
    },
  },
});
