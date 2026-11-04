import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Every admin action is re-checked inside the database (has_role 'admin'); the UI check is only for display.

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return data === true;
  });

export type AiOverview = {
  settings: { ai_enabled: boolean; daily_budget_usd: number | null; monthly_budget_usd: number | null; user_daily_requests: number; user_daily_scans: number; user_monthly_scans: number; warn_percent: number; updated_at: string };
  prices: { model: string; input_per_mtok: number; cached_input_per_mtok: number | null; output_per_mtok: number; source_note: string | null; updated_at: string }[];
  today: { requests: number; failed: number; input_tokens: number; output_tokens: number; est_cost_usd: number | null; unpriced: number };
  month: { requests: number; failed: number; input_tokens: number; output_tokens: number; est_cost_usd: number | null; failed_cost_usd: number | null; unpriced: number };
  by_feature: { feature: string; requests: number; failed: number; input_tokens: number; output_tokens: number; est_cost_usd: number | null }[];
  daily: { day: string; requests: number; est_cost_usd: number | null }[];
  users: { user_id: string; email: string | null; requests: number; scans: number; failed: number; tokens: number; est_cost_usd: number | null; today: number; daily_requests: number | null; daily_scans: number | null; monthly_scans: number | null; blocked: boolean }[];
};

export const getAiOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ai_admin_overview");
    if (error) throw new Error(error.message.includes("forbidden") ? "Administrator access required." : "Could not load AI usage.");
    return JSON.parse(JSON.stringify(data)) as AiOverview;
  });

export type SplitOverview = {
  bills_created: number;
  bills_open: number;
  requested: { currency: string; total: number }[];
  collected: { currency: string; total: number }[];
  participants_pending: number;
  participants_paid: number;
  transfers_completed: number;
  transfers_failed: number;
  suspicious: { user_id: string; failed_count: number }[];
};

export const getAdminSplitOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_split_overview");
    if (error) throw new Error(error.message.includes("Not authorized") ? "Administrator access required." : "Could not load sharing figures.");
    return JSON.parse(JSON.stringify(data)) as SplitOverview;
  });

export interface QrOverview {
  scans: number;
  requests: number;
  paid: number;
  pending: number;
  failed: number;
  valueByCurrency: Record<string, number>;
  suspicious: number;
}

export const getAdminQrOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_qr_overview");
    if (error) throw new Error(error.message.includes("Not authorized") ? "Administrator access required." : "Could not load QR payment figures.");
    return JSON.parse(JSON.stringify(data)) as QrOverview;
  });

export type FxRate = { ngn_per_usd: number; updated_at: string };

export const getFxRate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fx_settings")
      .select("ngn_per_usd, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ngn_per_usd: Number(data?.ngn_per_usd ?? 1400), updated_at: data?.updated_at ?? "" } as FxRate;
  });

export const setFxRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ngn_per_usd: z.number().min(0.01).max(1_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_fx_rate", { _ngn_per_usd: data.ngn_per_usd });
    if (error) throw new Error(error.message.includes("Not authorized") ? "Administrator access required." : "Could not save the rate.");
    return { ok: true };
  });

const money = z.number().min(0).max(1_000_000).nullable();

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    ai_enabled: z.boolean(), daily_budget_usd: money, monthly_budget_usd: money,
    user_daily_requests: z.number().int().min(0).max(10000), user_daily_scans: z.number().int().min(0).max(1000),
    user_monthly_scans: z.number().int().min(0).max(20000), warn_percent: z.number().int().min(1).max(100),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ai_admin_update_settings", {
      _enabled: data.ai_enabled, _daily: data.daily_budget_usd as number, _monthly: data.monthly_budget_usd as number,
      _user_daily: data.user_daily_requests, _scans_daily: data.user_daily_scans, _scans_monthly: data.user_monthly_scans, _warn: data.warn_percent,
    });
    if (error) throw new Error(error.message.includes("forbidden") ? "Administrator access required." : "Could not save settings.");
    return { ok: true };
  });

export const setModelPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    model: z.string().trim().min(1).max(100), input_per_mtok: z.number().min(0).max(10000),
    cached_input_per_mtok: z.number().min(0).max(10000).nullable(), output_per_mtok: z.number().min(0).max(10000),
    source_note: z.string().trim().max(300).nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ai_admin_set_price", {
      _model: data.model, _input: data.input_per_mtok, _cached: data.cached_input_per_mtok as number, _output: data.output_per_mtok, _note: data.source_note as string,
    });
    if (error) throw new Error(error.message.includes("forbidden") ? "Administrator access required." : "Could not save price.");
    return { ok: true };
  });

export const setUserAiLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(), daily_requests: z.number().int().min(0).max(10000).nullable(),
    daily_scans: z.number().int().min(0).max(1000).nullable(), monthly_scans: z.number().int().min(0).max(20000).nullable(),
    blocked: z.boolean(), note: z.string().trim().max(300).nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ai_admin_set_user_limit", {
      _user_id: data.user_id, _daily: data.daily_requests as number, _scans_daily: data.daily_scans as number,
      _scans_monthly: data.monthly_scans as number, _blocked: data.blocked, _note: data.note as string,
    });
    if (error) throw new Error(error.message.includes("forbidden") ? "Administrator access required." : "Could not save limit.");
    return { ok: true };
  });
