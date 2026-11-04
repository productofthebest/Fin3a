import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { collectPages } from "./pagination";
import { FEE_SERVICES, type FeeSetting } from "./transaction-fees";
import { summarizeRevenue } from "./revenue-report";

const period = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine(p => p.from <= p.to && Number.isFinite(Date.parse(p.from)) && Number.isFinite(Date.parse(p.to)), "Invalid date range");
export const getRevenueReport = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(i => period.parse(i)).handler(async ({ data, context }) => {
  const { supabase, userId } = context;
  const access = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (access.error || access.data !== true) throw new Error("Administrator access required");
  const end = new Date(data.to + "T00:00:00Z"); end.setUTCDate(end.getUTCDate() + 1);
  const [schedule, history, events, quotes, transfers, qr, split] = await Promise.all([
    supabase.rpc("current_fee_schedule"),
    supabase.from("fee_versions").select("*").order("created_at", { ascending: false }).limit(100),
    collectPages((a,b) => supabase.from("revenue_events").select("*").gte("occurred_at",data.from + "T00:00:00Z").lt("occurred_at",end.toISOString()).order("occurred_at").order("id").range(a,b)),
    collectPages((a,b) => supabase.from("payment_fee_snapshots").select("id,service,currency,provider,quoted_payout,asset,network").order("id").range(a,b)),
    supabase.rpc("admin_split_overview"), supabase.rpc("admin_qr_overview"), supabase.rpc("admin_split_overview"),
  ]);
  if (schedule.error || history.error || transfers.error || qr.error || split.error) throw new Error("Could not load revenue records");
  return { settings: schedule.data as unknown as FeeSetting[], history: history.data ?? [], events, quotes, totals: summarizeRevenue(events, quotes), providerReady: false };
});

export const changeFee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ service: z.enum(FEE_SERVICES), rate_bps: z.number().int().min(0).max(10000), high_rate_bps: z.number().int().min(0).max(10000), flat_ngn: z.number().min(0).max(1000000).refine(v => Number.isInteger(v * 100)), expected_id: z.string().uuid().nullable(), change_key: z.string().uuid(), confirmed: z.literal(true) }).parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc("admin_change_fee", { _service: data.service, _rate_bps: data.rate_bps, _high_rate_bps: data.high_rate_bps, _flat_ngn: data.flat_ngn, _expected_id: data.expected_id ?? undefined, _change_key: data.change_key });
  if (error) throw new Error(error.message.includes("Refresh") || error.message.includes("Fee changed") ? "Fee changed. Refresh before saving." : "Could not save fee settings. Administrator access is required.");
  return { ok: true };
});