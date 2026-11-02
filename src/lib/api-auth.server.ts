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
