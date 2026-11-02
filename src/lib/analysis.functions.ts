import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analysisRange, buildAnalysis, forecastHistory, type AnalysisRecord } from "./financial-analysis";
import { ownedFinancialRecords } from "./financial-records.server";

export const analysisSearch = z.object({ period: z.enum(["week", "month", "quarter", "year", "custom"]).default("month"), start: z.string().optional(), end: z.string().optional(), comparison: z.enum(["previous", "year"]).default("previous") });
export const getAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => analysisSearch.parse(input))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0,10);
    const range = analysisRange(data, today);
    const { data: settings, error: settingsError } = await context.supabase.from("user_settings").select("currency").eq("user_id", context.userId).single();
    if (settingsError || !settings?.currency) throw new Error("Choose your currency before viewing analysis.");
    // Page through every owned row: PostgREST's default row limit must not truncate totals.
    const records=await ownedFinancialRecords(context.supabase,context.userId);
    return { ...buildAnalysis(records, settings.currency, today, data), currency: settings.currency, today, history: forecastHistory(records, settings.currency, today), hasRecords: records.length > 0, range };
  });