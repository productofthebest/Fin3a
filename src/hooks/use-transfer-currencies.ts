import { useQuery } from "@tanstack/react-query";
import { getAccountsOverview } from "@/lib/accounts.functions";
import { accountCurrencies } from "@/lib/country-currency";
import type { SplitCurrency } from "@/lib/split-bill";

/** Current country's local currency plus USD, for every country supported by Fin3a. */
export function useTransferCurrencies() {
  const { data } = useQuery({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
  const options = data ? accountCurrencies(data.country) : ["USD"];
  const local = options.find(c => c !== "NGN" && c !== "USD") ?? null;
  return { options: options as SplitCurrency[], local };
}
