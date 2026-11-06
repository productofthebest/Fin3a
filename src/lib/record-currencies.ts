import { CURRENCIES, formatMoney } from "./fin3a";
import { calculateTotals, type FinancialRecord } from "./financial-calculations";

/**
 * The selected country determines the local account currency. USD remains the
 * only additional spending view. Other-currency records remain stored and are
 * not mixed into either view; switching countries never rewrites history.
 */
export function recordCurrencies(preferred: string, _records: { currency?: string | null }[] = []) {
  const known = new Set(CURRENCIES.map(c => c.code));
  return [...new Set([preferred, "USD"])]
    .filter((currency): currency is string => typeof currency === "string" && known.has(currency));
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
