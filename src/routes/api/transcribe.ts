import { createFileRoute } from "@tanstack/react-router";
import { consumeQuota, jsonError, verifyBearer } from "@/lib/api-auth.server";

// Signed-in speech-to-text. Audio is forwarded to OpenAI and not stored.
const MAX_BYTES = 10 * 1024 * 1024;
export const TRANSCRIBE_HOURLY_LIMIT = 30;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyBearer(request);
        if ("error" in auth) return auth.error;
        const apiKey = process.env["OPENAI_API_KEY"];
        if (!apiKey) return jsonError(500, "Voice input is not configured yet.");

        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || file.size === 0) return jsonError(400, "No audio received.");
        if (file.size > MAX_BYTES) return jsonError(413, "Recording is too long.");
        if (file.type && !file.type.startsWith("audio/") && !file.type.startsWith("video/webm")) return jsonError(415, "Unsupported audio format.");

        if (!(await consumeQuota(auth.supabase, "transcribe", TRANSCRIBE_HOURLY_LIMIT, 3600))) {
          return jsonError(429, "You've reached the hourly voice limit. Try again later.");
        }

        const upstream = new FormData();
        upstream.append("file", file, file.name || "recording.webm");
        upstream.append("model", "gpt-4o-mini-transcribe");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        if (!res.ok) {
          console.error("transcribe failed", res.status);
          return jsonError(res.status === 429 ? 429 : 502, "Couldn't understand the recording. Please try again.");
        }
        const json = (await res.json()) as { text?: string };
        return Response.json({ text: (json.text ?? "").trim() });
      },
    },
  },
});
