import { CURRENCIES, formatMoney } from "./fin3a";
import { calculateTotals, type FinancialRecord } from "./financial-calculations";

export function recordCurrencies(preferred: string, records: { currency?: string | null }[] = []) {
  const known = new Set(CURRENCIES.map(c => c.code));
  return [...new Set([preferred, "NGN", "USD", ...records.map(r => r.currency)])]
    .filter((c): c is string => typeof c === "string" && known.has(c));
}

export function recordMoney(amount: number, currency?: string | null) {
  if (!currency || !CURRENCIES.some(c => c.code === currency)) {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)} · Currency unconfirmed`;
  }
  const formatted = formatMoney(amount, currency);
  return currency === "NGN" || currency === "USD" ? formatted : `${formatted} ${currency}`;
}

export function totalsByCurrency(records: FinancialRecord[], preferred: string, today: string) {
  return recordCurrencies(preferred, records).map(currency => ({
    currency, ...calculateTotals(records, currency, today),
  }));
}