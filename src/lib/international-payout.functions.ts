import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildInternationalPayoutPreflight,
  internationalPayoutPreflightInput,
} from "./international-payout-api";

/**
 * Authenticated, non-monetary international payout preflight.
 * This endpoint never calls Flutterwave, reserves funds, writes ledger rows,
 * or returns an enabled route. Merchant verification remains a separate gate.
 */
export const validateInternationalPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => internationalPayoutPreflightInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("consume_rate_limit", {
      _bucket: "international_payout_preflight",
      _limit: 20,
      _window_seconds: 600,
    });

    if (error || allowed !== true) {
      return {
        ok: false as const,
        enabled: false as const,
        reason: "temporarily_unavailable",
      };
    }

    return buildInternationalPayoutPreflight(data);
  });
