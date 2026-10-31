import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analysisRange, buildAnalysis, forecastHistory, type AnalysisRecord } from "./financial-analysis";

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
    const records: AnalysisRecord[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await context.supabase.from("transactions")
        .select("id, type, amount, status, classification, currency, occurred_at, flag, description, source, category_id, categories(name, icon)")
        .eq("user_id", context.userId).lte("occurred_at", today)
        .order("occurred_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 999);
      if (error) throw new Error("Your financial records could not be loaded. Please try again.");
      records.push(...(rows ?? []));
      if (!rows || rows.length < 1000) break;
    }
    return { ...buildAnalysis(records, settings.currency, today, data), currency: settings.currency, today, history: forecastHistory(records, settings.currency, today), hasRecords: records.length > 0, range };
  });