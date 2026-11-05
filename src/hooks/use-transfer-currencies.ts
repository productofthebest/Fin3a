import { useQuery } from "@tanstack/react-query";
import { getAccountsOverview } from "@/lib/accounts.functions";
import type { SplitCurrency } from "@/lib/split-bill";

/** Movable currencies (NGN/USD) the signed-in user actually holds, plus any local currency that can't move yet. */
export function useTransferCurrencies() {
  const { data } = useQuery({ queryKey: ["accounts", "overview"], queryFn: () => getAccountsOverview(), staleTime: 30_000 });
  const held = data?.accounts.map((a) => a.currency) ?? ["NGN", "USD"];
  const options = (["NGN", "USD"] as SplitCurrency[]).filter((c) => held.includes(c));
  const local = held.find((c) => c !== "NGN" && c !== "USD");
  return { options: options.length ? options : (["USD"] as SplitCurrency[]), local };
}
