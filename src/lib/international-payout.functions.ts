import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildInternationalPayoutPreflight,
  internationalPayoutPreflightInput,
} from "./international-payout-api";

/**
 * Authenticated, non-monetary international payout preflight.
 * Wallet country and account ownership are read from the signed-in user's
 * database records, never accepted from browser-supplied identity fields.
 * This endpoint never calls Flutterwave, reserves funds, or writes a ledger.
 */
export const validateInternationalPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => internationalPayoutPreflightInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: rateError } = await context.supabase.rpc("consume_rate_limit", {
      _bucket: "international_payout_preflight",
      _limit: 20,
      _window_seconds: 600,
    });

    if (rateError || allowed !== true) {
      return {
        ok: false as const,
        enabled: false as const,
        reason: "temporarily_unavailable",
      };
    }

    const [{ data: settings, error: settingsError }, { data: account, error: accountError }] = await Promise.all([
      context.supabase.from("user_settings").select("country").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("accounts").select("currency").eq("user_id", context.userId).eq("currency", data.walletCurrency.toUpperCase()).maybeSingle(),
    ]);

    if (settingsError || accountError || !settings?.country || !account) {
      return {
        ok: false as const,
        enabled: false as const,
        reason: "wallet_context_unavailable",
      };
    }

    return buildInternationalPayoutPreflight(data, settings.country);
  });
