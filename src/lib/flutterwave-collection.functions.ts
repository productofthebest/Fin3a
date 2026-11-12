import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROUTES: Record<string, string> = { NG: "NGN", US: "USD", GB: "GBP", GH: "GHS", ZA: "ZAR" };
const inputSchema = z.object({
  amount: z.number().finite().positive().max(1_000_000).refine(n => Math.round(n * 100) === n * 100),
  currency: z.enum(["NGN", "USD", "GBP", "GHS", "ZAR"]),
});

type IntentRow = { id: string; tx_ref: string; requested_amount: number; currency: string; expires_at: string };
type CheckoutResponse = { status?: string; message?: string; data?: { link?: string } };

/**
 * Creates an authenticated, user-owned international deposit intent before
 * asking the fixed-egress relay for Flutterwave-hosted checkout. Card data
 * never passes through Fin3a. The webhook independently verifies and settles.
 */
export const createFlutterwaveCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: profile, error: profileError } = await supabase
      .from("user_settings")
      .select("country")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError || !profile?.country) throw new Error("Your country profile is unavailable.");
    const country = profile.country.trim().toUpperCase();
    if (ROUTES[country] !== data.currency) throw new Error("This currency is not available for your country.");
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("currency", data.currency)
      .maybeSingle();
    if (accountError || !account) throw new Error("The selected Fin3a wallet is unavailable.");

    const email = typeof claims.email === "string" ? claims.email : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Add a valid email address to your Fin3a account before depositing.");
    const metadata = claims.user_metadata && typeof claims.user_metadata === "object" ? claims.user_metadata as Record<string, unknown> : {};
    const candidateName = [metadata.full_name, metadata.name].find(v => typeof v === "string" && v.trim()) as string | undefined;
    const customerName = (candidateName ?? email.split("@")[0]).trim().slice(0, 120);
    const txRef = `F3I-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

    // Table was introduced in migration 0048; fail closed if it is not deployed.
    const adminModule = await import("@/integrations/supabase/client.server");
    const admin = adminModule.supabaseAdmin as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => {
          select: (columns: string) => { single: () => Promise<{ data: IntentRow | null; error: unknown }> };
        };
        update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: unknown }> };
      };
    };
    const { data: intent, error: intentError } = await admin.from("international_deposit_intents").insert({
      user_id: userId,
      account_id: account.id,
      country,
      currency: data.currency,
      tx_ref: txRef,
      requested_amount: data.amount,
      expires_at: expiresAt,
    }).select("id,tx_ref,requested_amount,currency,expires_at").single();
    if (intentError || !intent) throw new Error("Deposits are not ready for this wallet yet. Please try again later.");

    try {
      const { collectionFetch } = await import("@/lib/payout-transport.server");
      const response = await collectionFetch({
        method: "POST",
        body: JSON.stringify({
          country,
          currency: data.currency,
          amount: data.amount,
          tx_ref: txRef,
          customer: { email, name: customerName },
        }),
      });
      const payload = await response.json().catch(() => null) as CheckoutResponse | null;
      const checkoutUrl = payload?.data?.link;
      if (!response.ok || payload?.status !== "success" || typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
        throw new Error("CHECKOUT_UNAVAILABLE");
      }
      return { txRef, checkoutUrl, amount: intent.requested_amount, currency: intent.currency, expiresAt: intent.expires_at };
    } catch {
      await admin.from("international_deposit_intents").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", intent.id);
      throw new Error("Secure checkout could not be started. No payment has been taken; please try again.");
    }
  });
