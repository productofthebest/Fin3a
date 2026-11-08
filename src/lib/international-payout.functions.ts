import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  internationalPayoutPreflightInput,
  runAuthenticatedInternationalPayoutPreflight,
  type InternationalPayoutPreflightDatabase,
} from "./international-payout-api";

/**
 * Authenticated, non-monetary international payout preflight.
 * Identity comes from verified Supabase claims. This endpoint never calls
 * Flutterwave, reserves funds, or writes a ledger.
 */
export const validateInternationalPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => internationalPayoutPreflightInput.parse(input))
  .handler(async ({ data, context }) => runAuthenticatedInternationalPayoutPreflight(
    data,
    context.userId,
    context.supabase as unknown as InternationalPayoutPreflightDatabase,
  ));
