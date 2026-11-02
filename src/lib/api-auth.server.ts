import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type QuotaBucket = "landing_chat" | "transcribe";

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Verifies the caller's bearer token and returns an RLS-scoped client, or an error Response. */
export async function verifyBearer(request: Request) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { error: jsonError(500, "Server is not configured.") } as const;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (token.split(".").length !== 3) return { error: jsonError(401, "Please sign in to use Fin3a AI.") } as const;
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
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return { error: jsonError(401, "Please sign in to use Fin3a AI.") } as const;
  return { supabase, userId } as const;
}

/** Atomically consumes one unit of the caller's quota in the database. Fails closed. */
export async function consumeQuota(
  supabase: Awaited<ReturnType<typeof verifyBearer>> extends infer R ? (R extends { supabase: infer S } ? S : never) : never,
  bucket: QuotaBucket,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await supabase.rpc("consume_ai_quota", { _bucket: bucket, _limit: limit, _window_seconds: windowSeconds });
  if (error) console.error("quota check failed", error.message);
  return !error && data === true;
}

export type AiFeature = "assistant" | "landing_chat" | "transcribe" | "scan";
type Sb = Awaited<ReturnType<typeof verifyBearer>> extends infer R ? (R extends { supabase: infer S } ? S : never) : never;
export type AiTokens = { model: string; input?: number | null; cached?: number | null; output?: number | null };

/** Atomic server-side preflight (kill switch, budgets, per-user limits, duplicate requests). Fails closed. */
export async function beginAiUsage(supabase: Sb | import("@supabase/supabase-js").SupabaseClient, feature: AiFeature, requestKey: string | null, units = 1) {
  const { data, error } = await (supabase as Sb).rpc("ai_begin", { _feature: feature, _request_key: requestKey as string, _units: units });
  if (error || !data) {
    console.error("ai preflight failed", error?.message);
    return { allowed: false as const, message: "Fin3a AI is temporarily unavailable. Please try again shortly." };
  }
  const r = data as { allowed: boolean; reason?: string; usage_id?: string; warning?: string | null };
  if (!r.allowed) return { allowed: false as const, message: aiLimitMessage(r.reason) , reason: r.reason };
  return { allowed: true as const, usageId: r.usage_id!, warning: r.warning ?? null };
}

export async function finishAiUsage(supabase: Sb | import("@supabase/supabase-js").SupabaseClient, usageId: string, ok: boolean, tokens: AiTokens | null, errorCode?: string) {
  const { error } = await (supabase as Sb).rpc("ai_finish", {
    _usage_id: usageId, _status: ok ? "ok" : "failed", _model: tokens?.model ?? "",
    _in: (tokens?.input ?? null) as number, _cached: (tokens?.cached ?? null) as number, _out: (tokens?.output ?? null) as number,
    _error: (errorCode ?? null) as string,
  });
  if (error) console.error("ai usage record failed", error.message);
}

export function aiLimitMessage(reason?: string): string {
  switch (reason) {
    case "disabled": return "Fin3a AI is temporarily paused by the administrator. Please try again later.";
    case "blocked": return "AI features are paused on this account. Contact support if you think this is a mistake.";
    case "duplicate": return "This request is already being processed.";
    case "budget": return "Fin3a AI has reached its usage budget for now. Please try again later.";
    case "daily_scan_limit": return "You've reached today's document-scan limit. Try again tomorrow.";
    case "monthly_scan_limit": return "You've reached this month's document-scan limit.";
    case "daily_limit": return "You've reached today's AI request limit. Try again tomorrow.";
    default: return "Fin3a AI is unavailable right now.";
  }
}
