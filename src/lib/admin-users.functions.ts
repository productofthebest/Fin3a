import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { blocksSignIn } from "./admin-users";

// Every function below is re-checked in the database (admin_require → has_role 'admin').
// Passwords, OTP hashes and credentials are never selected.

type Json = Record<string, unknown>;
const clean = <T,>(v: unknown) => JSON.parse(JSON.stringify(v)) as T;
function fail(message: string): never {
  if (message.includes("forbidden")) throw new Error("Administrator access required.");
  const safe = ["cannot", "required", "must", "Insufficient", "not found", "already", "Invalid", "characters", "finished setup", "decimals"];
  throw new Error(safe.some((s) => message.includes(s)) ? message : "The action could not be completed.");
}

export type UserStats = {
  generated_at: string; active_window_days: number; total: number;
  new_today: number; new_yesterday: number; new_week: number; new_last_week: number; new_month: number; new_last_month: number;
  active: number; inactive: number;
  series: { period: "daily" | "weekly" | "monthly" | "yearly"; bucket: string; new: number; total: number }[];
};
export const getUserStats = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("admin_user_stats");
  if (error) fail(error.message);
  return clean<UserStats>(data);
});

export type UserRow = { user_id: string; email: string | null; phone: string | null; display_name: string | null; fin3a_id: string | null; created_at: string; last_active: string | null; status: string; verification: string; ngn: number; usd: number };
export const listUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ search: z.string().max(120), page: z.number().int().min(0).max(10000) }))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_list_users", { _search: data.search, _limit: 25, _offset: data.page * 25 });
    if (error) fail(error.message);
    return clean<{ total: number; rows: UserRow[] }>(r);
  });

export type UserDetail = {
  profile: { user_id: string; email: string | null; phone: string | null; created_at: string; last_active: string | null; display_name: string | null; fin3a_id: string | null; currency: string | null; onboarding_completed: boolean | null; status: string; verification: string; verification_note: string | null; is_admin: boolean };
  balances: Record<"NGN" | "USD", { available: number; with_pending: number }>;
  crypto: { symbol: string; network: string; address: string; status: string; created_at: string }[];
  ledger: { id: string; kind: string; status: string; amount: number; currency: string; reference: string | null; provider: string | null; created_at: string }[];
  ledger_status: Record<string, number>;
  transfers: { id: string; direction: string; currency: string; amount: number; status: string; reference: string | null; created_at: string }[];
  swaps: { id: string; from_currency: string; to_currency: string; source_amount: number; destination_amount: number; rate: number; status: string; created_at: string }[];
  records: { id: string; type: string; amount: number; currency: string | null; description: string | null; merchant: string | null; occurred_at: string; status: string; source: string }[];
  adjustments: { id: string; currency: string; direction: string; amount: number; reason: string; status: string; created_at: string; decided_at: string | null; decision_note: string | null }[];
  audit: { id: string; action: string; detail: Json; created_at: string; admin_email: string | null }[];
};
export const getUserDetail = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_user_detail", { _user_id: data.userId });
    if (error) fail(error.message);
    return clean<UserDetail>(r);
  });

export const setAccountStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended", "deactivated", "restricted"]), reason: z.string().trim().min(5).max(500) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_account_status", { _user_id: data.userId, _status: data.status, _reason: data.reason });
    if (error) fail(error.message);
    // Database role check passed above; sign-in blocking is applied with the privileged auth client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: blocksSignIn(data.status) ? "876000h" : "none" });
    if (banError) { console.error("ban update failed", banError.message); return { ok: true, signInUpdated: false }; }
    return { ok: true, signInUpdated: true };
  });

export const setVerification = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), verification: z.enum(["unverified", "verified", "rejected"]), note: z.string().trim().min(5).max(500) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_verification", { _user_id: data.userId, _verification: data.verification, _note: data.note });
    if (error) fail(error.message);
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), displayName: z.string().trim().min(1).max(80), reason: z.string().trim().min(5).max(500) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_update_profile", { _user_id: data.userId, _display_name: data.displayName, _reason: data.reason });
    if (error) fail(error.message);
    return { ok: true };
  });

export const requestAdjustment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), currency: z.enum(["NGN", "USD"]), direction: z.enum(["credit", "debit"]), amount: z.number().positive().max(1e12), reason: z.string().trim().min(10).max(500) }))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("admin_request_adjustment", { _user_id: data.userId, _currency: data.currency, _direction: data.direction, _amount: data.amount, _reason: data.reason });
    if (error) fail(error.message);
    return { id: id as string };
  });

export const decideAdjustment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().min(5).max(500) }))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("admin_decide_adjustment", { _id: data.id, _approve: data.approve, _note: data.note });
    if (error) fail(error.message);
    return { status: r as string };
  });

export type AuditFeed = {
  audit: { id: string; action: string; target_user_id: string | null; detail: Json; created_at: string; admin_email: string | null; target_email: string | null }[];
  pending_adjustments: { id: string; user_id: string; currency: string; direction: string; amount: number; reason: string; created_at: string; requested_by: string; requested_by_email: string | null; target_email: string | null }[];
};
export const getAuditFeed = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("admin_audit_feed", { _limit: 200 });
  if (error) fail(error.message);
  return clean<AuditFeed>(data);
});
