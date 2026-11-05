import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { collectPages } from "./pagination";
import { accountCurrencies, selectCountryAccounts } from "./country-currency";
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

    // Every user holds their local-currency account plus USD (idempotent per user+currency).
    const { data: prefs } = await supabase.from("user_settings").select("country").eq("user_id", userId).maybeSingle();
    const wanted = accountCurrencies(prefs?.country);
    for (const currency of wanted) {
      const { error } = await supabase
        .from("accounts")
        .upsert({ user_id: userId, currency }, { onConflict: "user_id,currency", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }

    const [{ data: accounts, error: accErr }, { data: ledger }, { data: assets, error: assetErr }, { data: addresses, error: addrErr }, { data: fx, error: fxErr }] =
      await Promise.all([
        supabase.from("accounts").select("id, currency, created_at").eq("user_id", userId),
        collectPages((from, to) => supabase.from("account_ledger").select("id, account_id, kind, status, amount, currency, reference, created_at").eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(from, to)).then(data => ({ data, error: null })),
        supabase.from("crypto_assets").select("id, symbol, name, network, min_deposit").eq("active", true).order("symbol"),
        supabase.from("crypto_addresses").select("id, asset_id, address, status").eq("user_id", userId),
        supabase.from("fx_settings").select("ngn_per_usd, updated_at").eq("id", true).maybeSingle(),
      ]);
    if (accErr) throw new Error(accErr.message);

    if (assetErr) throw new Error(assetErr.message);
    if (addrErr) throw new Error(addrErr.message);
    if (fxErr) throw new Error(fxErr.message);

    const entries = ledger ?? [];
    const accountCards = selectCountryAccounts(accounts ?? [], prefs?.country)
      .map((account) => {
      const own = entries.filter((e) => e.account_id === account.id);
      const balance = computeAccountBalance(own as LedgerEntry[]);
      return { ...account, balance, recent: own.slice(0, 5) };
    });

    return {
      accounts: accountCards,
      country: prefs?.country ?? "NG",
      cryptoAssets: (assets ?? []).map((asset) => ({
        ...asset,
        address: (addresses ?? []).find((a) => a.asset_id === asset.id) ?? null,
      })),
      fxRate: Number(fx?.ngn_per_usd ?? DEFAULT_NGN_PER_USD),
      fxUpdatedAt: fx?.updated_at ?? null,
      // A secret's presence is not evidence of an operational provider adapter.
      providerConnected: false,
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

