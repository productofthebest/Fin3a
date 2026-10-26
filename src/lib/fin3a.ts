/** Client-safe shared types, constants and formatting helpers for Fin3a. */

export type TxType = "income" | "expense";
export type TxStatus = "pending" | "cleared" | "completed";
export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: TxType;
  icon: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TxType;
  amount: number;
  category_id: string | null;
  description: string | null;
  merchant: string | null;
  occurred_at: string;
  status: TxStatus;
  source: string;
  recurring_bill_id: string | null;
  notes: string | null;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "icon"> | null;
}

export interface RecurringBill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  next_due_date: string;
  category_id: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "icon"> | null;
}

export interface UserSettings {
  id: string;
  user_id: string;
  currency: string;
  onboarding_completed: boolean;
  display_name: string | null;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
];

/** Format a money amount in the user's chosen currency. */
export function formatMoney(amount: number, currency: string, opts?: { compact?: boolean; decimals?: number }): string {
  const decimals = opts?.decimals ?? (Number.isInteger(amount) ? 0 : 2);
  if (opts?.compact && Math.abs(amount) >= 1000) {
    const units = [
      { limit: 1e9, suffix: "b" },
      { limit: 1e6, suffix: "m" },
      { limit: 1e3, suffix: "k" },
    ];
    for (const { limit, suffix } of units) {
      if (Math.abs(amount) >= limit) {
        const value = amount / limit;
        const formatted = new Intl.NumberFormat("en-US", {
          maximumFractionDigits: value >= 100 ? 0 : 1,
        }).format(value);
        return `${currencySymbol(currency)}${formatted}${suffix}`;
      }
    }
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export const TX_STATUS_LABELS: Record<TxStatus, string> = {
  pending: "Pending",
  cleared: "Cleared funds",
  completed: "Completed",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month helpers on plain YYYY-MM-DD date strings (timezone-safe). */
export function monthLabel(offsetFromNow = 0): { year: number; month: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromNow, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function monthRange(offsetFromNow = 0): { start: string; end: string } {
  const { year, month } = monthLabel(offsetFromNow);
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return isoDate(new Date());
}
