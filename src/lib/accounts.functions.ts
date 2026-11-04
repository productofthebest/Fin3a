import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACCOUNT_CURRENCIES,
  DEFAULT_NGN_PER_USD,
  computeAccountBalance,
  type AccountCurrency,
  type LedgerEntry,
} from "./accounts";

export const getAccountsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Ensure the two currency accounts exist (idempotent per user+currency).
    for (const currency of ACCOUNT_CURRENCIES) {
      const { error } = await supabase
        .from("accounts")
        .upsert({ user_id: userId, currency }, { onConflict: "user_id,currency", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }

    const [{ data: accounts, error: accErr }, { data: ledger, error: ledErr }, { data: assets, error: assetErr }, { data: addresses, error: addrErr }, { data: fx, error: fxErr }, { data: settings, error: settingsErr }] =
      await Promise.all([
        supabase.from("accounts").select("id, currency, created_at").eq("user_id", userId),
        supabase.from("account_ledger").select("id, account_id, kind, status, amount, currency, reference, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        supabase.from("crypto_assets").select("id, symbol, name, network, min_deposit").eq("active", true).order("symbol"),
        supabase.from("crypto_addresses").select("id, asset_id, address, status").eq("user_id", userId),
        supabase.from("fx_settings").select("ngn_per_usd, updated_at").eq("id", true).maybeSingle(),
        supabase.from("user_settings").select("deposit_credit_currency").eq("user_id", userId).maybeSingle(),
      ]);
    if (accErr) throw new Error(accErr.message);
    if (ledErr) throw new Error(ledErr.message);
    if (assetErr) throw new Error(assetErr.message);
    if (addrErr) throw new Error(addrErr.message);
    if (fxErr) throw new Error(fxErr.message);
    if (settingsErr) throw new Error(settingsErr.message);

    const entries = ledger ?? [];
    const accountCards = (accounts ?? []).map((account) => {
      const own = entries.filter((e) => e.account_id === account.id);
      const balance = computeAccountBalance(own as LedgerEntry[]);
      return { ...account, balance, recent: own.slice(0, 5) };
    });

    return {
      accounts: accountCards,
      cryptoAssets: (assets ?? []).map((asset) => ({
        ...asset,
        address: (addresses ?? []).find((a) => a.asset_id === asset.id) ?? null,
      })),
      fxRate: Number(fx?.ngn_per_usd ?? DEFAULT_NGN_PER_USD),
      fxUpdatedAt: fx?.updated_at ?? null,
      depositCreditCurrency: (settings?.deposit_credit_currency as AccountCurrency | null) ?? null,
      // True only once a real provider (e.g. Breet) is configured server-side.
      providerConnected: Boolean(process.env["BREET_API_KEY"]),
    };
  });

/** NGN↔USD swap: executed atomically in the database from the owner-set rate. */
export const executeSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fromCurrency: AccountCurrency; amount: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!ACCOUNT_CURRENCIES.includes(data.fromCurrency)) throw new Error("Unsupported currency");
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) throw new Error("Enter a valid amount");

    const { data: allowed, error: limitErr } = await supabase.rpc("consume_rate_limit", {
      _bucket: "swap",
      _limit: 10,
      _window_seconds: 3600,
    });
    if (limitErr) throw new Error(limitErr.message);
    if (allowed === false) throw new Error("Too many swaps. Try again in a little while.");

    const { data: result, error } = await supabase.rpc("execute_currency_swap", {
      _user_id: userId,
      _from_currency: data.fromCurrency,
      _amount: amount,
      _idempotency_key: crypto.randomUUID(),
      _reference: "Currency swap",
    });
    if (error) throw new Error(error.message);
    const outcome = (result ?? {}) as { status?: string; reason?: string; destination_amount?: number; rate?: number };
    if (outcome.status !== "completed") throw new Error(outcome.reason ?? "Swap failed");
    return { destinationAmount: Number(outcome.destination_amount ?? 0), rate: Number(outcome.rate ?? 0) };
  });

/** Which currency account verified crypto deposits should be credited to. */
export const setDepositCreditCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { currency: AccountCurrency | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const currency = data.currency && ACCOUNT_CURRENCIES.includes(data.currency) ? data.currency : null;
    const { error } = await supabase
      .from("user_settings")
      .update({ deposit_credit_currency: currency, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { depositCreditCurrency: currency };
  });
