import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getNigerianBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listNigerianBanks } = await import("./flutterwave.server");
    try {
      return { banks: await listNigerianBanks(), error: null as string | null };
    } catch {
      return { banks: [] as { code: string; name: string }[], error: "Banks could not be loaded. Please try again." };
    }
  });

export const verifyBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input =>
    z.object({ accountNumber: z.string().regex(/^\d{10}$/), bankCode: z.string().min(2).max(12).regex(/^[A-Za-z0-9]+$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error: limitErr } = await context.supabase.rpc("consume_rate_limit", { _bucket: "bank_resolve", _limit: 20, _window_seconds: 600 });
    if (limitErr || allowed === false) return { found: false as const, error: "Too many checks. Please wait a few minutes." };
    const { resolveBankAccount } = await import("./flutterwave.server");
    try {
      const r = await resolveBankAccount(data.accountNumber, data.bankCode);
      return { found: true as const, accountName: r.accountName };
    } catch {
      return { found: false as const, error: "We couldn't confirm this account. Check the bank and number." };
    }
  });
