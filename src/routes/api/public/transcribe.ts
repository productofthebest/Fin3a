import { createFileRoute } from "@tanstack/react-router";

// Speech-to-text for the landing-page Fin3a AI. Audio is forwarded to OpenAI and not stored.
const MAX_BYTES = 10 * 1024 * 1024;
const hits = new Map<string, number[]>();

export const Route = createFileRoute("/api/public/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "anon";
        const now = Date.now();
        const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
        if (recent.length >= 20) return Response.json({ error: "Too many recordings. Try again later." }, { status: 429 });
        recent.push(now);
        hits.set(ip, recent);

        const apiKey = process.env["OPENAI_API_KEY"];
        if (!apiKey) return Response.json({ error: "Voice input is not configured yet." }, { status: 500 });

        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No audio received." }, { status: 400 });
        if (file.size > MAX_BYTES) return Response.json({ error: "Recording is too long." }, { status: 413 });

        const upstream = new FormData();
        upstream.append("file", file, file.name || "recording.webm");
        upstream.append("model", "gpt-4o-mini-transcribe");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        if (!res.ok) {
          console.error("transcribe failed", res.status, await res.text().catch(() => ""));
          return Response.json({ error: "Couldn't understand the recording. Please try again." }, { status: res.status === 429 ? 429 : 502 });
        }
        const json = (await res.json()) as { text?: string };
        return Response.json({ text: (json.text ?? "").trim() });
      },
    },
  },
});
