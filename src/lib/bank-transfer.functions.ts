import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getBankPayoutCapability } from "@/lib/flutterwave-capabilities";

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

const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/).refine(country => country !== "NG" && Boolean(getBankPayoutCapability(country)));

export const getCountryTransferBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ country: countryCodeSchema }).parse(input))
  .handler(async ({ data }) => {
    const { listTransferBanks } = await import("./flutterwave.server");
    try {
      return { banks: await listTransferBanks(data.country), error: null as string | null };
    } catch {
      return { banks: [] as { id: string; code: string; name: string; hasBranches: boolean }[], error: "Banks could not be loaded for this destination." };
    }
  });

export const getCountryBankBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ country: countryCodeSchema, bankId: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/) }).parse(input))
  .handler(async ({ data }) => {
    const { listTransferBankBranches } = await import("./flutterwave.server");
    try {
      return { branches: await listTransferBankBranches(data.country, data.bankId), error: null as string | null };
    } catch {
      return { branches: [] as { code: string; name: string }[], error: "Branches could not be loaded for this bank." };
    }
  });
