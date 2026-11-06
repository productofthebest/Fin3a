import { useQuery } from "@tanstack/react-query";
import { getAccountsOverview } from "@/lib/accounts.functions";
import type { SplitCurrency } from "@/lib/split-bill";

/** The signed-in user's currently selected country accounts (local currency + USD). */
export function useTransferCurrencies() {
  const { data } = useQuery({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
  const options = [...new Set((data?.accounts ?? []).map((account) => account.currency))];
  return { options: options.length ? options as SplitCurrency[] : (["USD"] as SplitCurrency[]) };
}
