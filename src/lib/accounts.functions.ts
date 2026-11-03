import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACCOUNT_CURRENCIES, computeAccountBalance, type LedgerEntry } from "./accounts";

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

    const [{ data: accounts, error: accErr }, { data: ledger, error: ledErr }, { data: assets, error: assetErr }, { data: addresses, error: addrErr }] =
      await Promise.all([
        supabase.from("accounts").select("id, currency, created_at").eq("user_id", userId),
        supabase.from("account_ledger").select("id, account_id, kind, status, amount, currency, reference, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        supabase.from("crypto_assets").select("id, symbol, name, network, min_deposit").eq("active", true).order("symbol"),
        supabase.from("crypto_addresses").select("id, asset_id, address, status").eq("user_id", userId),
      ]);
    if (accErr) throw new Error(accErr.message);
    if (ledErr) throw new Error(ledErr.message);
    if (assetErr) throw new Error(assetErr.message);
    if (addrErr) throw new Error(addrErr.message);

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
      // True only once a real provider (e.g. Breet) is configured server-side.
      providerConnected: Boolean(process.env["BREET_API_KEY"]),
    };
  });
