import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UserSettings } from "./fin3a";
import { COUNTRY_CURRENCY } from "./country-currency";

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Shopping", icon: "🛍️" },
  { name: "Food & Drinks", icon: "🍔" },
  { name: "Utilities", icon: "💡" },
  { name: "Transport", icon: "🚌" },
  { name: "Rent", icon: "🏠" },
  { name: "Bills", icon: "🧾" },
  { name: "Health", icon: "🩺" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Travel", icon: "✈️" },
  { name: "Education", icon: "📚" },
];

export const DEFAULT_INCOME_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Salary", icon: "💼" },
  { name: "Business", icon: "💹" },
  { name: "Freelance", icon: "🧑‍💻" },
  { name: "Investments", icon: "📈" },
  { name: "Other income", icon: "💰" },
];

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserSettings | null> => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("id, user_id, currency, onboarding_completed, display_name, country")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as UserSettings | null;
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ currency: z.string().trim().length(3), display_name: z.string().trim().max(60).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: settings, error } = await context.supabase
      .from("user_settings")
      .upsert(
        {
          user_id: context.userId,
          currency: data.currency.toUpperCase(),
          onboarding_completed: true,
          display_name: data.display_name || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("id, user_id, currency, onboarding_completed, display_name, country")
      .single();
    if (error) throw new Error(error.message);

    // Seed starter categories on first onboarding so tracking works instantly.
    const { count, error: countError } = await context.supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if (countError) throw new Error(countError.message);
    if (!count) {
      const rows = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, user_id: context.userId, kind: "expense" as const })),
        ...DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c, user_id: context.userId, kind: "income" as const })),
      ];
      const { error: seedError } = await context.supabase.from("categories").insert(rows);
      if (seedError) throw new Error(seedError.message);
    }
    return settings as UserSettings;
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        currency: z.string().trim().length(3).optional(),
        display_name: z.string().trim().max(60).optional(),
        country: z.string().trim().toUpperCase().refine((c) => c in COUNTRY_CURRENCY, "Unsupported country").optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { currency?: string; display_name?: string | null; country?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.currency) patch.currency = data.currency;
    if (data.country) patch.country = data.country;
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    const { data: settings, error } = await context.supabase
      .from("user_settings")
      .update(patch)
      .eq("user_id", context.userId)
      .select("id, user_id, currency, onboarding_completed, display_name, country")
      .single();
    if (error) throw new Error(error.message);
    return settings as UserSettings;
  });
